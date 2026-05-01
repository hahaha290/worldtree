from pathlib import Path


IMAGE_DIR = Path(__file__).resolve().parent / "assets" / "images"
MANIFEST_PATH = IMAGE_DIR / "image-manifest.js"
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}


def main() -> None:
    image_files = sorted(
        file.name
        for file in IMAGE_DIR.iterdir()
        if file.is_file() and file.suffix.lower() in ALLOWED_EXTENSIONS
    )

    manifest_lines = ["window.IMAGE_SOURCES = ["]
    manifest_lines.extend(f'  "./assets/images/{name}",' for name in image_files)
    manifest_lines.append("];")
    MANIFEST_PATH.write_text("\n".join(manifest_lines) + "\n", encoding="utf-8")
    print(f"Updated image manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
