"""Campaign photos (no text) via the ad studio's OpenRouter image model. python gen.py [id ...]"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'ad' / 'studio'))
from studio import gen_image  # noqa: E402

STYLE = (
    'Photorealistic editorial photograph, full-frame camera, 50mm lens, natural light, true-to-life skin texture, '
    'subtle film grain, soft teal and warm amber colour grade. One single seamless photograph — no split panels, no '
    'borders, no collage. Absolutely no text, letters, logos or watermarks, and no readable phone or laptop screen content. '
)

SHOTS = {
    'meds': 'Morning in a bright Tbilisi apartment kitchen: a Georgian man in his forties in a knitted sweater takes a '
            'small pill with a glass of water, a weekly pill organizer on the wooden table, his smartphone beside it '
            'screen-down, sunlight through linen curtains, calm and caring mood. Leave soft uncluttered space in the upper part.',
    'lab': 'A Georgian woman in her thirties sits by a window with a cup of tea, holding a printed blood test result sheet '
           '(no readable text) and looking at it with relief and a slight smile, smartphone in her other hand screen turned '
           'away, cozy apartment, soft daylight.',
    'walk': 'Late afternoon in Tbilisi\'s Mtatsminda park area: a young Georgian couple walking briskly and laughing on a tree '
            'lined path with the city softly visible below, autumn leaves, golden light, energetic and happy.',
    'dog': 'A Georgian woman in her late twenties kneels in a Tbilisi park in autumn hugging her happy golden retriever, '
           'warm sunlight, genuine joy, shallow depth of field.',
    'coach': 'Modern bright gym in Tbilisi: a fit Georgian personal trainer in his thirties encourages a woman client doing '
             'a kettlebell exercise, both smiling, motivating atmosphere, clean equipment, natural window light.',
    'family': 'Warm living room in a Georgian home: a young woman sits on the sofa next to her elderly mother, showing her '
              'something on a smartphone (screen turned away), both smiling, knitted blanket, soft lamp light and daylight, '
              'tender family moment.',
    'laptop': 'A Georgian man in his late twenties works at a wooden desk by a large window in a bright Tbilisi apartment, '
              'laptop open (screen angled away from camera), a smartphone and a glass of water on the desk, plants, relaxed '
              'focused expression, morning light.',
}


def main():
    out = HERE / 'photos'
    out.mkdir(exist_ok=True)
    for sid in sys.argv[1:] or list(SHOTS):
        print('generating', sid, flush=True)
        gen_image(STYLE + SHOTS[sid], out / f'{sid}.png', aspect='4:5')


if __name__ == '__main__':
    main()
