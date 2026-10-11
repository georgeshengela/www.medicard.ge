"""MEDISLEEP sound library: procedural soundscapes, rendered as seamless loops.

Nothing here is recorded or downloaded, so there is no licence to track. Every layer is built on a
circular timeline (FFT noise, LFOs with whole cycles per loop, events whose tails wrap to the start),
so the last sample flows into the first and the loop has no seam.

    py brand/sleep/sounds/synth.py            # every sound
    py brand/sleep/sounds/synth.py rain fan   # some
    py brand/sleep/sounds/synth.py --png      # also spectrogram PNGs for a visual check

Output: out/<id>.wav (float, 44.1 kHz stereo), out/<id>.m4a (AAC 128 kb/s, two-pass loudnorm to the
same loudness, so switching sounds never jumps in volume) and out/<id>-tail.m4a (the fade-out after the last loop).
"""
import json
import pathlib
import subprocess
import sys

import numpy as np
import scipy.signal as sg
import scipy.io.wavfile as wf

SR = 44100
OUT = pathlib.Path(__file__).parent / 'out'
TARGET_LUFS = -24.0   # quiet on purpose: these play while people fall asleep
TRUE_PEAK = -3.0


# ---------------------------------------------------------------- circular building blocks

def n_of(sec):
    return int(round(sec * SR))


def spectral_noise(rng, n, slope=0.0, lo=None, hi=None, ch=2):
    """Circular noise, power ~ f^slope (0 white, -1 pink, -2 brown), optional soft band edges."""
    out = np.empty((ch, n))
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    mag = f ** (slope / 2.0)
    if lo:
        mag = mag / np.sqrt(1 + (lo / f) ** 4)
    if hi:
        mag = mag / np.sqrt(1 + (f / hi) ** 4)
    for c in range(ch):
        spec = (rng.standard_normal(f.size) + 1j * rng.standard_normal(f.size)) * mag
        spec[0] = 0
        x = np.fft.irfft(spec, n)
        out[c] = x / (np.std(x) + 1e-12)
    return out


def band(rng, n, lo, hi, slope=-1.0, ch=2):
    return spectral_noise(rng, n, slope=slope, lo=lo, hi=hi, ch=ch)


