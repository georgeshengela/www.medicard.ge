import type { LabExtract, LabFlag, LabParameter } from '@/types/lab';

const ALIASES: Record<string, string> = {
  hemoglobin: 'hemoglobin',
  hgb: 'hemoglobin',
  hb: 'hemoglobin',
  wbc: 'wbc',
  leukocytes: 'wbc',
  rbc: 'rbc',
  erythrocytes: 'rbc',
  hct: 'hct',
  hematocrit: 'hct',
  plt: 'plt',
  platelets: 'plt',
  glucose: 'glucose',
  creatinine: 'creatinine',
  urea: 'urea',
  alt: 'alt',
  alat: 'alt',
  ast: 'ast',
  asat: 'ast',
  tsh: 'tsh',
  cholesterol: 'cholesterol',
  'total cholesterol': 'cholesterol',
  'cholesterol total': 'cholesterol',
  totalcholesterol: 'cholesterol',
  chol: 'cholesterol',
  tc: 'cholesterol',
  ldl: 'ldl',
  'ldl c': 'ldl',
  'ldl cholesterol': 'ldl',
  ldlc: 'ldl',
  hdl: 'hdl',
  'hdl c': 'hdl',
  'hdl cholesterol': 'hdl',
  hdlc: 'hdl',
  triglycerides: 'triglycerides',
  triglyceride: 'triglycerides',
  trigly: 'triglycerides',
  tg: 'triglycerides',
  ferritin: 'ferritin',
  vitamin_d: 'vitamin_d',
  'vitamin d': 'vitamin_d',
  '25-oh': 'vitamin_d',
  '\u10f0\u10d4\u10db\u10dd\u10d2\u10da\u10dd\u10d1\u10d8\u10dc\u10d8': 'hemoglobin',
  '\u10da\u10d4\u10d8\u10d9\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8': 'wbc',
  '\u10d4\u10e0\u10d8\u10d7\u10e0\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8': 'rbc',
  '\u10f0\u10d4\u10db\u10d0\u10e2\u10dd\u10d9\u10e0\u10d8\u10e2\u10d8': 'hct',
  '\u10d7\u10e0\u10dd\u10db\u10d1\u10dd\u10ea\u10d8\u10e2\u10d4\u10d1\u10d8': 'plt',
  '\u10d2\u10da\u10e3\u10d9\u10dd\u10d6\u10d0': 'glucose',
  '\u10d9\u10e0\u10d4\u10d0\u10e2\u10d8\u10dc\u10d8\u10dc\u10d8': 'creatinine',
  '\u10e8\u10d0\u10e0\u10d3\u10d8': 'urea',
  '\u10e5\u10dd\u10da\u10d4\u10e1\u10e2\u10d4\u10e0\u10d8\u10dc\u10d8': 'cholesterol',
  '\u10e1\u10d0\u10d4\u10e0\u10d7\u10dd \u10e5\u10dd\u10da\u10d4\u10e1\u10e2\u10d4\u10e0\u10d8\u10dc\u10d8': 'cholesterol',
  '\u10e5\u10dd\u10da\u10d4\u10e1\u10e2\u10d4\u10e0\u10d8\u10dc\u10d8 \u10e1\u10d0\u10d4\u10e0\u10d7\u10dd': 'cholesterol',
  '\u10e2\u10e0\u10d8\u10d2\u10da\u10d8\u10ea\u10d4\u10e0\u10d8\u10d3\u10d4\u10d1\u10d8': 'triglycerides',
  '\u10e4\u10d4\u10e0\u10d8\u10e2\u10d8\u10dc\u10d8': 'ferritin',
  hemoglobine: 'hemoglobin',
  hematocrite: 'hct',
  'globules rouges': 'rbc',
  'globules blancs': 'wbc',
  plaquettes: 'plt',
  creatinine: 'creatinine',
  uree: 'urea',
  tgp: 'alt',
  crp: 'crp',
  'gamma gt': 'ggt',
};


