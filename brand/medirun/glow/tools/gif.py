# Assemble the ignition frames into a looping GIF: python gif.py shots/ignite out.gif [ms=300] [width=468]
import sys, glob
from PIL import Image

src, out = sys.argv[1], sys.argv[2]
ms = int(sys.argv[3]) if len(sys.argv) > 3 else 300
width = int(sys.argv[4]) if len(sys.argv) > 4 else 468
files = sorted(glob.glob(f'{src}/f*.png'))
frames = []
for f in files:
    im = Image.open(f).convert('RGB')
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    frames.append(im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG))
durations = [ms] * len(frames)
durations[-1] = ms * 4          # hold the lit result before the loop restarts
frames[0].save(out, save_all=True, append_images=frames[1:], duration=durations, loop=0, optimize=False)
print('saved', out, len(frames), 'frames', frames[0].size)
