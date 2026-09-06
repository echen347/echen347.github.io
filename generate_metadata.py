#!/usr/bin/env python3
"""Generate photos.js for the photography page.

Single source of truth for the gallery. It:
  1. Auto-discovers every image in photography/ (no hand-maintained file list).
  2. Reads EXIF (camera/lens/settings/date) and orientation-corrected dimensions.
  3. Generates responsive JPEG/WebP images and compatible grid thumbnails.
  4. Merges the authored sidecar photos.meta.json (alt / theme / place / order).
  5. Groups photos into theme sections (SECTION_ORDER), ordered by portfolio priority.
  6. Writes photos.js  ->  window.photoData = { sections: [...] }
  7. Generates responsive homepage headshots into images/headshot/.

photography.html loads photos.js via <script src> (NOT fetch, so file:// still works) and
just renders it. To add a photo: drop the JPEG in photography/, add an entry to
photos.meta.json, and run `python3 generate_metadata.py`.

Requires: Pillow, exifread.
"""

import os
import re
import json
import sys
import hashlib
import io
from pathlib import Path
from PIL import Image, ImageCms, ImageOps, __version__ as PILLOW_VERSION
import exifread

# --- Configuration ---------------------------------------------------------

PHOTO_DIR = "photography"
THUMB_DIR = os.path.join(PHOTO_DIR, "thumbs")
VARIANT_DIR = os.path.join(PHOTO_DIR, "variants")
HEADSHOT_SOURCE = "headshot-cur-cruise.JPG"
HEADSHOT_DIR = "images/headshot"
SIDECAR = "photos.meta.json"
OUTPUT = "photos.js"

# Order in which theme sections appear on the page. Themes not listed here are
# appended alphabetically (with a warning) so a new theme never silently vanishes.
SECTION_ORDER = [
    "Architecture",
    "Landscape & Travel",
    "Street",
    "Nature",
    "Portrait",
    "Abstract",
]

THUMB_MAX_EDGE = 1200   # px on the long edge
PHOTO_EDGES = (600, 1200, 1600, 2400)
HEADSHOT_WIDTHS = (240, 480, 720)
JPEG_QUALITY = 82
WEBP_QUALITY = 82
GENERATION_VERSION = 1

VALID_EXT = (".jpg", ".jpeg")  # matched case-insensitively


# --- EXIF helpers (unchanged behavior) ------------------------------------

def get_tag_value(tags, key):
    """Safely get a tag's printable value."""
    if key in tags:
        return tags[key].printable
    return ""


def format_shutter_speed(val_str):
    """Formats shutter speed, e.g., '1/125' -> '1/125s'."""
    if not val_str:
        return ""
    try:
        val = float(eval(val_str))
        if val < 1:
            return f"1/{int(1/val)}s"
        return f"{int(val)}s"
    except (SyntaxError, ValueError, ZeroDivisionError):
        return f"{val_str}s"


def format_rational(val_str):
    """Formats a rational string (e.g., '71/10') into a decimal-like string ('7.1')."""
    if not val_str:
        return ""
    try:
        val = float(eval(val_str))
        if val == int(val):
            return str(int(val))
        return f"{val:.1f}"
    except (SyntaxError, ValueError, ZeroDivisionError):
        return val_str


# --- Core ------------------------------------------------------------------