export function slugLabKey(raw: string): string {
  const compact = raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[.*?\]/g, ' ')
    .replace(/[^a-z0-9\u10A0-\u10FF\u0400-\u04FF]+/gi, ' ')
    .trim();
  const first = compact.split(/\s+/)[0] ?? compact;
  const aliased = ALIASES[compact] ?? (compact.includes(' ') ? undefined : ALIASES[first]);
  return aliased || compact.replace(/\s+/g, '_').slice(0, 48) || 'analyte';
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseRange(raw: string): { low: number | null; high: number | null } {
  const text = raw.replace(',', '.');
  const match = text.match(/(-?[\d.]+)\s*[-–—]\s*(-?[\d.]+)/);
  if (match) return { low: parseNumber(match[1]), high: parseNumber(match[2]) };
  const maxOnly = text.match(/^\s*[-–—<≤]\s*(-?[\d.]+)\s*$/);
  if (maxOnly) return { low: null, high: parseNumber(maxOnly[1]) };
  const minOnly = text.match(/^(-?[\d.]+)\s*[-–—>≥]\s*$/);
  if (minOnly) return { low: parseNumber(minOnly[1]), high: null };
  const lt = text.match(/[≤<]\s*(-?[\d.]+)/);
  if (lt) return { low: null, high: parseNumber(lt[1]) };
  const gt = text.match(/[≥>]\s*(-?[\d.]+)/);
  if (gt) return { low: parseNumber(gt[1]), high: null };
  return { low: null, high: null };
}

function flagFrom(raw: string, value: number, low: number | null, high: number | null): LabFlag {
  const letter = raw.trim().toUpperCase();
  if (letter.startsWith('H') || letter.includes('HIGH') || letter.includes('↑')) return 'H';
  if (letter.startsWith('L') || letter.includes('LOW') || letter.includes('↓')) return 'L';
  if (letter.startsWith('N') || letter.includes('NORM')) return 'N';
  if (low != null && value < low) return 'L';
  if (high != null && value > high) return 'H';
  if (low != null || high != null) return 'N';
  return 'U';
}

function splitName(raw: string): { nameKa: string; nameEn: string } {
  const bracket = raw.match(/^(.*?)\s*[(\[]([^)\]]+)[)\]]\s*$/);
  if (bracket) {
    const left = bracket[1].trim();
    const inner = bracket[2].trim();
    const leftIsLatin = /^[A-Za-z0-9]/.test(left);
    return leftIsLatin ? { nameKa: inner, nameEn: left } : { nameKa: left, nameEn: inner };
  }
  return { nameKa: raw.trim(), nameEn: raw.trim() };
}

function toParam(input: {
  name: string;
  valueRaw: string;
  unit: string;
  range: string;
  flagRaw: string;
}): LabParameter | null {
  if (/unread|illegib/i.test(input.valueRaw)) return null;
  const value = parseNumber(input.valueRaw);
  if (value == null) return null;
  const { low, high } = parseRange(input.range);
  const names = splitName(input.name);
  return {
    key: slugLabKey(names.nameEn || names.nameKa),
    nameKa: names.nameKa || names.nameEn,
    nameEn: names.nameEn || names.nameKa,
    value,
    display: input.valueRaw.trim() || String(value),
    unit: input.unit.trim(),
    refLow: low,
    refHigh: high,
    flag: flagFrom(input.flagRaw, value, low, high),
  };
}

function tidyUnit(unit: string): string {
  const u = unit.replace(/\s+/g, '');
  if (!u) return '';
  if (u === '%%') return '%';
  if (u === 'ss') return 's';
  const lower = u.toLowerCase();
  const half = Math.floor(u.length / 2);
  if (half >= 2 && lower.slice(0, half) === lower.slice(half)) return u.slice(half);
  return u;
}

function parseDotSeparatedLab(text: string): LabParameter[] {
  const rows: LabParameter[] = [];
  const skip =
    /^(biologie|date de|contenu|descriptif|hematologie|hemato|hemostase|biochimie|end\.?$|file:|https?:|non r[eé]alis|commentaire|l'ekfc|marqueurs|inflammation|proteines|glucides|tests globaux|hemogramme|\d+\/\d+$)/i;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/^[\s.]+/, '').trim();
    if (!line || skip.test(line) || !/\d/.test(line)) continue;
    const cells = line
      .split(/\.\s+/)
      .map((cell) => cell.replace(/^\.+|\.+$/g, '').trim())
      .filter(Boolean);
    if (cells.length < 3) continue;
    let name = cells[0];
    let idx = 1;
    let flagRaw = '';
    if (cells[1] === '+' || cells[1] === '-') {
      flagRaw = cells[1] === '+' ? 'H' : 'L';
      idx = 2;
    }
    const valueRaw = cells[idx];
    if (!valueRaw || !/^\d+(?:[.,]\d+)?$/.test(valueRaw.trim())) continue;
    const param = toParam({
      name,
      valueRaw,
      unit: tidyUnit(cells[idx + 1] ?? ''),
      range: cells.slice(idx + 2).join(' '),
      flagRaw,
    });
    if (param) rows.push(param);
  }
  return rows;
}

