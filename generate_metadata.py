import os
import json
from PIL import Image
import exifread

# --- Configuration ---
# STEP 1: Edit this list to add, remove, or reorder your photos.
# You only need to provide the `src`, `alt`, and `preference`.
PHOTO_CONFIG = [
    { "src": "photography/uji-station-arches.jpg", "alt": "Repetitive concrete arches creating a tunnel effect inside Uji Station, Japan.", "preference": 1 },
    { "src": "photography/tokyo-tower-framed.jpg", "alt": "Tokyo Tower viewed through the narrow frame of an urban staircase.", "preference": 2 },
    { "src": "photography/seoul-palace-roof.jpg", "alt": "Symmetrical view of a traditional palace roof at Gyeongbokgung Palace in Seoul, South Korea.", "preference": 3 },
    { "src": "photography/oculus-nyc.jpg", "alt": "The Oculus structure with One World Trade Center rising in the background in New York City.", "preference": 4 },
    { "src": "photography/osaka-lion-shrine.jpg", "alt": "The iconic stone lion head stage at Namba Yasaka Shrine in Osaka, Japan.", "preference": 5 },
    { "src": "photography/byodo-in-photographer.jpg", "alt": "A photographer captures the reflection of Byodo-in Temple (Phoenix Hall) in Uji, Japan.", "preference": 6 },
    { "src": "photography/pine-branch-sunset.jpg", "alt": "A lone pine tree branch silhouetted against a soft, blurred sunset background.", "preference": 7 },
    { "src": "photography/rider-by-sea.jpg", "alt": "A lone rider and their motorcycle parked on a cliff overlooking the sea at sunset.", "preference": 8 }
]

# --- Script Logic (No need to edit below) ---

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
    """Formats a rational number string (e.g., '71/10') into a decimal-like string ('7.1')."""
    if not val_str:
        return ""
    try:
        # Using float(eval(...)) is a simple way to compute the decimal value
        val = float(eval(val_str))
        # Format to one decimal place if it's not a whole number
        if val == int(val):
            return str(int(val))
        return f"{val:.1f}"
    except (SyntaxError, ValueError, ZeroDivisionError):
        return val_str # Return original if it's not a simple fraction

def main():
    """
    Generates photo metadata by reading EXIF data and combining it
    with the manual configuration above.
    """
    all_photo_data = []

    print("Starting metadata extraction...")

    for photo_info in PHOTO_CONFIG:
        image_path = photo_info["src"]
        if not os.path.exists(image_path):
            print(f"⚠️  Warning: Image not found at '{image_path}', skipping.")
            continue

        width, height = 0, 0
        try:
            with Image.open(image_path) as img:
                width, height = img.size
        except Exception as e:
            print(f"⚠️  Warning: Could not read dimensions for '{image_path}': {e}")


        with open(image_path, 'rb') as f:
            tags = exifread.process_file(f, details=False)

            make = get_tag_value(tags, 'Image Make')
            model = get_tag_value(tags, 'Image Model')
            camera = f"{make} {model}".strip()

            lens = get_tag_value(tags, 'EXIF LensModel')
            if not lens and "X100V" in model:
                lens = "23mm F2 Fixed Lens"
            elif lens and 'DG DN' in lens and '|' in lens:
                 lens = 'SIGMA ' + lens.replace(' | ', ' ')

            focal_length_raw = get_tag_value(tags, 'EXIF FocalLength')
            focal_length = f"{format_rational(focal_length_raw)}mm" if focal_length_raw else ""

            aperture_raw = get_tag_value(tags, 'EXIF FNumber')
            aperture = f"f/{format_rational(aperture_raw)}" if aperture_raw else ""

            iso = get_tag_value(tags, 'EXIF ISOSpeedRatings')
            iso = f"ISO {iso}" if iso else ""
            
            shutter = format_shutter_speed(get_tag_value(tags, 'EXIF ExposureTime'))

            # Combine all data
            combined_data = {
                "src": image_path,
                "alt": photo_info["alt"],
                "preference": photo_info["preference"],
                "width": width,
                "height": height,
                "camera": camera or "Unknown Camera",
                "lens": lens or "Unknown Lens",
                "focalLength": focal_length,
                "shutterSpeed": shutter,
                "aperture": aperture,
                "iso": iso
            }
            all_photo_data.append(combined_data)
            print(f"- Processed: {image_path}")

    # Sort by preference before printing
    all_photo_data.sort(key=lambda p: p['preference'])

    # Print the final JSON
    print("\n\n✅ Metadata generation complete! Copy the array below and paste it into the `photoSources` variable in `photography.html`:\n")
    print(json.dumps(all_photo_data, indent=2))


if __name__ == "__main__":
    main() 