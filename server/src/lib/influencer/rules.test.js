import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG, amountForRange, bankForIban, customCodeProblem, formatGel, normalizeEnteredCode, normalizeIban,
  influencerTooLateText, normalizePhone, normalizeSocial, phoneKey, rateForPosition, tierFor, validateConfig, validatePayoutDetails,
} from './rules.js';
import { CODE_ALPHABET } from '../referral.js';
import { AUTO_ALPHABET } from './rules.js';

describe('influencer pay ladder (marginal)', () => {
  it('pays 25 tetri up to 1 000, 28 to 5 000, 35 after', () => {
    assert.equal(rateForPosition(1), 25);
    assert.equal(rateForPosition(1000), 25);
    assert.equal(rateForPosition(1001), 28);
    assert.equal(rateForPosition(5000), 28);
    assert.equal(rateForPosition(5001), 35);
  });
  it('sums across tier borders', () => {
    assert.equal(amountForRange(0, 1000), 25000);
    assert.equal(amountForRange(0, 1001), 25028);
    assert.equal(amountForRange(998, 4), 25 * 2 + 28 * 2);
    assert.equal(amountForRange(0, 6000), 1000 * 25 + 4000 * 28 + 1000 * 35);
    assert.equal(amountForRange(10, 0), 0);
  });
  it('names the status and the way to the next one', () => {
    const start = tierFor(0);
    assert.equal(start.key, 'SPARK');
    assert.equal(start.next.remaining, 1000);
    const star = tierFor(1000);
    assert.equal(star.key, 'STAR');
    assert.equal(star.rate, 28);
    assert.equal(star.next.key, 'SUPERNOVA');
    assert.equal(star.next.remaining, 4000);
    const top = tierFor(12000);
    assert.equal(top.key, 'SUPERNOVA');
    assert.equal(top.next, null);
    assert.equal(top.progress, 1);
  });
  it('formats tetri as lari', () => {
    assert.equal(formatGel(25), '0.25 ₾');
    assert.equal(formatGel(2550), '25.50 ₾');
  });
});

describe('admin settings validation', () => {
  it('accepts the defaults', () => {
    const { config, error } = validateConfig(DEFAULT_CONFIG);
    assert.equal(error, undefined);
    assert.deepEqual(config.tiers, [{ from: 0, rate: 25 }, { from: 1000, rate: 28 }, { from: 5000, rate: 35 }]);
  });
  it('refuses a ladder that does not start at 0 or repeats a border', () => {
    assert.ok(validateConfig({ tiers: [{ from: 10, rate: 25 }] }).error);
    assert.ok(validateConfig({ tiers: [{ from: 0, rate: 25 }, { from: 0, rate: 30 }] }).error);
    assert.ok(validateConfig({ tiers: [{ from: 0, rate: 0 }] }).error);
    assert.ok(validateConfig({ holdDays: 400 }).error);
  });
});

describe('too late for an influencer code', () => {
  it('names the window and the account\'s own day in Tbilisi time', () => {
    assert.equal(
      influencerTooLateText('ka', 7, '2026-10-05T22:38:00Z'),
      'ეს ინფლუენსერის კოდია — ის რეგისტრაციიდან 7 დღეში შეიყვანება, შენი ანგარიში კი 6 ოქტომბერს შეიქმნა.',
    );
    assert.equal(
      influencerTooLateText('en', 7, '2026-10-05T12:00:00Z'),
      'This is an influencer code — it can be entered within 7 days of signing up, and your account was created on October 5.',
    );
  });
});

