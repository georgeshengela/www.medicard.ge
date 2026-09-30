"""Launch posters — photographic backgrounds (no text) via the ad studio's OpenRouter image model.

python gen.py [id ...]   -> photos/<id>.png
"""
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'ad' / 'studio'))
from studio import gen_image  # noqa: E402

STYLE = (
    'Photorealistic editorial photograph, shot on a full-frame camera with a 50mm lens, natural light, '
    'true-to-life skin texture, subtle film grain, soft teal and warm amber colour grade. '
    'Absolutely no text, no letters, no logos, no watermarks, no visible phone screen content. '
)

SHOTS = {
    'feed': ('4:5', STYLE +
             'Golden hour in Tbilisi Old Town: a Georgian woman in her late twenties sits at a small cafe table on a '
             'street with carved wooden balconies, holding a smartphone loosely in one hand (screen turned away from the '
             'camera), relaxed genuine smile, looking slightly off-camera. A glass of water and a small plate of fresh '
             'fruit on the table. Warm backlight, shallow depth of field, calm and hopeful mood. Framed from a slightly low '
             'angle so the soft evening sky and blurred balconies fill the top of the frame naturally. One single, '
             'continuous, seamless photograph — no split panels, no borders, no collage, no duplicated areas.'),
    'square': ('1:1', STYLE +
               'Top-down still life on a light oak kitchen table in soft morning window light: a weekly pill organizer, '
               'a tall glass of water with condensation, a bowl of colourful salad, a folded blood-test result sheet '
               '(no readable text), a pair of running shoes at the edge of the frame and a smartphone lying face down. '
               'Clean, airy, premium lifestyle composition with generous empty space in the centre-left.'),
    'story': ('9:16', STYLE +
              'Sunrise run in Tbilisi: a young Georgian man and woman jogging side by side along the Mtkvari river '
              'embankment, the old town and Narikala fortress softly blurred behind them, sun flare, dynamic motion, '
              'joyful energetic expressions, athletic clothes in teal and white. Vertical frame; the top 40% is open '
              'morning sky with gentle haze for text.'),
    'wide': ('16:9', STYLE +
             'Wide cinematic view of Tbilisi at blue hour just before sunrise, seen from a hillside: the Mtkvari river, '
             'Old Town rooftops, Narikala fortress and first warm light on the horizon, a few city lights still on, '
             'light mist. Calm, optimistic, premium. The city and fortress sit in the right half; the left half shows the '
             'same continuous landscape fading into soft morning haze and sky. One single seamless photograph — no '
             'split panels, no solid colour areas, no borders, no people.'),
}


def main():
    ids = sys.argv[1:] or list(SHOTS)
    out = HERE / 'photos'
    out.mkdir(exist_ok=True)
    for sid in ids:
        aspect, prompt = SHOTS[sid]
        dest = out / f'{sid}.png'
        print('generating', sid, aspect, flush=True)
        gen_image(prompt, dest, aspect=aspect)
        print('saved', dest, flush=True)


if __name__ == '__main__':
    main()