function parsePipeTable(text: string): LabParameter[] {
  const rows: LabParameter[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes('|')) continue;
    const cells = line
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell, i, all) => !(i === 0 && cell === '') && !(i === all.length - 1 && cell === ''));
    if (cells.length < 3) continue;
    if (/analyte|---/i.test(cells[0])) continue;
    const param = toParam({
      name: cells[0],
      valueRaw: cells[1],
      unit: cells[2] ?? '',
      range: cells[3] ?? '',
      flagRaw: cells[4] ?? '',
    });
    if (param) rows.push(param);
  }
  return rows;
}

function parseLabJson(text: string): LabExtract | null {
  const block = text.match(/```(?:labjson|json)\s*([\s\S]*?)```/i);
  const raw = block?.[1] ?? text.match(/\{\s*"parameters"\s*:\s*\[[\s\S]*?\]\s*\}/)?.[0];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      date?: string | null;
      parameters?: Array<Record<string, unknown>>;
    };
    const parameters = (parsed.parameters ?? [])
      .map((row) => {
        const value = typeof row.value === 'number' ? row.value : parseNumber(String(row.value ?? row.display ?? ''));
        if (value == null) return null;
        const nameKa = String(row.nameKa ?? row.name ?? '');
        const nameEn = String(row.nameEn ?? row.name ?? nameKa);
        const refLow = typeof row.refLow === 'number' ? row.refLow : parseNumber(String(row.refLow ?? ''));
        const refHigh = typeof row.refHigh === 'number' ? row.refHigh : parseNumber(String(row.refHigh ?? ''));
        return {
          key: slugLabKey(String(row.key ?? nameEn ?? nameKa)),
          nameKa: nameKa || nameEn,
          nameEn: nameEn || nameKa,
          value,
          display: String(row.display ?? value),
          unit: String(row.unit ?? ''),
          refLow,
          refHigh,
          flag: flagFrom(String(row.flag ?? ''), value, refLow, refHigh),
        } satisfies LabParameter;
      })
      .filter((row): row is LabParameter => Boolean(row));
    return { date: normalizeLooseDate(parsed.date) ?? null, parameters };
  } catch {
    return null;
  }
}

export function normalizeLooseDate(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const iso = raw.trim().match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (iso) {
    return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  }
  const eu = raw.trim().match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  if (eu) {
    return `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`;
  }
  return null;
}

function parseDocumentDate(text: string): string | null {
  const labeled = text.match(
    /(?:date|collected|biologie|\u10d7\u10d0\u10e0\u10d8\u10e6|\u10d2\u10d0\u10d9\u10d4\u10d7\u10d3)[^\d]{0,40}(\d{1,4}[-./]\d{1,2}[-./]\d{1,4})/i,
  );
  if (labeled) return normalizeLooseDate(labeled[1]);
  const any = text.match(/\b(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})\b/);
  return any ? normalizeLooseDate(any[1]) : null;
}

export function stripLabJson(text: string): string {
  return text.replace(/```(?:labjson|json)\s*[\s\S]*?```/gi, '').trim();
}

export function parseLabExtract(text: string): LabExtract {
  const fromJson = parseLabJson(text);
  const fromTable = parsePipeTable(text);
  const fromDots = parseDotSeparatedLab(text);
  const merged = new Map<string, LabParameter>();
  for (const row of [...(fromJson?.parameters ?? []), ...fromTable, ...fromDots]) {
    merged.set(row.key, row);
  }
  return {
    date: fromJson?.date ?? parseDocumentDate(text),
    parameters: [...merged.values()],
  };
}

export function mergeLabExtracts(parts: LabExtract[]): LabExtract {
  const merged = new Map<string, LabParameter>();
  let date: string | null = null;
  for (const part of parts) {
    if (!date && part.date) date = part.date;
    for (const row of part.parameters) merged.set(row.key, row);
  }
  return { date, parameters: [...merged.values()] };
}

export function formatLabDateKa(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(y, m - 1, d).toLocaleDateString('ka-GE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function isTodayYmd(ymd: string): boolean {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return ymd === stamp;
}
