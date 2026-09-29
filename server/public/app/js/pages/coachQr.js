// MEDICARD web — minimal QR encoder (byte mode, error correction M, versions 1–10) for the trainer's
// invite link. Pure: no DOM, no dependency (the app uses qrcode-generator; the web has no bundler).
// Verified in Node against a real decoder (zxing-wasm) for every mask and version.

const EC_M = [null, [10, 1], [16, 1], [26, 1], [18, 2], [24, 2], [16, 4], [18, 4], [22, 4], [22, 5], [26, 5]];
const TOTAL = [null, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

/* GF(256), poly 0x11D */
const EXP = new Array(512);
const LOG = new Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const gmul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rsGenerator(deg) {
  let g = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= gmul(g[j], EXP[i]); }
    g = next;
  }
  return g;
}

function rsRemainder(data, deg) {
  const gen = rsGenerator(deg);
  const res = new Array(deg).fill(0);
  for (const b of data) {
    const factor = b ^ res.shift();
    res.push(0);
    for (let i = 0; i < deg; i++) res[i] ^= gmul(gen[i + 1], factor);
  }
  return res;
}

function bch(value, poly, polyDeg) {
  let v = value << polyDeg;
  const top = (n) => { let d = 0; while (n) { d++; n >>>= 1; } return d; };
  while (top(v) - top(poly) >= 0) v ^= poly << (top(v) - top(poly));
  return (value << polyDeg) | v;
}

const MASKS = [
  (i, j) => (i + j) % 2 === 0,
  (i) => i % 2 === 0,
  (_i, j) => j % 3 === 0,
  (i, j) => (i + j) % 3 === 0,
  (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0,
  (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0,
  (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0,
  (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0,
];

function utf8(text) {
  if (typeof TextEncoder !== 'undefined') return [...new TextEncoder().encode(text)];
  return [...unescape(encodeURIComponent(text))].map((c) => c.charCodeAt(0));
}

function codewords(bytes, version) {
  const [ecPer, blocks] = EC_M[version];
  const dataTotal = TOTAL[version] - ecPer * blocks;
  const bits = [];
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  put(0b0100, 4);
  put(bytes.length, version >= 10 ? 16 : 8);
  bytes.forEach((b) => put(b, 8));
  if (bits.length + 4 <= dataTotal * 8) put(0, 4);
  while (bits.length % 8) bits.push(0);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  for (let pad = 0xec; data.length < dataTotal; pad = pad === 0xec ? 0x11 : 0xec) data.push(pad);

  const short = Math.floor(dataTotal / blocks);
  const longCount = dataTotal % blocks;
  const dataBlocks = [];
  const ecBlocks = [];
  let off = 0;
  for (let b = 0; b < blocks; b++) {
    const len = short + (b >= blocks - longCount ? 1 : 0);
    const chunk = data.slice(off, off + len);
    off += len;
    dataBlocks.push(chunk);
    ecBlocks.push(rsRemainder(chunk, ecPer));
  }
  const out = [];
  for (let i = 0; i <= short; i++) dataBlocks.forEach((blk) => { if (i < blk.length) out.push(blk[i]); });
  for (let i = 0; i < ecPer; i++) ecBlocks.forEach((blk) => out.push(blk[i]));
  return out;
}

function build(version, data, mask) {
  const n = version * 4 + 17;
  const m = Array.from({ length: n }, () => new Array(n).fill(null));
  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || rr >= n || cc < 0 || cc >= n) continue;
        m[rr][cc] = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6)) || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      }
    }
  };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  const pos = ALIGN[version];
  for (const r of pos) {
    for (const c of pos) {
      if (m[r][c] !== null) continue;
      for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) m[r + dr][c + dc] = dr === -2 || dr === 2 || dc === -2 || dc === 2 || (dr === 0 && dc === 0);
    }
  }
  for (let i = 8; i < n - 8; i++) {
    if (m[i][6] === null) m[i][6] = i % 2 === 0;
    if (m[6][i] === null) m[6][i] = i % 2 === 0;
  }
  // Format info (EC level M = 00).
  const fmt = bch(mask, 0x537, 10) ^ 0x5412;
  for (let i = 0; i < 15; i++) {
    const bit = ((fmt >> i) & 1) === 1;
    if (i < 6) m[i][8] = bit; else if (i < 8) m[i + 1][8] = bit; else m[n - 15 + i][8] = bit;
    if (i < 8) m[8][n - i - 1] = bit; else if (i < 9) m[8][15 - i] = bit; else m[8][14 - i] = bit;
  }
  m[n - 8][8] = true;
  if (version >= 7) {
    const v = bch(version, 0x1f25, 12);
    for (let i = 0; i < 18; i++) {
      const bit = ((v >> i) & 1) === 1;
      m[Math.floor(i / 3)][(i % 3) + n - 11] = bit;
      m[(i % 3) + n - 11][Math.floor(i / 3)] = bit;
    }
  }
  const fn = MASKS[mask];
  let inc = -1;
  let row = n - 1;
  let bitIndex = 7;
  let byteIndex = 0;
  for (let col = n - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1;
    for (;;) {
      for (let c = 0; c < 2; c++) {
        if (m[row][col - c] === null) {
          let dark = byteIndex < data.length ? ((data[byteIndex] >>> bitIndex) & 1) === 1 : false;
          if (fn(row, col - c)) dark = !dark;
          m[row][col - c] = dark;
          bitIndex -= 1;
          if (bitIndex === -1) { byteIndex += 1; bitIndex = 7; }
        }
      }
      row += inc;
      if (row < 0 || row >= n) { row -= inc; inc = -inc; break; }
    }
  }
  return m;
}

