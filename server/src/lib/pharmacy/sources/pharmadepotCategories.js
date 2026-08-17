import { FETCH_HEADERS, PHARMADEPOT_MEDICATION_CATEGORY, SOURCES } from '../constants.js';
import { PHARMADEPOT_SUBCATEGORIES } from '../categories.js';

const BASE = SOURCES.PHARMADEPOT.baseUrl;

function unescapeEmbeddedJson(text) {
  return text.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
}

export async function fetchPharmadepotSubcategoryList() {
  const url = `${BASE}/ka/category/medication?category=${PHARMADEPOT_MEDICATION_CATEGORY}`;
  const html = await (await fetch(url, { headers: FETCH_HEADERS })).text();

  const anchor = html.indexOf('subCategoriesData');
  if (anchor < 0) throw new Error('subCategoriesData not found on Pharmadepot page');

  const chunk = unescapeEmbeddedJson(html.slice(anchor, anchor + 120_000));
  const listStart = chunk.indexOf('"list":[');
  if (listStart < 0) throw new Error('subCategories list not found');

  const listChunk = chunk.slice(listStart);
  const re = /"id":(\d+),"name":"((?:\\.|[^"\\])*)"/g;
  const subs = [];
  const seen = new Set();

  for (const match of listChunk.matchAll(re)) {
    const id = parseInt(match[1], 10);
    if (seen.has(id)) continue;
    seen.add(id);
    const name = match[2];
    if (id === Number(PHARMADEPOT_MEDICATION_CATEGORY)) continue;
    subs.push({ id, name, active: true });
  }

  if (!subs.length) throw new Error('No Pharmadepot subcategories parsed');
  return subs;
}

/** Map Pharmadepot subcategory name to our unified slug. */
export function mapPharmadepotSubcategoryName(nameKa) {
  const normalized = nameKa.trim().toLowerCase();
  const exact = PHARMADEPOT_SUBCATEGORIES.find((c) => c.nameKa.toLowerCase() === normalized);
  if (exact) return exact.id;

  const partial = PHARMADEPOT_SUBCATEGORIES.find((c) => {
    const n = c.nameKa.toLowerCase();
    return normalized.includes(n.slice(0, 8)) || n.includes(normalized.slice(0, 8));
  });
  return partial?.id ?? null;
}
