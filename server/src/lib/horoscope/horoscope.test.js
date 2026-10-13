import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import * as A from 'astronomy-engine';
import {
  houses, natalChart, sunSign, chineseNewYear, chineseZodiac, lifePath, personalDay, moonPhase, skyEvents,
  zonedToUtc, signOf, aspects, transitsFor, angleDiff,
} from './astro.js';
import { wantedPeriods } from './jobs.js';
import { periodWindow, weekKey, isValidPeriodKey, exactAspects } from './generate.js';
import { normaliseKa, mergeEn, readingTexts, skyFacts, factsKa } from './writer.js';
import { libraryKeys, compatScore, compatKey, tarotOfDay, tarotSpread, natalAspectKey, chineseRelation, TAROT, DREAMS } from './catalog.js';
import { batchKeys, namespaceOf } from './library.js';
import { buildHoroscopeOverview } from './adminHoroscope.js';
import { cardsWanted, personChartText } from './oracle.js';
import { horoscopeStatements } from '../../../scripts/install-horoscope.mjs';
import { FEATURES } from '../featureFlags.js';

const TBILISI = { lat: 41.7151, lon: 44.8271 };

describe('MEDIHOROSCOPE sky engine', () => {
  it('places the ascendant on the eastern horizon and keeps Placidus cusps true to their definition', () => {
    const at = zonedToUtc('1990-05-15', '14:30', 'Asia/Tbilisi');
    const h = houses(at, TBILISI.lat, TBILISI.lon);
    assert.equal(h.system, 'placidus');
    const e = (h.obliquity * Math.PI) / 180;
    const toEq = (lon) => {
      const l = (lon * Math.PI) / 180;
      return { ra: (Math.atan2(Math.sin(l) * Math.cos(e), Math.cos(l)) * 180) / Math.PI, dec: (Math.asin(Math.sin(e) * Math.sin(l)) * 180) / Math.PI };
    };
    const asc = toEq(h.asc);
    const hor = A.Horizon(at, new A.Observer(TBILISI.lat, TBILISI.lon, 0), ((asc.ra / 15) + 24) % 24, asc.dec, null);
    assert.ok(Math.abs(hor.altitude) < 0.05, `asc altitude ${hor.altitude}`);
    assert.ok(hor.azimuth > 0 && hor.azimuth < 180, 'ascendant rises in the east');
    const lst = (A.SiderealTime(at) * 15 + TBILISI.lon) % 360;
    for (const [i, frac] of [[10, 1 / 3], [11, 2 / 3]]) {
      const p = toEq(h.cusps[i]);
      let ha = ((lst - p.ra) % 360 + 360) % 360;
      if (ha > 180) ha = 360 - ha;
      const ad = (Math.asin(Math.tan((TBILISI.lat * Math.PI) / 180) * Math.tan((p.dec * Math.PI) / 180)) * 180) / Math.PI;
      assert.ok(Math.abs(ha - frac * (90 + ad)) < 0.01, `cusp ${i + 1}`);
    }
  });

  it('falls back to whole-sign houses near the poles', () => {
    const h = houses(new Date('2000-01-01T12:00:00Z'), 70, 20);
    assert.equal(h.system, 'whole_sign');
    assert.equal(h.cusps[0] % 30, 0);
  });

  it('reads sun signs from birth dates, flags cusp days and keeps time-zone history', () => {
    assert.equal(sunSign('1990-05-15').sign, 'taurus');
    assert.equal(sunSign('1985-12-25').sign, 'capricorn');
    assert.deepEqual(sunSign('1990-03-21').cusp, ['pisces', 'aries']);
    // Historical offsets come from tzdata: Tbilisi summer 1990 was UTC+5 (+4 with Soviet summer time), today +4.
    assert.equal(zonedToUtc('1990-07-01', '12:00', 'Asia/Tbilisi').toISOString(), '1990-07-01T07:00:00.000Z');
    assert.equal(zonedToUtc('2026-07-01', '12:00', 'Asia/Tbilisi').toISOString(), '2026-07-01T08:00:00.000Z');
  });

  it('casts a natal chart with houses only when the birth time is known', () => {
    const full = natalChart({ date: '1990-05-15', time: '14:30', tz: 'Asia/Tbilisi', ...TBILISI });
    assert.equal(full.angles.asc.sign, 'virgo');
    assert.equal(full.bodies[0].sign, 'taurus');
    assert.ok(full.bodies.every((b) => b.house >= 1 && b.house <= 12));
    const noTime = natalChart({ date: '1990-05-15', time: null, tz: 'Asia/Tbilisi' });
    assert.equal(noTime.angles, null);
    assert.equal(noTime.timeKnown, false);
    assert.equal(Object.values(full.elements).reduce((s, v) => s + v, 0) >= 99, true);
  });

  it('matches published Chinese New Year dates, including leap-month years', () => {
    const known = { 1985: '1985-02-20', 1990: '1990-01-27', 2021: '2021-02-12', 2026: '2026-02-17', 2033: '2033-01-31', 2034: '2034-02-19', 2044: '2044-01-30' };
    for (const [y, d] of Object.entries(known)) assert.equal(chineseNewYear(Number(y)), d, String(y));
    assert.equal(chineseZodiac('1990-01-20').animal, 'snake');
    assert.equal(chineseZodiac('1990-03-01').animal, 'horse');
    assert.equal(chineseZodiac('2026-10-13').element, 'fire');
  });

  it('computes numerology with master numbers', () => {
    assert.equal(lifePath('1990-05-15'), 3);
    assert.equal(lifePath('1985-11-29'), 9);
    assert.ok(personalDay('1990-05-15', '2026-10-13') >= 1 && personalDay('1990-05-15', '2026-10-13') <= 9);
  });

  it('finds the real retrograde stations and lunations of autumn 2026', () => {
    const ev = skyEvents(new Date('2026-10-13T00:00:00Z'), new Date('2026-11-30T00:00:00Z'));
    const merc = ev.find((e) => e.type === 'station_retrograde' && e.body === 'mercury');
    assert.ok(merc && merc.at.startsWith('2026-10-24'), 'Mercury turns retrograde on 24 Oct 2026');
    assert.ok(ev.some((e) => e.type === 'full_moon' && e.sign === 'taurus'));
    assert.ok(ev.some((e) => e.type === 'ingress' && e.body === 'sun' && e.sign === 'scorpio'));
  });

  it('names moon phases and aspects', () => {
    const p = moonPhase(new Date('2026-10-26T04:12:00Z'));
    assert.equal(p.key, 'full');
    const a = aspects([{ key: 'sun', lon: 10 }, { key: 'moon', lon: 129 }]);
    assert.equal(a[0].aspect, 'trine');
    assert.equal(signOf(359.9).sign, 'pisces');
    assert.equal(Math.round(angleDiff(350, 10)), 20);
  });

  it('lists transits to a natal chart, strongest first', () => {
    const chart = natalChart({ date: '1990-05-15', time: '14:30', tz: 'Asia/Tbilisi', ...TBILISI });
    const list = transitsFor(chart, new Date('2026-10-13T08:00:00Z'));
    assert.ok(list.length > 0);
    for (let i = 1; i < list.length; i++) assert.ok(list[i - 1].weight >= list[i].weight);
  });
});

