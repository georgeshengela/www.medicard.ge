import { formsCompatible, innCompatible } from './facts.js';

/** PSP is one chain; Pharmadepot and GPC belong to one company (GEPHA) with one price list. */
export const chainOf = (sourceId) => (sourceId === 'PSP' ? 'PSP' : 'GEPHA');

/**
 * Groups every current pharmacy offer into products: one group = one box a person can buy anywhere.
 *
 * Offers join a group only when nothing known about them disagrees — brand, variant words (forte, MR,
 * საბავშვო…), dose, count, volume, dosage-form group and active substance. A group of one chain whose
 * facts are incomplete (PSP often has no dose in a syrup's name) joins the other chain's group of the
 * same brand only when exactly one fits both ways. Pharmadepot and GPC share `med_code` for the same
 * box, which is joined first.
 *
 * The maker's country does not block an exact match (PSP's country field is often wrong), but when one
 * pharmacy sells the box from two countries (Concor made in Germany and in Turkey), the group is split
 * by country so each variant is compared with itself.
 *
 * Input: [{ key, sourceId, identity }] (identity from facts.js `identityOf`). Output: arrays of keys.
 */
export function clusterOffers(offers) {
  const parent = new Map();
  const agg = new Map();
  const byKey = new Map(offers.map((o) => [o.key, o]));

  const find = (k) => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = k;
    while (parent.get(c) !== r) {
      const next = parent.get(c);
      parent.set(c, r);
      c = next;
    }
    return r;
  };

  const SETS = ['forms', 'inns', 'volumes', 'counts', 'chains', 'countries', 'words', 'makers'];
  for (const o of offers) {
    parent.set(o.key, o.key);
    const id = o.identity;
    agg.set(o.key, {
      forms: new Set(id.formGroup ? [id.formGroup] : []),
      inns: new Set(id.inn ? [id.inn] : []),
      volumes: new Set(id.volume ? [id.volume] : []),
      counts: new Set(id.count ? [id.count] : []),
      chains: new Set([chainOf(o.sourceId)]),
      countries: new Set(id.country ? [id.country] : []),
      makers: new Set(id.maker ? [id.maker] : []),
      words: new Set(id.words || []),
      // Every spelling of the dose this group can still be: the members' spellings that all agree.
      doses: id.doses?.length ? new Set(id.doses) : null,
      mods: id.mods.join(','),
      generic: Boolean(id.generic),
    });
  }

  const dosesAgree = (a, b) => !a.doses || !b.doses || [...a.doses].some((d) => b.doses.has(d));
  const compatible = (a, b) => {
    if (a.mods !== b.mods) return false;
    // One chain listing the box twice from two countries means two variants, not a typo; and a box named
    // only by its substance (Captopril 25mg #40) is a different maker's box when the countries differ.
    const sameChain = [...a.chains].some((c) => b.chains.has(c));
    const countriesDiffer = new Set([...a.countries, ...b.countries]).size > 1;
    if ((sameChain || a.generic || b.generic) && countriesDiffer) return false;
    // Another country AND another maker (Zelenin drops from Georgia and from Latvia) is another box; a
    // country alone may just be PSP's data, the same maker spelled in both alphabets agrees.
    if (countriesDiffer && a.makers.size && b.makers.size && ![...a.makers].some((m) => [...b.makers].some((n) => m.slice(0, 4) === n.slice(0, 4)))) return false;
    // Two listings of one chain that each carry words the other lacks (Herbion „სუროს“ vs
    // „მრავალძარღვა“) are two boxes; „Fenistil“ vs „Fenistil New“ may be one.
    if (sameChain && [...a.words].some((w) => !b.words.has(w)) && [...b.words].some((w) => !a.words.has(w))) return false;
    for (const field of ['volumes', 'counts']) if (new Set([...a[field], ...b[field]]).size > 1) return false;
    if (!dosesAgree(a, b)) return false;
    for (const x of a.forms) for (const y of b.forms) if (!formsCompatible(x, y)) return false;
    for (const x of a.inns) for (const y of b.inns) if (!innCompatible(x, y)) return false;
    return true;
  };

  const union = (ka, kb, { force = false } = {}) => {
    const ra = find(ka);
    const rb = find(kb);
    if (ra === rb) return true;
    const a = agg.get(ra);
    const b = agg.get(rb);
    if (!force && !compatible(a, b)) return false;
    parent.set(rb, ra);
    for (const field of SETS) for (const v of b[field]) a[field].add(v);
    if (a.doses && b.doses) {
      const both = new Set([...a.doses].filter((d) => b.doses.has(d)));
      a.doses = both.size ? both : a.doses;
    } else a.doses = a.doses || b.doses;
    a.generic = a.generic || b.generic;
    agg.delete(rb);
    return true;
  };

  // 1. Pharmadepot ↔ GPC: the same med_code is the same box.
  const byMedCode = new Map();
  for (const o of offers) {
    const code = o.identity.medCode;
    if (!code) continue;
    if (byMedCode.has(code)) union(byMedCode.get(code), o.key, { force: true });
    else byMedCode.set(code, o.key);
  }

  // 2. Exact keys: brand + variant words + (a dose spelling or the volume) + count; the rest is checked on join.
  const buckets = new Map();
  const add = (k, key) => {
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(key);
  };
  for (const o of offers) {
    const id = o.identity;
    if (!id.count) continue;
    const mods = id.mods.join(',');
    for (const b of id.brands) {
      for (const d of id.doses || []) add(`${b}|${mods}|d:${d}|${id.count}`, o.key);
      if (id.volume) add(`${b}|${mods}|v:${id.volume}|${id.count}`, o.key);
      // Herbal and homeopathic tablets carry no dose: brand + form + count is all there is.
      if (!id.doses?.length && !id.volume && id.formGroup) add(`${b}|${mods}|f:${id.formGroup}|${id.count}`, o.key);
    }
  }
  // Twice: first only partners whose maker's country agrees (so Concor from Germany finds the German
  // Concor elsewhere), then the rest — PSP's country field is too often wrong to require it.
  const sameCountry = (ka, kb) => {
    const a = agg.get(find(ka)).countries;
    const b = agg.get(find(kb)).countries;
    return !a.size || !b.size || [...a].some((c) => b.has(c));
  };
  for (const strict of [true, false]) {
    for (const keys of buckets.values()) {
      for (let i = 1; i < keys.length; i += 1) {
        for (let j = 0; j < i; j += 1) {
          if (strict && !sameCountry(keys[j], keys[i])) continue;
          if (union(keys[j], keys[i])) break;
        }
      }
    }
  }

  // 3. A group sold by one chain joins the other chain's group of its brand when exactly one fits — both
  //    ways, and with the maker's country agreeing. Shared descriptive words („მრავალძარღვას“) break ties.
  const byBrand = new Map();
  for (const o of offers) {
    for (const b of o.identity.brands) {
      const k = `${b}|${o.identity.mods.join(',')}`;
      if (!byBrand.has(k)) byBrand.set(k, []);
      byBrand.get(k).push(o.key);
    }
  }
  const rootsNow = () => {
    const m = new Map();
    for (const o of offers) {
      const r = find(o.key);
      if (!m.has(r)) m.set(r, []);
      m.get(r).push(o.key);
    }
    return m;
  };
  const weakFits = (root, members) => {
    const mine = agg.get(root);
    const fits = new Set();
    for (const k of members) {
      const id = byKey.get(k).identity;
      for (const b of id.brands) {
        for (const other of byBrand.get(`${b}|${id.mods.join(',')}`) || []) {
          const r = find(other);
          if (r === root) continue;
          const theirs = agg.get(r);
          if ([...theirs.chains].some((c) => mine.chains.has(c))) continue;
          if (new Set([...mine.countries, ...theirs.countries]).size > 1) continue;
          if (compatible(mine, theirs)) fits.add(r);
        }
      }
    }
    if (fits.size <= 1) return [...fits];
    // Several fit: keep those sharing a descriptive word, if that narrows it down.
    const sharing = [...fits].filter((r) => [...agg.get(r).words].some((w) => mine.words.has(w)));
    return sharing.length ? sharing : [...fits];
  };
  const groups0 = rootsNow();
  const singleChain = [...groups0.entries()].filter(([r]) => agg.get(r).chains.size === 1);
  const proposals = [];
  for (const [root, members] of singleChain) {
    const fits = weakFits(root, members);
    if (fits.length === 1) proposals.push([root, fits[0]]);
  }
  for (const [root, target] of proposals) {
    if (find(root) !== root || find(target) !== target) continue;
    // Both ways: the target must not fit any other group of this chain either.
    const back = weakFits(target, groups0.get(target) || []);
    if (back.length === 1 && back[0] === root) union(target, root);
  }

  // 4. Collect, then split variants: a flavour both chains name („ტყის კენკრა“), a country one pharmacy
  //    sells twice.
  const out = [];
  for (const keys of rootsNow().values()) for (const part of splitByWords(keys, byKey)) out.push(...splitByCountry(part, byKey));
  return out;
}

