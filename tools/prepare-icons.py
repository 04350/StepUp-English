#!/usr/bin/env python3
"""Prepare StepUp English icons from the exact image published on OgenPlay."""

from __future__ import annotations

from hashlib import sha256
from io import BytesIO
from pathlib import Path
from urllib.request import Request, urlopen

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parents[1]
ICON_SOURCE = (
    "https://ogenplay.com/api/cdn/icons/"
    "028544e8-1c1e-4807-a566-c8aa948c3f3d/"
    "aabc6c21-252b-4602-b439-f9cdf449f7ae-__________2026-11-16_195601.png"
)
ICON_OPTIMIZED = (
    "https://ogenplay.com/_next/image?q=75&url="
    "%2Fapi%2Fcdn%2Ficons%2F028544e8-1c1e-4807-a566-c8aa948c3f3d"
    "%2Faabc6c21-252b-4602-b439-f9cdf449f7ae-__________2026-11-16_195601.png"
    "&w=3840"
)
ANDROID_DENSITIES = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]


def fetch_icon() -> tuple[bytes, str]:
    errors: list[str] = []
    for url in (ICON_SOURCE, ICON_OPTIMIZED):
        request = Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; StepUpEnglishIconBuilder/1.0)",
                "Accept": "image/png,image/*;q=0.9,*/*;q=0.5",
                "Referer": "https://ogenplay.com/apps/com.stepupenglish.app",
            },
        )
        try:
            with urlopen(request, timeout=60) as response:
                data = response.read(20 * 1024 * 1024 + 1)
                if len(data) > 20 * 1024 * 1024:
                    raise ValueError("icon download exceeded 20 MiB")
                if len(data) < 128:
                    raise ValueError(f"response was too small ({len(data)} bytes)")
                with Image.open(BytesIO(data)) as candidate:
                    candidate.verify()
                return data, url
        except Exception as exc:
            errors.append(f"{url}: {type(exc).__name__}: {exc}")
    raise RuntimeError("Could not download the OgenPlay icon:\n" + "\n".join(errors))


def main() -> None:
    raw, source_url = fetch_icon()
    with Image.open(BytesIO(raw)) as source:
        source.load()
        icon = source.convert("RGBA")
    side = min(icon.width, icon.height)
    if icon.width != icon.height:
        left = (icon.width - side) // 2
        top = (icon.height - side) // 2
        icon = icon.crop((left, top, left + side, top + side))

    master = ImageOps.fit(icon, (1024, 1024), method=Image.Resampling.LANCZOS)
    master_path = ROOT / "build-assets" / "StepUp-English-icon.png"
    master_path.parent.mkdir(parents=True, exist_ok=True)
    master.save(master_path, format="PNG", optimize=True)

    for folder, size in ANDROID_DENSITIES.items():
        destination = ROOT / "android" / "app" / "src" / "main" / "res" / folder / "ic_launcher.png"
        destination.parent.mkdir(parents=True, exist_ok=True)
        master.resize((size, size), Image.Resampling.LANCZOS).save(
            destination, format="PNG", optimize=True
        )

    ico_path = ROOT / "desktop" / "StepUp-English.ico"
    master.save(ico_path, format="ICO", sizes=ICO_SIZES)

    print(f"Downloaded OgenPlay icon: {len(raw):,} bytes; sha256={sha256(raw).hexdigest()}")
    print(f"Source: {source_url}")
    print(f"Source dimensions: {icon.width}x{icon.height}")
    print(f"Generated Android mipmap icons: {len(ANDROID_DENSITIES)} densities")
    print(f"Generated Windows ICO: {ico_path} ({ico_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