describe('codes', () => {
  it('the system alphabet matches friends\' invite codes', () => {
    assert.equal(AUTO_ALPHABET, CODE_ALPHABET);
  });
  it('reads 0 as O and 1 as I, any case, with spaces', () => {
    assert.equal(normalizeEnteredCode('nin0 25'), 'NINO25');
    assert.equal(normalizeEnteredCode('L1KA22'), 'LIKA22');
    assert.equal(normalizeEnteredCode('ABC'), null);
  });
  it('custom codes: 6 signs, letters, no 0/1, nothing rude or reserved', () => {
    assert.equal(customCodeProblem('NINO25'), null);
    assert.equal(customCodeProblem('mariam'), null);
    assert.equal(customCodeProblem('NIN025'), 'ZERO_ONE');
    assert.equal(customCodeProblem('ABCDE'), 'LENGTH');
    assert.equal(customCodeProblem('AB-CD-EF'), 'SIMPLE');
    assert.equal(customCodeProblem('234567'), 'LETTERS');
    assert.equal(customCodeProblem('AAAAAA'), 'SIMPLE');
    assert.equal(customCodeProblem('FUCKME'), 'OFFENSIVE');
    assert.equal(customCodeProblem('5HITTY'), 'OFFENSIVE');
    assert.equal(customCodeProblem('ADMIN2'), 'RESERVED');
    assert.equal(customCodeProblem('MEDICA'), 'RESERVED');
  });
});

describe('contacts and socials', () => {
  it('normalizes Georgian and international phones', () => {
    assert.equal(normalizePhone('555 12 34 56'), '+995555123456');
    assert.equal(normalizePhone('+995 555-123-456'), '+995555123456');
    assert.equal(normalizePhone('+49 1512 3456789'), '+4915123456789');
    assert.equal(normalizePhone('12'), null);
    assert.equal(phoneKey('+995555123456'), phoneKey('555123456'));
  });
  it('takes handles or profile links', () => {
    assert.equal(normalizeSocial('instagram', '@Nino.Be'), 'nino.be');
    assert.equal(normalizeSocial('instagram', 'https://www.instagram.com/nino.be/?hl=en'), 'nino.be');
    assert.equal(normalizeSocial('tiktok', 'https://www.tiktok.com/@nino_be'), 'nino_be');
    assert.equal(normalizeSocial('tiktok', 'x'), null);
    assert.equal(normalizeSocial('facebook', 'https://facebook.com/profile.php?id=100012345'), 'profile.php?id=100012345');
    assert.equal(normalizeSocial('youtube', 'https://youtube.com/@ninobe'), '@ninobe');
    assert.equal(normalizeSocial('other', 'linktr.ee/nino'), 'https://linktr.ee/nino');
    assert.equal(normalizeSocial('instagram', ''), '');
  });
});

describe('payout account', () => {
  // A valid Georgian IBAN (mod-97) built for the test.
  const iban = 'GE29NB0000000101904917';
  it('checks the IBAN checksum and finds the bank', () => {
    assert.equal(normalizeIban('ge29 nb00 0000 0101 9049 17'), iban);
    assert.equal(normalizeIban('GE28NB0000000101904917'), null);
    assert.equal(bankForIban('GE00TB0000000000000000'), 'თიბისი ბანკი');
  });
  it('needs the payee type, holder, ID number and a bank name', () => {
    const bad = validatePayoutDetails({ payeeType: 'PERSON', iban, holder: 'ნინო ბერიძე', idCode: '123' });
    assert.equal(bad.problem.field, 'idCode');
    const noBank = validatePayoutDetails({ payeeType: 'PERSON', iban, holder: 'ნინო ბერიძე', idCode: '01001012345' });
    assert.equal(noBank.problem.field, 'bank');
    const ok = validatePayoutDetails({ payeeType: 'PERSON', iban, holder: 'ნინო ბერიძე', idCode: '01001012345', bank: 'ეროვნული ბანკი' });
    assert.deepEqual(ok.details, { payeeType: 'PERSON', iban, holder: 'ნინო ბერიძე', idCode: '01001012345', bank: 'ეროვნული ბანკი' });
    const company = validatePayoutDetails({ payeeType: 'COMPANY', iban, holder: 'შპს ნინო', idCode: '12345678901', bank: 'x' });
    assert.equal(company.problem.field, 'idCode');
  });
});