def lfo(rng, n, max_hz, depth=1.0):
    """Smooth random curve in [-1, 1] with whole cycles over the loop (seamless)."""
    k = max(1, int(max_hz * n / SR))
    spec = np.zeros(n // 2 + 1, dtype=complex)
    w = 1.0 / np.arange(1, k + 1) ** 0.8
    spec[1:k + 1] = (rng.standard_normal(k) + 1j * rng.standard_normal(k)) * w
    x = np.fft.irfft(spec, n)
    x = x / (np.max(np.abs(x)) + 1e-12)
    return x * depth


def circ_sos(sos, x):
    """IIR filter applied circularly: run three copies, keep the middle (steady state)."""
    n = x.shape[-1]
    y = sg.sosfilt(sos, np.concatenate([x, x, x], axis=-1), axis=-1)
    return y[..., n:2 * n]


def lp(x, hz, order=2):
    return circ_sos(sg.butter(order, hz, 'low', fs=SR, output='sos'), x)


def hp(x, hz, order=2):
    return circ_sos(sg.butter(order, hz, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return circ_sos(sg.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def place(buf, start, ev, pan=0.0):
    """Add a mono event at `start`, wrapping its tail to the loop start. pan -1..1 (equal power)."""
    n = buf.shape[1]
    ev = np.asarray(ev)
    if ev.ndim == 1:
        a = np.pi / 4 * (pan + 1)
        ev = np.vstack([ev * np.cos(a), ev * np.sin(a)])
    m = ev.shape[1]
    start %= n
    end = start + m
    if end <= n:
        buf[:, start:end] += ev
    else:
        k = n - start
        buf[:, start:] += ev[:, :k]
        rest = ev[:, k:]
        while rest.shape[1] > 0:
            take = min(n, rest.shape[1])
            buf[:, :take] += rest[:, :take]
            rest = rest[:, take:]


def poisson_times(rng, n, rate_hz):
    count = rng.poisson(rate_hz * n / SR)
    return np.sort(rng.integers(0, n, count))


def damped_sine(f0, tau, dur, chirp=0.0, phase=0.0):
    t = np.arange(n_of(dur)) / SR
    f = f0 * (1 + chirp * t / max(tau, 1e-4))
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    return np.sin(ph) * np.exp(-t / tau)


def circ_reverb(rng, x, seconds=2.5, damp_hz=4000, wet=0.25):
    """Circular convolution with a synthetic stereo tail (decaying, darkening noise)."""
    n = x.shape[1]
    m = n_of(seconds)
    t = np.arange(m) / SR
    out = np.empty_like(x)
    for c in range(x.shape[0]):
        ir = rng.standard_normal(m) * np.exp(-6.9 * t / seconds)
        ir = sg.sosfilt(sg.butter(1, damp_hz, 'low', fs=SR, output='sos'), ir)
        ir /= np.sqrt(np.sum(ir ** 2)) + 1e-12
        pad = np.zeros(n)
        pad[:m] = ir
        y = np.fft.irfft(np.fft.rfft(x[c]) * np.fft.rfft(pad), n)
        out[c] = x[c] * (1 - wet) + y * wet * 1.0
    return out


def mix_to_stereo(*layers):
    return np.sum(layers, axis=0)


# ---------------------------------------------------------------- sounds

def rain_drops(rng, n, rate, f_lo, f_hi, tau_lo, tau_hi, amp_shape=2.2, chirp=(0.0, 0.0)):
    buf = np.zeros((2, n))
    for s in poisson_times(rng, n, rate):
        f0 = np.exp(rng.uniform(np.log(f_lo), np.log(f_hi)))
        tau = rng.uniform(tau_lo, tau_hi)
        amp = min(6.0, (rng.pareto(amp_shape) + 1) * 0.15)
        ev = damped_sine(f0, tau, tau * 6, chirp=rng.uniform(*chirp), phase=rng.uniform(0, 6.28)) * amp
        place(buf, s, ev, pan=rng.uniform(-0.9, 0.9))
    return buf


def s_rain(rng, sec=120, heavy=1.0):
    n = n_of(sec)
    bed = band(rng, n, 300, 7000, slope=-0.6) * (0.55 + 0.12 * lfo(rng, n, 0.08))
    ticks = rain_drops(rng, n, 900 * heavy, 2500, 9000, 0.0006, 0.002)
    drops = rain_drops(rng, n, 140 * heavy, 700, 2600, 0.003, 0.012, chirp=(0.05, 0.6))
    plops = rain_drops(rng, n, 9 * heavy, 280, 700, 0.01, 0.03, chirp=(0.1, 0.5))
    low = band(rng, n, 40, 400, slope=-2.0) * 0.35
    x = bed * 0.5 + ticks * 0.35 + drops * 0.55 + plops * 0.5 + low
    x = lp(x, 9000)
    return circ_reverb(rng, x, 1.2, 5000, 0.18)


def s_rain_window(rng, sec=120):
    n = n_of(sec)
    outside = lp(band(rng, n, 150, 5000, slope=-0.8), 1400) * (0.8 + 0.15 * lfo(rng, n, 0.06))
    glass = rain_drops(rng, n, 26, 1800, 5200, 0.002, 0.007, amp_shape=1.8, chirp=(-0.05, 0.25))
    taps = rain_drops(rng, n, 70, 3500, 8000, 0.0005, 0.0015)
    sill = rain_drops(rng, n, 4, 500, 1100, 0.008, 0.02, chirp=(0.1, 0.4))
    x = outside * 0.75 + glass * 0.6 + taps * 0.12 + sill * 0.5
    return circ_reverb(rng, lp(x, 8000), 0.9, 3500, 0.22)


def s_thunder(rng, sec=240):
    n = n_of(sec)
    rain = s_rain(rng, sec, heavy=1.25)
    rumble = np.zeros((2, n))
    starts = np.sort(rng.choice(np.arange(n_of(10), n - n_of(10)), size=4, replace=False))
    base = spectral_noise(rng, n_of(16), slope=-2.0, lo=25, hi=380, ch=1)[0]
    for s in starts:
        m = n_of(rng.uniform(9, 15))
        t = np.arange(m) / SR
        env = np.zeros(m)
        for _ in range(rng.integers(3, 7)):  # rolling sub-peaks
            c = rng.uniform(0.2, 0.45) * t[-1]
            w = rng.uniform(0.3, 1.1)
            env += rng.uniform(0.4, 1.0) * np.exp(-((t - c) / w) ** 2)
        env *= np.exp(-t / rng.uniform(3.0, 5.0)) * (1 - np.exp(-t / 0.25))
        env /= env.max()
        ev = base[:m] * env * rng.uniform(1.6, 2.4)
        place(rumble, s, lp(ev[None, :], 260)[0], pan=rng.uniform(-0.5, 0.5))
    rumble = circ_reverb(rng, rumble, 3.5, 900, 0.45)
    return rain + rumble


def s_ocean(rng, sec=180):
    n = n_of(sec)
    low = band(rng, n, 30, 380, slope=-1.8)
    bright = band(rng, n, 200, 3200, slope=-1.0)
    foam = band(rng, n, 1500, 9000, slope=-0.4)
    surge = np.zeros(n)
    wash = np.zeros(n)
    t = 0
    pans = []
    while t < sec:
        period = rng.uniform(8.5, 13.5)
        rise, fall = rng.uniform(2.6, 4.2), rng.uniform(4.5, 7.5)
        m = n_of(rise + fall)
        tt = np.arange(m) / SR
        env = np.where(tt < rise, 0.5 - 0.5 * np.cos(np.pi * tt / rise), np.exp(-(tt - rise) / (fall / 3)))
        place_mono(surge, n_of(t), env * rng.uniform(0.7, 1.0))
        wm = n_of(fall + 1.5)
        wt = np.arange(wm) / SR
        wenv = (1 - np.exp(-wt / 0.15)) * np.exp(-wt / rng.uniform(1.2, 2.2))
        place_mono(wash, n_of(t + rise * 0.92), wenv * rng.uniform(0.5, 0.9))
        pans.append(rng.uniform(-0.4, 0.4))
        t += period
    surge = np.clip(surge, 0, 1.2)
    fizz = 0.7 + 0.3 * lfo(rng, n, 12)
    x = low * (0.35 + 0.65 * surge) + bright * (surge ** 1.6) * 0.8 + foam * wash * fizz * 0.45
    x = x + band(rng, n, 20, 200, slope=-2.0) * 0.25
    return circ_reverb(rng, lp(x, 7000), 1.8, 2500, 0.2)


def place_mono(buf, start, ev):
    n = buf.shape[0]
    start %= n
    m = ev.shape[0]
    end = start + m
    if end <= n:
        buf[start:end] += ev
    else:
        k = n - start
        buf[start:] += ev[:k]
        buf[:end - n] += ev[k:]


def s_stream(rng, sec=120):
    n = n_of(sec)
    buf = np.zeros((2, n))
    for s in poisson_times(rng, n, 520):
        f0 = np.exp(rng.uniform(np.log(380), np.log(2600)))
        tau = np.clip(0.9 / f0 * rng.uniform(6, 14), 0.002, 0.02)
        amp = min(4.0, (rng.pareto(2.6) + 1) * 0.12) * (f0 / 1200) ** -0.3
        ev = damped_sine(f0, tau, tau * 5, chirp=rng.uniform(0.15, 0.7), phase=rng.uniform(0, 6.28)) * amp
        place(buf, s, ev, pan=rng.uniform(-0.8, 0.8))
    bed = band(rng, n, 180, 2800, slope=-0.9) * (0.6 + 0.2 * lfo(rng, n, 0.3))
    x = buf * 0.9 + bed * 0.35 + band(rng, n, 30, 250, slope=-2.0) * 0.2
    return circ_reverb(rng, lp(x, 6500), 1.0, 4000, 0.15)


def s_fire(rng, sec=120):
    n = n_of(sec)
    buf = np.zeros((2, n))
    for c in poisson_times(rng, n, 2.6):  # crackle clusters
        pan = rng.uniform(-0.7, 0.7)
        for _ in range(rng.integers(1, 9)):
            s = c + int(rng.exponential(0.018) * SR)
            m = n_of(rng.uniform(0.0004, 0.003))
            click = np.diff(rng.standard_normal(m + 1)) * np.exp(-np.arange(m) / (m / 3))
            place(buf, s, click * min(5.0, (rng.pareto(1.6) + 1) * 0.25), pan=pan + rng.uniform(-0.1, 0.1))
    for s in poisson_times(rng, n, 0.35):  # pops
        f0 = rng.uniform(900, 2400)
        ev = damped_sine(f0, 0.004, 0.03) + rng.standard_normal(n_of(0.03)) * np.exp(-np.arange(n_of(0.03)) / (SR * 0.005)) * 0.5
        place(buf, s, ev * rng.uniform(0.6, 1.4), pan=rng.uniform(-0.6, 0.6))
    flicker = 0.65 + 0.35 * lfo(rng, n, 1.5)
    roar = band(rng, n, 40, 320, slope=-1.8) * flicker * 0.55
    whoosh = band(rng, n, 120, 700, slope=-1.2) * (0.5 + 0.5 * lfo(rng, n, 0.4)) * 0.25
    hiss = band(rng, n, 2000, 6000, slope=-0.5) * 0.04
    x = buf * 0.8 + roar + whoosh + hiss
    return circ_reverb(rng, lp(x, 9000), 0.7, 5000, 0.12)


def s_wind(rng, sec=150):
    n = n_of(sec)
    gust = 0.55 + 0.45 * lfo(rng, n, 0.07)
    x = np.zeros((2, n))
    for centre, q, depth in ((180, 1.6, 1.0), (320, 2.2, 0.8), (520, 2.8, 0.55), (850, 3.5, 0.35)):
        layer = band(rng, n, centre / (1 + 1 / q), centre * (1 + 1 / q), slope=-1.0)
        x += layer * depth * (0.5 + 0.5 * lfo(rng, n, 0.12)) * gust
    leaves = band(rng, n, 1200, 5000, slope=-0.6) * (gust ** 2) * 0.12
    return circ_reverb(rng, x + leaves, 1.6, 3000, 0.2)


def s_forest(rng, sec=120):
    n = n_of(sec)
    leaves = band(rng, n, 700, 4500, slope=-0.8) * (0.5 + 0.5 * lfo(rng, n, 0.1)) * 0.25
    far = band(rng, n, 30, 300, slope=-2.0) * 0.2
    crickets = np.zeros((2, n))
    for k in range(5):
        fc = rng.uniform(3900, 5600)
        pan = rng.uniform(-0.9, 0.9)
        dist = rng.uniform(0.25, 1.0)
        period = rng.uniform(0.55, 1.3)
        pulses = rng.integers(2, 5)
        prate = rng.uniform(28, 42)
        pm = n_of(0.014)
        pulse = np.sin(2 * np.pi * fc * np.arange(pm) / SR) * np.hanning(pm)
        chirp_len = n_of(pulses / prate + 0.02)
        chirp = np.zeros(chirp_len)
        for p in range(pulses):
            place_mono(chirp, n_of(p / prate), pulse) if n_of(p / prate) + pm < chirp_len else None
        t = rng.uniform(0, period)
        while t < sec:
            if rng.random() > 0.12:  # crickets pause now and then
                place(crickets, n_of(t), chirp * dist * 0.22, pan=pan)
            t += period * rng.uniform(0.93, 1.07)
    x = leaves + far + crickets
    return circ_reverb(rng, x, 2.2, 6000, 0.3)


def s_white(rng, sec=90):
    return lp(spectral_noise(rng, n_of(sec), 0.0), 12000) * 0.7


def s_pink(rng, sec=90):
    return spectral_noise(rng, n_of(sec), -1.0, lo=30)


def s_brown(rng, sec=90):
    return spectral_noise(rng, n_of(sec), -2.0, lo=28, hi=2500)


def s_fan(rng, sec=90):
    n = n_of(sec)
    t = np.arange(n) / SR
    body = spectral_noise(rng, n, -1.6, lo=40, hi=1400) + spectral_noise(rng, n, -0.8, lo=300, hi=4500) * 0.25
    blade = 1 + 0.035 * np.sin(2 * np.pi * 26.0 * t)  # 26 Hz × 90 s = whole cycles
    hum = (np.sin(2 * np.pi * 100 * t) * 0.012 + np.sin(2 * np.pi * 200 * t) * 0.006)
    return body * blade + np.vstack([hum, hum])


def s_bowls(rng, sec=180):
    n = n_of(sec)
    buf = np.zeros((2, n))
    notes = [196.0, 220.0, 261.63, 293.66, 329.63, 392.0]
    ratios = [(1.0, 1.0), (2.76, 0.45), (5.40, 0.2), (8.93, 0.08)]
    t = 0.0
    while t < sec:
        f = rng.choice(notes) * rng.choice([0.5, 1.0])
        m = n_of(26)
        tt = np.arange(m) / SR
        ev = np.zeros(m)
        for r, a in ratios:
            beat = rng.uniform(0.3, 1.4)
            tau = 14.0 / r ** 0.65
            ev += a * np.exp(-tt / tau) * (np.sin(2 * np.pi * f * r * tt) + np.sin(2 * np.pi * (f * r + beat) * tt))
        ev *= (1 - np.exp(-tt / 0.004))
        place(buf, n_of(t), ev * rng.uniform(0.5, 0.9) * 0.3, pan=rng.uniform(-0.5, 0.5))
        t += rng.uniform(11, 19)
    drone = band(rng, n, 60, 400, slope=-2.0) * 0.04
    return circ_reverb(rng, buf + drone, 4.5, 3000, 0.45)


SOUNDS = {
    'rain': (s_rain, 11),
    'rain-window': (s_rain_window, 12),
    'thunder': (s_thunder, 13),
    'ocean': (s_ocean, 14),
    'stream': (s_stream, 15),
    'fire': (s_fire, 16),
    'wind': (s_wind, 17),
    'forest-night': (s_forest, 18),
    'white-noise': (s_white, 19),
    'pink-noise': (s_pink, 20),
    'brown-noise': (s_brown, 21),
    'fan': (s_fan, 22),
    'singing-bowls': (s_bowls, 23),
}


# ---------------------------------------------------------------- render + encode

def render(sid, png=False):
    fn, seed = SOUNDS[sid]
    rng = np.random.default_rng(seed)
    x = fn(rng)
    x = x - x.mean(axis=1, keepdims=True)
    x = x / (np.max(np.abs(x)) + 1e-12) * 0.9
    OUT.mkdir(parents=True, exist_ok=True)
    wav = OUT / f'{sid}.wav'
    wf.write(wav, SR, x.T.astype(np.float32))
    m4a = OUT / f'{sid}.m4a'
    measure = subprocess.run(
        ['ffmpeg', '-hide_banner', '-nostats', '-i', str(wav), '-af',
         f'loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA=11:print_format=json', '-f', 'null', '-'],
        capture_output=True, text=True, check=True).stderr
    stats = json.loads(measure[measure.rindex('{'):measure.rindex('}') + 1])
    af = (f"loudnorm=I={TARGET_LUFS}:TP={TRUE_PEAK}:LRA=11:linear=true:"
          f"measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}:"
          f"measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}")
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(wav), '-af', af, '-ar', str(SR),
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', str(m4a)], check=True)
    tail(m4a)
    dur = x.shape[1] / SR
    print(f'{sid:14s} {dur:6.1f}s  in {float(stats["input_i"]):6.1f} LUFS  -> {m4a.name} {m4a.stat().st_size / 1e6:.2f} MB')
    if png:
        spectrogram(sid, x)


def tail(m4a, seconds=45, fade=40):
    """<id>-tail.m4a: the loop's own first seconds fading to silence. Played once after the last repeat, it carries
    on seamlessly from the loop end, so the sleep timer ends softly even where the app cannot run a JS fade
    (Android pauses JS timers in the background)."""
    dest = m4a.with_name(m4a.stem + '-tail.m4a')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(m4a), '-t', str(seconds), '-af',
                    f'afade=t=out:st={seconds - fade}:d={fade}:curve=qsin', '-c:a', 'aac', '-b:a', '128k',
                    '-movflags', '+faststart', str(dest)], check=True)


def spectrogram(sid, x):
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    seg = x[0, :n_of(20)]
    f, t, s = sg.spectrogram(seg, SR, nperseg=2048, noverlap=1536)
    fig, ax = plt.subplots(figsize=(10, 3.2), dpi=90)
    ax.pcolormesh(t, f, 10 * np.log10(s + 1e-12), shading='auto', vmin=-120, vmax=-40, cmap='magma')
    ax.set_ylim(0, 12000)
    ax.set_title(sid)
    fig.tight_layout()
    fig.savefig(OUT / f'{sid}.png')
    plt.close(fig)


if __name__ == '__main__':
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    for sid in args or SOUNDS:
        render(sid, png='--png' in sys.argv)
