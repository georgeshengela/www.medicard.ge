"""MEDIFOOD „რას მიირთმევ?“ hero concepts via the ad studio's OpenRouter image call (Nano Banana Pro, ~$0.14 each).

  python gen.py            -> concept_a.png, concept_b.png, concept_c.png
  python gen.py b          -> only concept b

Style brief from the owner (2026-10-09): as refined as the MEDIRUN Tbilisi glow poster — cinematic 3D render,
tilt-shift miniature, dusk light, warm amber practicals, one glowing mint line. Never vector clip-art.
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parents[1] / 'ad' / 'studio'))
from studio import gen_image  # noqa: E402

STYLE = (
    ' Cinematic photoreal 3D render, miniature tilt-shift photography, shallow depth of field, soft moody blue-hour light,'
    ' deep dark slate and teal surroundings, warm amber practical lights, one single glowing mint-green (#6EE7B7) neon accent'
    ' with soft bloom, premium, calm, refined, realistic materials and food textures. No text, no letters, no logos, no people, no hands.'
)
CONCEPTS = {
    'a': 'Three-quarter overhead view of a matte stone-white ceramic plate on a dark walnut table at dusk. On the plate a beautifully'
         ' plated balanced meal: half fresh leafy greens with cherry tomatoes and cucumber, a quarter grilled salmon fillet with a lemon wedge,'
         ' a quarter wild rice. A thin glowing mint-green neon ring floats just above the plate rim like a gentle scan, its light reflecting'
         ' on the table; warm amber light from one side, the rest of the table falls into darkness.',
    'b': 'A balanced meal on a round plate shown as a miniature night diorama seen from above at an angle: leafy greens like a tiny park,'
         ' a salmon fillet like a warm-lit landmark, rice like a quarter of tiny pale houses, cherry tomatoes glowing softly like lanterns.'
         ' A glowing mint-green neon path winds across the plate between the foods, exactly like a lit running route through a dark city,'
         ' with a tiny glowing mint runner figure at its start. The plate sits on a dark slate table that fades into blue darkness.',
    'c': 'Top-down view of a balanced meal in a shallow dark-glazed ceramic bowl on black slate: greens, avocado slices, salmon, quinoa,'
         ' cherry tomatoes, sesame. A delicate glowing mint-green scan line sweeps horizontally across the food leaving a faint glow,'
         ' and four thin glowing mint corner brackets frame the bowl like a camera viewfinder. Warm amber rim light, everything else dark.',
}

if __name__ == '__main__':
    picks = sys.argv[1:] or list(CONCEPTS)
    for k in picks:
        gen_image(CONCEPTS[k] + STYLE, HERE / f'concept_{k}.png', aspect='4:3')
