"""MEDISLEEP wake-up sound: soft bells that rise from a whisper (≤ 30 s — the iOS notification / alarm limit).

    py brand/sleep/sounds/alarm.py   -> mobile/assets/sleep/medisleep_dawn.wav (44.1 kHz, 16-bit, mono)

Used by AlarmKit (main bundle, via the expo-notifications `sounds` plugin option) and by the notification fallback
(iOS sound + Android raw resource of the same name).
"""
import pathlib
import numpy as np
import scipy.io.wavfile as wf

SR = 44100
SECONDS = 26
OUT = pathlib.Path(__file__).resolve().parents[3] / 'mobile' / 'assets' / 'sleep' / 'medisleep_dawn.wav'

# C major pentatonic, a slow rising-and-settling figure (C5 E5 G5 A5 C6 A5 G5 E5).
NOTES = [523.25, 659.25, 783.99, 880.00, 1046.50, 880.00, 783.99, 659.25]
STEP = 0.42          # seconds between bells
PHRASE_GAP = 1.1     # breath between phrases


def bell(freq, dur=3.2):
    t = np.arange(int(SR * dur)) / SR
    partials = [(1.0, 1.0, 1.6), (2.0, 0.35, 0.9), (3.01, 0.18, 0.55), (4.2, 0.07, 0.35)]
    out = np.zeros_like(t)
    for ratio, amp, tau in partials:
        out += amp * np.sin(2 * np.pi * freq * ratio * t) * np.exp(-t / tau)
    out *= 1 - np.exp(-t / 0.004)
    return out


def main():
    n = SR * SECONDS
    x = np.zeros(n)
    at = 0.4
    while at < SECONDS - 3.5:
        for f in NOTES:
            start = int(at * SR)
            b = bell(f)
            end = min(n, start + len(b))
            x[start:end] += b[: end - start]
            at += STEP
        at += PHRASE_GAP
    t = np.arange(n) / SR
    # A warm pad under it, and the whole thing rising from very quiet to full over ~20 s.
    pad = 0.06 * (np.sin(2 * np.pi * 261.63 * t) + 0.6 * np.sin(2 * np.pi * 392.0 * t)) * (0.5 + 0.5 * np.sin(2 * np.pi * 0.15 * t))
    rise = np.clip(0.12 + 0.88 * (t / 20.0) ** 1.6, 0, 1)
    tail = np.clip((SECONDS - t) / 1.5, 0, 1)
    y = (x * 0.55 + pad) * rise * tail
    y = y / np.max(np.abs(y)) * 0.89
    OUT.parent.mkdir(parents=True, exist_ok=True)
    wf.write(OUT, SR, (y * 32767).astype(np.int16))
    print(OUT, f'{OUT.stat().st_size / 1e6:.2f} MB')


if __name__ == '__main__':
    main()
