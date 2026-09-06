"""Exercise image generation with temporary photographic fixtures."""

import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest import mock

from PIL import Image, ImageCms


SPEC = importlib.util.spec_from_file_location(
    "generate_metadata", Path(__file__).resolve().parents[1] / "generate_metadata.py"
)
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


class ImageVariantTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.previous_directory = os.getcwd()
        os.chdir(self.directory.name)
        self.addCleanup(os.chdir, self.previous_directory)
        Path("photography").mkdir()
        Path("photos.meta.json").write_text(json.dumps({
            "fixture.jpg": {"alt": "Fixture photograph.", "theme": "Architecture"}
        }))

    def make_source(self, size=(800, 1200), color="red", orientation=1,
                    profile=None, split_colors=False):
        image = Image.new("RGB", size, color)
        if split_colors:
            image.paste("blue", (size[0] // 2, 0, size[0], size[1]))
        exif = Image.Exif()
        exif[274] = orientation
        options = {"exif": exif, "quality": 95}
        if profile is not None:
            options["icc_profile"] = profile
        image.save("photography/fixture.jpg", **options)

    def generate(self):
        with contextlib.redirect_stdout(io.StringIO()):
            generator.main()
        data = Path("photos.js").read_text().split("window.photoData = ", 1)[1]
        return json.loads(data.rstrip(";\n"))["sections"][0]["photos"][0]

    def test_oriented_variants_use_actual_widths_and_keep_color_profile(self):
        profile = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB")).tobytes()
        self.make_source(orientation=6, profile=profile, split_colors=True)
        photo = self.generate()
        self.assertIn("sources", photo)
        self.assertEqual((photo["width"], photo["height"]), (1200, 800))
        for format_name in ("jpeg", "webp"):
            variants = photo["sources"][format_name]
            self.assertEqual([(v["width"], v["height"]) for v in variants],
                             [(600, 400), (1200, 800)])
            for variant in variants:
                with Image.open(variant["src"]) as image:
                    self.assertEqual(image.size, (variant["width"], variant["height"]))
                    self.assertEqual(image.info.get("icc_profile"), profile)
                    self.assertNotIn(274, image.getexif())
                    red, _, blue = image.getpixel((image.width // 2, image.height // 4))
                    self.assertGreater(red, blue)
                    red, _, blue = image.getpixel((image.width // 2, 3 * image.height // 4))
                    self.assertGreater(blue, red)
        self.assertEqual(photo["preview"], photo["sources"]["jpeg"][-1]["src"])
        self.assertEqual(photo["src"], "photography/fixture.jpg")
        self.assertEqual(photo["thumb"], "photography/thumbs/fixture.jpg")
        self.assertTrue(Path(photo["thumb"]).exists())

    def test_small_sources_do_not_upscale_or_repeat_variants(self):
        self.make_source(size=(90, 60))
        photo = self.generate()
        self.assertIn("sources", photo)
        for format_name in ("jpeg", "webp"):
            variants = photo["sources"][format_name]
            self.assertEqual(len(variants), 1)
            self.assertEqual((variants[0]["width"], variants[0]["height"]), (90, 60))

    def test_cache_detects_source_changes_even_with_unchanged_mtime(self):
        self.make_source(size=(600, 400))
        source = Path("photography/fixture.jpg")
        original_stat = source.stat()
        first = self.generate()
        self.assertIn("sources", first)
        first_variant = Path(first["preview"])
        first_bytes = first_variant.read_bytes()
        first_mtime = first_variant.stat().st_mtime_ns
        unchanged = self.generate()
        self.assertEqual(unchanged["preview"], first["preview"])
        self.assertEqual(first_variant.stat().st_mtime_ns, first_mtime)

        self.make_source(size=(600, 400), color="blue")
        os.utime(source, ns=(original_stat.st_atime_ns, original_stat.st_mtime_ns))
        changed = self.generate()
        self.assertNotEqual(changed["preview"], first["preview"])
        self.assertNotEqual(Path(changed["preview"]).read_bytes(), first_bytes)
        with Image.open(changed["thumb"]) as image:
            red, _, blue = image.getpixel((10, 10))
            self.assertGreater(blue, red)

    def test_quality_changes_invalidate_cached_derivatives(self):
        self.make_source(size=(600, 400))
        first = self.generate()
        self.assertIn("sources", first)
        with mock.patch.object(generator, "JPEG_QUALITY", 70, create=True):
            changed = self.generate()
        self.assertNotEqual(changed["preview"], first["preview"])

    def test_headshot_generation_is_part_of_the_same_command(self):
        self.make_source(size=(600, 400))
        Image.new("RGB", (900, 1200), "green").save("headshot-cur-cruise.JPG")
        self.generate()
        for width, height in ((240, 320), (480, 640), (720, 960)):
            for suffix in ("jpg", "webp"):
                path = Path(f"images/headshot/headshot-{width}.{suffix}")
                self.assertTrue(path.exists(), str(path))
                with Image.open(path) as image:
                    self.assertEqual(image.size, (width, height))


if __name__ == "__main__":
    unittest.main()