function penalty(m) {
  const n = m.length;
  let score = 0;
  const runs = (get) => {
    for (let a = 0; a < n; a++) {
      let run = 1;
      for (let b = 1; b < n; b++) {
        if (get(a, b) === get(a, b - 1)) run++;
        else { if (run >= 5) score += 3 + run - 5; run = 1; }
      }
      if (run >= 5) score += 3 + run - 5;
    }
  };
  runs((a, b) => m[a][b]);
  runs((a, b) => m[b][a]);
  for (let r = 0; r < n - 1; r++) {
    for (let c = 0; c < n - 1; c++) {
      const v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) score += 3;
    }
  }
  const pat = [true, false, true, true, true, false, true];
  const finderLike = (get) => {
    for (let a = 0; a < n; a++) {
      for (let b = 0; b + 7 <= n; b++) {
        if (!pat.every((p, k) => get(a, b + k) === p)) continue;
        const before = b >= 4 && [1, 2, 3, 4].every((k) => get(a, b - k) === false);
        const after = b + 11 <= n && [7, 8, 9, 10].every((k) => get(a, b + k) === false);
        if (before || after) score += 40;
      }
    }
  };
  finderLike((a, b) => m[a][b]);
  finderLike((a, b) => m[b][a]);
  let dark = 0;
  for (const r of m) for (const v of r) if (v) dark++;
  score += Math.floor(Math.abs((dark * 100) / (n * n) - 50) / 5) * 10;
  return score;
}

/**
 * qrMatrix('https://medicard.ge/c/ABC234') → boolean[][] (true = dark), or null when the text is too long
 * for version 10-M. `opts.mask` forces a mask pattern (tests only).
 */
export function qrMatrix(text, opts = {}) {
  const bytes = utf8(String(text ?? ''));
  let version = 0;
  for (let v = 1; v <= 10; v++) {
    const [ecPer, blocks] = EC_M[v];
    const capBits = (TOTAL[v] - ecPer * blocks) * 8;
    if (4 + (v >= 10 ? 16 : 8) + bytes.length * 8 <= capBits) { version = v; break; }
  }
  if (!version) return null;
  const data = codewords(bytes, version);
  if (Number.isInteger(opts.mask)) return build(version, data, opts.mask);
  let best = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const m = build(version, data, mask);
    const sc = penalty(m);
    if (sc < bestScore) { bestScore = sc; best = m; }
  }
  return best;
}