describe('MEDIHOROSCOPE periods and writer', () => {
  it('uses Tbilisi calendar periods', () => {
    assert.equal(weekKey('2026-10-13'), '2026-10-12');
    assert.equal(weekKey('2026-10-18'), '2026-10-12');
    assert.ok(isValidPeriodKey('week', '2026-10-12'));
    assert.ok(!isValidPeriodKey('week', '2026-10-13'));
    const w = periodWindow('day', '2026-10-13');
    assert.equal(w.from.toISOString(), '2026-10-12T20:00:00.000Z');
  });

  it('asks for tomorrow and the next week/month/year ahead of time', () => {
    const sat = wantedPeriods(new Date('2026-10-17T10:00:00Z'));
    assert.ok(sat.some(([k, v]) => k === 'week' && v === '2026-10-19'));
    assert.ok(sat.some(([k, v]) => k === 'day' && v === '2026-10-18'));
    const endOfMonth = wantedPeriods(new Date('2026-10-30T10:00:00Z'));
    assert.ok(endOfMonth.some(([k, v]) => k === 'month' && v === '2026-11'));
    const lateDec = wantedPeriods(new Date('2026-12-21T10:00:00Z'));
    assert.ok(lateDec.some(([k, v]) => k === 'year' && v === '2027'));
  });

  it('finds exact aspects inside a window', () => {
    const list = exactAspects(new Date('2026-10-12T20:00:00Z'), new Date('2026-10-19T20:00:00Z'));
    assert.ok(list.some((x) => x.a === 'sun' && x.b === 'jupiter' && x.aspect === 'sextile'));
  });

  it('gives the author real facts in Georgian', () => {
    const f = skyFacts('taurus', 'day', '2026-10-13');
    const text = factsKa(f).join('\n');
    assert.match(text, /მთვარე მორიელში/);
    assert.match(text, /შენი მე-7 სახლი/);
  });

  const good = { headline: 'ურთიერთობების დღე', general: 'მთვარე დღეს მორიელშია.', love: 'გულწრფელი საუბარი.', money: 'დეტალები გადახედე.', mood: 'მშვიდი დღეა.', tip: 'ჯერ მოუსმინე.' };

  it('accepts a clean Georgian reading and keeps the numbers in range', () => {
    const r = normaliseKa('day', { ...good, scores: { love: 9, money: -2, mood: 3.4 }, lucky: { number: 140, color: 'neon', time: '03:00' } });
    assert.deepEqual(r.scores, { love: 5, money: 1, mood: 3 });
    assert.deepEqual(r.lucky, { number: 99, color: 'gold', time: '12:00' });
  });

  it('refuses health words, Latin words in Georgian, and missing parts', () => {
    assert.throws(() => normaliseKa('day', { ...good, mood: 'ექიმთან წადი.' }));
    assert.throws(() => normaliseKa('day', { ...good, general: 'Venus retrograde მორიელში.' }));
    assert.throws(() => normaliseKa('day', { ...good, tip: '' }));
    assert.throws(() => readingTexts({ ...good, love: 'You may meet a doctor' }, 'en'));
  });

  it('merges the English month reading by date', () => {
    const ka = normaliseKa('month', { ...good, keyDates: [{ date: '2026-10-24', text: 'მერკური უკუსვლაში' }] });
    const merged = mergeEn('month', ka, { ...good, headline: 'Day', general: 'g', love: 'l', money: 'm', mood: 'o', tip: 't', keyDates: [{ date: '2026-10-24', text: 'Mercury retrograde' }] });
    assert.deepEqual(merged.keyDates, [{ date: '2026-10-24', ka: 'მერკური უკუსვლაში', en: 'Mercury retrograde' }]);
  });
});