def slugify(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def discover_images():
    """All gallery images in PHOTO_DIR (excludes the thumbs/ subdir and dotfiles)."""
    if not os.path.isdir(PHOTO_DIR):
        sys.exit(f"✖ '{PHOTO_DIR}/' does not exist.")
    files = []
    for name in os.listdir(PHOTO_DIR):
        if name.startswith("."):
            continue
        if os.path.splitext(name)[1].lower() in VALID_EXT:
            files.append(name)
    return sorted(files)


def generation_signature(src_path, sizes, axis):
    """Key the cache by source bytes, encoder settings, and Pillow version."""
    settings = {
        "version": GENERATION_VERSION,
        "pillow": PILLOW_VERSION,
        "sizes": sizes,
        "axis": axis,
        "jpeg_quality": JPEG_QUALITY,
        "webp_quality": WEBP_QUALITY,
        "jpeg": "progressive,optimize",
        "webp_method": 6,
        "resize": "lanczos",
        "color": "preserve-rgb-icc,convert-other-modes-to-srgb",
    }
    digest = hashlib.sha256(json.dumps(settings, sort_keys=True).encode())
    with open(src_path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()[:16]


def read_pixels(src_path):
    """Bake in EXIF orientation and retain or convert the embedded color profile."""
    with Image.open(src_path) as source:
        image = ImageOps.exif_transpose(source)
        profile = image.info.get("icc_profile")
        if image.mode != "RGB" and profile:
            srgb = ImageCms.ImageCmsProfile(ImageCms.createProfile("sRGB"))
            image = ImageCms.profileToProfile(
                image, ImageCms.ImageCmsProfile(io.BytesIO(profile)), srgb,
                outputMode="RGB",
            )
            profile = srgb.tobytes()
        else:
            image = image.convert("RGB")
        return image, profile


def save_variant(image, path, format_name, profile):
    options = {"icc_profile": profile} if profile else {}
    if format_name == "jpeg":
        image.save(path, "JPEG", quality=JPEG_QUALITY, optimize=True,
                   progressive=True, **options)
    else:
        image.save(path, "WEBP", quality=WEBP_QUALITY, method=6, **options)


def make_variants(src_path, output_dir, stem, sizes, *, width_axis=False,
                  signature_names=True):
    """Generate distinct sizes without upscaling; describe the output pixels."""
    signature = generation_signature(src_path, sizes, "width" if width_axis else "edge")
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    cache_path = output_dir / f".{stem}-generation.json"
    cache_signature = None
    if not signature_names and cache_path.exists():
        try:
            cache_signature = json.loads(cache_path.read_text())["signature"]
        except (ValueError, KeyError):
            pass

    image, profile = read_pixels(src_path)
    sources = {"jpeg": [], "webp": []}
    made = 0
    previous_size = None
    for requested in sizes:
        resized = image.copy()
        if width_axis:
            width = min(requested, image.width)
            height = max(1, round(image.height * width / image.width))
            if resized.size != (width, height):
                resized = resized.resize((width, height), Image.Resampling.LANCZOS)
        else:
            resized.thumbnail((requested, requested), Image.Resampling.LANCZOS)
        if resized.size == previous_size:
            continue
        previous_size = resized.size
        size_label = resized.width if width_axis else max(resized.size)
        name = f"{stem}-{signature}" if signature_names else stem
        for format_name, suffix in (("jpeg", "jpg"), ("webp", "webp")):
            path = output_dir / f"{name}-{size_label}.{suffix}"
            if not path.exists() or (not signature_names and cache_signature != signature):
                save_variant(resized, path, format_name, profile)
                made += 1
            sources[format_name].append({
                "src": path.as_posix(), "width": resized.width, "height": resized.height,
            })

    if not signature_names:
        cache = json.dumps({"signature": signature, "sources": sources}, indent=2) + "\n"
        if not cache_path.exists() or cache_path.read_text() != cache:
            cache_path.write_text(cache)
    return sources, made


def make_photo_variants(src_path, thumb_path):
    sources, made = make_variants(
        src_path, VARIANT_DIR, Path(src_path).stem, PHOTO_EDGES,
    )
    preview = max(
        (item for item in sources["jpeg"] if max(item["width"], item["height"]) <= 1600),
        key=lambda item: max(item["width"], item["height"]),
    )["src"]
    thumbnail = max(
        (item for item in sources["jpeg"]
         if max(item["width"], item["height"]) <= THUMB_MAX_EDGE),
        key=lambda item: max(item["width"], item["height"]),
    )["src"]
    # Keep existing thumbnail URLs usable and refresh them when source bytes change.
    thumbnail_bytes = Path(thumbnail).read_bytes()
    thumb_path = Path(thumb_path)
    thumb_made = not thumb_path.exists() or thumb_path.read_bytes() != thumbnail_bytes
    if thumb_made:
        thumb_path.write_bytes(thumbnail_bytes)
    return sources, preview, made, thumb_made


def read_exif(image_path):
    """Return (width, height, exif_dict) with orientation-corrected dimensions."""
    with Image.open(image_path) as im:
        width, height = ImageOps.exif_transpose(im).size

    with open(image_path, "rb") as f:
        tags = exifread.process_file(f, details=False)

    make = get_tag_value(tags, "Image Make")
    model = get_tag_value(tags, "Image Model")
    camera = f"{make} {model}".strip()

    lens = get_tag_value(tags, "EXIF LensModel")
    if not lens and "X100V" in model:
        lens = "23mm F2 Fixed Lens"
    elif lens and "DG DN" in lens and "|" in lens:
        lens = "SIGMA " + lens.replace(" | ", " ")

    focal_raw = get_tag_value(tags, "EXIF FocalLength")
    focal = f"{format_rational(focal_raw)}mm" if focal_raw else ""

    aperture_raw = get_tag_value(tags, "EXIF FNumber")
    aperture = f"f/{format_rational(aperture_raw)}" if aperture_raw else ""

    iso = get_tag_value(tags, "EXIF ISOSpeedRatings")
    iso = f"ISO {iso}" if iso else ""

    shutter = format_shutter_speed(get_tag_value(tags, "EXIF ExposureTime"))
    date = get_tag_value(tags, "EXIF DateTimeOriginal")  # "YYYY:MM:DD HH:MM:SS"

    exif = {
        "camera": camera or "Unknown Camera",
        "lens": lens or "Unknown Lens",
        "focalLength": focal,
        "shutterSpeed": shutter,
        "aperture": aperture,
        "iso": iso,
        "date": date,
    }
    return width, height, exif


def load_sidecar():
    if not os.path.exists(SIDECAR):
        sys.exit(f"✖ '{SIDECAR}' not found.")
    with open(SIDECAR, "r", encoding="utf-8") as f:
        data = json.load(f)
    # Drop comment keys (any key starting with '_').
    return {k: v for k, v in data.items() if not k.startswith("_")}


def main():
    print("Generating photos.js ...\n")

    images = discover_images()
    sidecar = load_sidecar()
    os.makedirs(THUMB_DIR, exist_ok=True)

    warnings = []
    photos = []
    thumbs_made = 0
    variants_made = 0
    seen_thumbs = {}

    for filename in images:
        if filename not in sidecar:
            warnings.append(f"  ⚠  {filename}: no entry in {SIDECAR}; skipped (no alt/theme).")
            continue

        meta = sidecar[filename]
        src_path = os.path.join(PHOTO_DIR, filename)
        thumb_name = os.path.splitext(filename)[0] + ".jpg"
        thumb_path = os.path.join(THUMB_DIR, thumb_name)

        # Two sources that differ only by extension/case (foo.jpg vs foo.JPG) would map
        # to one thumbnail and silently clobber each other on a case-sensitive filesystem
        # (e.g. Linux CI). Fail loudly instead.
        if thumb_name in seen_thumbs:
            sys.exit(f"✖ thumbnail name collision: '{filename}' and '{seen_thumbs[thumb_name]}' "
                     f"both map to '{thumb_name}'. Rename one source file.")
        seen_thumbs[thumb_name] = filename

        # A single corrupt/truncated image should degrade to a skip + warning, not abort
        # the whole regeneration (mirrors the missing-sidecar handling above).
        try:
            sources, preview, made, thumb_made = make_photo_variants(src_path, thumb_path)
            thumbs_made += int(thumb_made)
            variants_made += made
            width, height, exif = read_exif(src_path)
        except Exception as e:
            warnings.append(f"  ⚠  {filename}: could not process ({e}); skipped.")
            continue

        photos.append({
            "src": f"{PHOTO_DIR}/{filename}",
            "thumb": f"{THUMB_DIR}/{thumb_name}",
            "preview": preview,
            "sources": sources,
            "alt": meta.get("alt", ""),
            "theme": meta.get("theme", ""),
            "place": meta.get("place", ""),
            "order": meta.get("order", 1000),
            "width": width,
            "height": height,
            **exif,
        })
        print(f"  ✓ {filename}  ({width}×{height}, {exif['camera']})")

    # Stale sidecar entries (named file no longer present).
    for filename in sidecar:
        if filename not in images:
            warnings.append(f"  ⚠  {SIDECAR} lists '{filename}' but no such file in {PHOTO_DIR}/.")

    # Group into theme sections.
    by_theme = {}
    for p in photos:
        by_theme.setdefault(p["theme"] or "Uncategorized", []).append(p)

    known = [t for t in SECTION_ORDER if t in by_theme]
    extra = sorted(t for t in by_theme if t not in SECTION_ORDER)
    for t in extra:
        warnings.append(f"  ⚠  theme '{t}' is not in SECTION_ORDER; appended at the end.")
    ordered_themes = known + extra

    sections = []
    for theme in ordered_themes:
        # Lower order values lead; dates settle ties and place unranked additions last.
        group = sorted(by_theme[theme], key=lambda p: (p["order"], p["date"] or "~", p["src"]))
        sections.append({"title": theme, "slug": slugify(theme), "photos": group})

    data = {"sections": sections}

    header = (
        "// AUTO-GENERATED by generate_metadata.py; do not edit by hand.\n"
        "// To change the gallery: edit photos.meta.json and/or photography/, then re-run\n"
        "//   python3 generate_metadata.py\n"
    )
    with open(OUTPUT, "w", encoding="utf-8") as f:
        f.write(header)
        f.write("window.photoData = ")
        f.write(json.dumps(data, indent=2, ensure_ascii=False))
        f.write(";\n")

    if os.path.exists(HEADSHOT_SOURCE):
        _, made = make_variants(
            HEADSHOT_SOURCE, HEADSHOT_DIR, "headshot", HEADSHOT_WIDTHS,
            width_axis=True, signature_names=False,
        )
        print(f"\n   Headshot: {made} image(s) (re)generated.")

    # Summary.
    print(f"\n✅ Wrote {OUTPUT}")
    print(f"   {len(photos)} photos across {len(sections)} section(s); "
          f"{thumbs_made} thumbnail(s) (re)generated.")
    print(f"   {variants_made} responsive gallery image(s) (re)generated.")
    for s in sections:
        print(f"     · {s['title']}: {len(s['photos'])}")
    if warnings:
        print("\n  Warnings:")
        for w in warnings:
            print(w)


if __name__ == "__main__":
    main()
