function parseNumber(raw) {
  const cleaned = String(raw ?? '').replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseRange(raw) {
  const match = String(raw).replace(',', '.').match(/(-?[\d.]+)\s*[-–—]\s*(-?[\d.]+)/);
  if (match) return { low: parseNumber(match[1]), high: parseNumber(match[2]) };
  const lt = String(raw).match(/[≤<]\s*(-?[\d.]+)/);
  if (lt) return { low: null, high: parseNumber(lt[1]) };
  const gt = String(raw).match(/[≥>]\s*(-?[\d.]+)/);
  if (gt) return { low: parseNumber(gt[1]), high: null };
  return { low: null, high: null };
}

function slugKey(raw) {
  return String(raw)
    .toLowerCase()
    .replace(/\[.*?\]/g, ' ')
    .replace(/[^a-z0-9\u10A0-\u10FF]+/gi, ' ')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 48) || 'analyte';
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
  const merged = new Map();
  for (const row of [...(fromJson?.parameters ?? []), ...fromTable]) merged.set(row.key, row);
  const labeled = text.match(/(?:date|collected|თარიღ|გაკეთდ)[^\d]{0,24}(\d{1,4}[-./]\d{1,2}[-./]\d{1,4})/i);
  const any = text.match(/\b(\d{4}[-./]\d{1,2}[-./]\d{1,2}|\d{1,2}[-./]\d{1,2}[-./]\d{4})\b/);
  return {
    date: fromJson?.date ?? normalizeLooseDate(labeled?.[1] ?? any?.[1] ?? '') ?? null,
    parameters: [...merged.values()],
  };
}