describe('MEDIHOROSCOPE catalogue, library and admin', () => {
  it('has unique library keys grouped in same-namespace batches', () => {
    const keys = libraryKeys({ year: 2026 });
    assert.equal(new Set(keys).size, keys.length);
    assert.equal(keys.filter((k) => k.startsWith('compat:')).length, 78);
    assert.equal(keys.filter((k) => k.startsWith('tarot:')).length, 22);
    for (const b of batchKeys(keys)) assert.equal(new Set(b.map(namespaceOf)).size, 1);
    assert.ok(DREAMS.length >= 100);
  });

  it('scores sign compatibility symmetrically', () => {
    assert.equal(compatScore('aries', 'leo'), compatScore('leo', 'aries'));
    assert.ok(compatScore('aries', 'leo') > compatScore('aries', 'cancer'));
    assert.equal(compatKey('leo', 'aries'), 'compat:aries:leo');
    assert.equal(natalAspectKey('mc', 'trine', 'sun'), 'aspect:sun:trine:mc');
    assert.equal(chineseRelation('rat', 'horse'), 'clash');
    assert.equal(chineseRelation('rat', 'dragon'), 'trine');
  });

  it('draws a stable tarot card per person and day, and three different cards for a spread', () => {
    assert.equal(tarotOfDay('u1', '2026-10-13').id, tarotOfDay('u1', '2026-10-13').id);
    const spread = tarotSpread('u1', '2026-10-13');
    assert.equal(new Set(spread.map((c) => c.id)).size, 3);
    assert.equal(TAROT.length, 22);
    assert.ok(!TAROT.some((c) => /სიკვდილ|ეშმაკ/.test(c.ka)));
  });

  it('builds admin usage from counts only and leaves the team out', () => {
    const now = new Date('2026-10-13T12:00:00Z');
    const out = buildHoroscopeOverview({
      days: 7, now,
      visits: [
        { userId: 'a', day: '2026-10-13', views: 2, sections: ['hub', 'tarot'] },
        { userId: 'a', day: '2026-10-12', views: 1, sections: ['hub'] },
        { userId: 'b', day: '2026-10-13', views: 1, sections: ['hub', 'oracle'] },
        { userId: 't', day: '2026-10-13', views: 9, sections: ['hub'] },
      ],
      births: new Map([['a', '1990-05-15'], ['b', '1985-12-25']]),
      oracle: [{ day: '2026-10-13', n: 4 }],
      // An array, as loadTeamUserIds returns it (a Set-only `.has` crashed #/horoscope on 2026-10-13).
      teamIds: ['t'],
    });
    assert.equal(out.kpis.people, 2);
    assert.equal(out.kpis.today, 2);
    assert.equal(out.kpis.returning, 1);
    assert.equal(out.kpis.oracleMessages, 4);
    assert.equal(out.signs.taurus, 1);
    assert.equal(out.signs.capricorn, 1);
    assert.equal(out.sections.tarot, 1);
    assert.equal(JSON.stringify(out).includes('1990-05-15'), false);
  });

  it('only installs additive Horoscope tables', () => {
    const sql = readFileSync(new URL('../../../prisma/20261013-horoscope.sql', import.meta.url), 'utf8');
    assert.ok(horoscopeStatements(sql).length >= 10);
    assert.throws(() => horoscopeStatements('DROP TABLE "HoroscopeReading";'));
    assert.throws(() => horoscopeStatements('CREATE TABLE IF NOT EXISTS "User" (id TEXT);'));
  });

  it('has a module switch and an Oracle switch under it', () => {
    const main = FEATURES.find((f) => f.key === 'horoscope');
    const oracle = FEATURES.find((f) => f.key === 'horoscopeOracle');
    assert.equal(main?.group, 'module');
    assert.equal(oracle?.parent, 'horoscope');
  });

  it('knows when the Oracle should draw cards and never puts health data in its chart text', () => {
    assert.equal(cardsWanted('ამომიღე ტაროს კარტი'), 1);
    assert.equal(cardsWanted('გამიშალე სამი კარტი'), 3);
    assert.equal(cardsWanted('რა მელის დღეს?'), 0);
    const chart = natalChart({ date: '1990-05-15', time: null, tz: 'Asia/Tbilisi' });
    const text = personChartText({ firstName: 'ნინო', sign: { key: 'taurus', cusp: null }, chart, chinese: null, numbers: { lifePath: 3, personalDay: 8 }, transits: [] });
    assert.match(text, /კურო/);
    assert.doesNotMatch(text, /1990/);
  });
});