/**
 * Doritricin and „Doritricin ტყის კენკრა“ share brand, count and form. When one pharmacy lists both and
 * the other chain names the same extra words too, they are two boxes; extra words only one chain uses
 * (PSP's „ფორთოხლით“ on a Nurofen syrup the other lists plainly) stay in the plain group.
 */
function splitByWords(keys, byKey) {
  if (keys.length < 3) return [keys];
  const sources = keys.map((k) => byKey.get(k).sourceId);
  if (new Set(sources).size === sources.length) return [keys];
  const wordSets = keys.map((k) => new Set(byKey.get(k).identity.words || []));
  const common = new Set([...wordSets[0]].filter((w) => wordSets.every((s) => s.has(w))));
  const sig = (i) => [...wordSets[i]].filter((w) => !common.has(w)).sort().join(' ');
  const bySig = new Map();
  keys.forEach((k, i) => {
    const s = sig(i);
    if (!bySig.has(s)) bySig.set(s, []);
    bySig.get(s).push(k);
  });
  if (bySig.size < 2) return [keys];
  const chainsOf = (ks) => new Set(ks.map((k) => chainOf(byKey.get(k).sourceId)));
  const plain = bySig.get('') || [];
  const parts = [];
  for (const [s, ks] of bySig) {
    if (s === '') continue;
    if (chainsOf(ks).size > 1) parts.push(ks);
    else plain.push(...ks);
  }
  if (plain.length) parts.push(plain);
  return parts.length ? parts : [keys];
}

function splitByCountry(keys, byKey) {
  if (keys.length < 2) return [keys];
  const perSource = new Map();
  for (const k of keys) {
    const o = byKey.get(k);
    if (!perSource.has(o.sourceId)) perSource.set(o.sourceId, new Set());
    if (o.identity.country) perSource.get(o.sourceId).add(o.identity.country);
  }
  if (![...perSource.values()].some((countries) => countries.size > 1)) return [keys];
  const byCountry = new Map();
  const unknown = [];
  for (const k of keys) {
    const c = byKey.get(k).identity.country;
    if (!c) {
      unknown.push(k);
      continue;
    }
    if (!byCountry.has(c)) byCountry.set(c, []);
    byCountry.get(c).push(k);
  }
  const parts = [...byCountry.values()].sort((a, b) => b.length - a.length);
  if (unknown.length) parts[0].push(...unknown);
  return parts;
}
