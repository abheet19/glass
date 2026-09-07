"""tools/assemble_gif.py — turns docs/demo/.frames/ into docs/demo/glass-demo.gif.

Run tools/record-demo.mjs first; this only assembles.

    node tools/record-demo.mjs
    python tools/assemble_gif.py

Two things keep the file small on a flat, dark UI:
  * one shared 256-colour palette for the whole GIF, so frames can be diffed
    against each other instead of each carrying its own colour table;
  * dithering OFF. Floyd-Steinberg noise is per-pixel and uncorrelated between
    frames, which defeats GIF's inter-frame compression entirely — on a sibling
    project the same clip went 7.99 MB dithered to 2.64 MB undithered, with no
    visible difference on flat surfaces.
"""
import json
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parent.parent
FRAMES = ROOT / "docs" / "demo" / ".frames"
OUT = ROOT / "docs" / "demo" / "glass-demo.gif"

manifest = json.loads((FRAMES / "frames.json").read_text())
width = manifest["width"]

images, holds = [], []
for f in manifest["frames"]:
    im = Image.open(FRAMES / f["file"]).convert("RGB")
    h = round(im.height * width / im.width)
    images.append(im.resize((width, h), Image.LANCZOS))
    holds.append(f["hold"])

# One palette derived from every frame, so no frame gets its own colour table.
strip = Image.new("RGB", (width, sum(i.height for i in images)))
y = 0
for im in images:
    strip.paste(im, (0, y))
    y += im.height
palette = strip.quantize(colors=256, method=Image.MEDIANCUT, dither=Image.Dither.NONE)

quantized = [im.quantize(palette=palette, dither=Image.Dither.NONE) for im in images]

quantized[0].save(
    OUT,
    save_all=True,
    append_images=quantized[1:],
    duration=holds,
    loop=0,
    optimize=True,
    disposal=1,
)

kb = OUT.stat().st_size / 1024
print(f"  {OUT.relative_to(ROOT)}  {images[0].width}x{images[0].height}  "
      f"{len(quantized)} frames  {sum(holds)/1000:.1f}s  {kb/1024:.2f} MB")
