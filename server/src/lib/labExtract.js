function parseNumber(raw) {
  const cleaned = String(raw ?? '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseRange(raw) {
  const text = String(raw ?? '').replace(',', '.');
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

const ALIASES = {
  hemoglobin: 'hemoglobin',
  hemoglobine: 'hemoglobin',
  hémoglobine: 'hemoglobin',
  hgb: 'hemoglobin',
  hb: 'hemoglobin',
  hematocrite: 'hct',
  hématocrite: 'hct',
  hct: 'hct',
  'globules rouges': 'rbc',
  'globules blancs': 'wbc',
  plaquettes: 'plt',
  glucose: 'glucose',
  creatinine: 'creatinine',
  créatinine: 'creatinine',
  uree: 'urea',
  urée: 'urea',
  tgp: 'alt',
  alat: 'alt',
  tgo: 'ast',
  asat: 'ast',
  crp: 'crp',
  'gamma gt': 'ggt',
  inr: 'inr',
  sodium: 'sodium',
  potassium: 'potassium',
};

const NAME_KA = {
  hemoglobin: 'ჰემოგლობინი',
  hct: 'ჰემატოკრიტი',
  rbc: 'ერითროციტები',
  wbc: 'ლეიკოციტები',
  plt: 'თრომბოციტები',
  glucose: 'გლუკოზა',
  creatinine: 'კრეატინინი',
  urea: 'შარდოვანა',
  alt: 'ALT',
  ast: 'AST',
  crp: 'CRP',
  ggt: 'გამა-გტ',
  inr: 'INR',
  sodium: 'ნატრიუმი',
  potassium: 'კალიუმი',
};

function tidyUnit(unit) {
  const u = String(unit ?? '').replace(/\s+/g, '');
  if (!u) return '';
  if (u === '%%') return '%';
  if (u === 'ss') return 's';
  const lower = u.toLowerCase();
  const half = Math.floor(u.length / 2);
  if (half >= 2 && lower.slice(0, half) === lower.slice(half)) return u.slice(half);
  return u;
}

function slugKey(raw) {
  const compact = String(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\[.*?\]/g, ' ')
    .replace(/[^a-z0-9\u10A0-\u10FF]+/gi, ' ')
    .trim();
  const first = compact.split(/\s+/)[0] ?? compact;
  const aliased = ALIASES[compact] ?? (compact.includes(' ') ? undefined : ALIASES[first]);
  return aliased || compact.replace(/\s+/g, '_').slice(0, 48) || 'analyte';
}

function flagFrom(raw, value, low, high) {
  const letter = String(raw).trim().toUpperCase();
  if (letter.startsWith('H') || letter.includes('HIGH') || letter.includes('↑')) return 'H';
  if (letter.startsWith('L') || letter.includes('LOW') || letter.includes('↓')) return 'L';
  if (letter.startsWith('N') || letter.includes('NORM')) return 'N';
  if (low != null && value < low) return 'L';
  if (high != null && value > high) return 'H';
  if (low != null || high != null) return 'N';
  return 'U';
}

function normalizeLooseDate(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const iso = raw.trim().match(/(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const eu = raw.trim().match(/(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
  if (eu) return `${eu[3]}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`;
  return null;
}

function parseDotSeparatedLab(text) {
  const rows = [];
  const skip =
    /^(biologie|date de|contenu|descriptif|hematologie|hemato|hemostase|biochimie|end\.?$|file:|https?:|non r[eé]alis|commentaire|l'ekfc|marqueurs|inflammation|proteines|glucides|tests globaux|hemogramme|\d+\/\d+$)/i;

  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.replace(/^[\s.]+/, '').trim();
    if (!line || skip.test(line) || !/\d/.test(line)) continue;
    const cells = line
      .split(/\.\s+/)
      .map((cell) => cell.replace(/^\.+|\.+$/g, '').trim())
      .filter(Boolean);
    if (cells.length < 3) continue;

    let name = cells[0];
    let idx = 1;
    let flag = '';
    if (cells[1] === '+' || cells[1] === '-') {
      flag = cells[1];
      idx = 2;
    }
    const valueRaw = cells[idx];
    if (valueRaw == null || !/^\d+(?:[.,]\d+)?$/.test(String(valueRaw).trim())) continue;
    if (/analyte|descriptif|valeur|norme|contenu/i.test(name) || name.length < 2 || name.length > 80) continue;

    const value = parseNumber(valueRaw);
    const unit = tidyUnit(cells[idx + 1] ?? '');
    const range = cells.slice(idx + 2).join(' ');
    const { low, high } = parseRange(range);
    const key = slugKey(name);
    rows.push({
      key,
      nameKa: NAME_KA[key] || name,
      nameEn: name,
      value,
      display: String(valueRaw).trim(),
      unit,
      refLow: low,
      refHigh: high,
      flag: flagFrom(flag === '+' ? 'H' : flag === '-' ? 'L' : flag, value, low, high),
    });
  }
  return rows;
}

function parsePipeTable(text) {
  const rows = [];
  for (const line of String(text).split(/\r?\n/)) {
    if (!line.includes('|')) continue;
    const cells = line
      .replace(/^ANALYTE\s*/i, '')
      .split('|')
      .map((cell) => cell.trim())
      .filter((cell, i, all) => !(i === 0 && cell === '') && !(i === all.length - 1 && cell === ''));
    if (cells.length < 3) continue;
    if (/analyte|---/i.test(cells[0])) continue;
    const value = parseNumber(cells[1]);
    if (value == null || /unread|illegib/i.test(cells[1])) continue;
    const { low, high } = parseRange(cells[3] ?? '');
    const name = cells[0];
    rows.push({
      key: slugKey(name),
      nameKa: name,
      nameEn: name,
      value,
      display: cells[1].trim() || String(value),
      unit: cells[2] ?? '',
      refLow: low,
      refHigh: high,
      flag: flagFrom(cells[4] ?? '', value, low, high),
    });
  }
  return rows;
}

function parseLabJson(text) {
  const block = String(text).match(/```(?:labjson|json)\s*([\s\S]*?)```/i);
  const raw = block?.[1] ?? String(text).match(/\{\s*"parameters"\s*:\s*\[[\s\S]*?\]\s*\}/)?.[0];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const parameters = (parsed.parameters ?? [])
      .map((row) => {
        const value = typeof row.value === 'number' ? row.value : parseNumber(row.value ?? row.display);
        if (value == null) return null;
        const nameKa = String(row.nameKa ?? row.name ?? '');
        const nameEn = String(row.nameEn ?? row.name ?? nameKa);
        const refLow = typeof row.refLow === 'number' ? row.refLow : parseNumber(row.refLow);
        const refHigh = typeof row.refHigh === 'number' ? row.refHigh : parseNumber(row.refHigh);
        return {
          key: slugKey(row.key ?? nameEn ?? nameKa),
          nameKa: nameKa || nameEn,
          nameEn: nameEn || nameKa,
          value,
          display: String(row.display ?? value),
          unit: String(row.unit ?? ''),
          refLow,
          refHigh,
          flag: flagFrom(row.flag ?? '', value, refLow, refHigh),
        };
      })
      .filter(Boolean);
    return { date: normalizeLooseDate(parsed.date) ?? null, parameters };
  } catch {
    return null;
  }
}

export function extractLabFromText(...parts) {
  const text = parts.filter(Boolean).join('\n\n');
  const fromJson = parseLabJson(text);
  const fromTable = parsePipeTable(text);
  const fromDots = parseDotSeparatedLab(text);
  const merged = new Map();
  for (const row of [...(fromJson?.parameters ?? []), ...fromTable, ...fromDots]) merged.set(row.key, row);
  const labeled = text.match(
    /(?:date|collected|biologie|თარიღ|გაკეთდ)[^\d]{0,40}(\d{1,4}[-./]\d{1,2}[-./]\d{1,4})/i,
  );
  const any = text.match(/\b(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})\b/);
  return {
    date: fromJson?.date ?? normalizeLooseDate(labeled?.[1] ?? any?.[1] ?? '') ?? null,
    parameters: [...merged.values()],
  };
}
