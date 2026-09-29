import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { petsMessage, petsMessageEn, petsEnglishErrors } from './petsMessages.js';
import { publicPetsCatalog } from './petsCatalog.js';

describe('pets English messages', () => {
  it('translates known Georgian errors and templates, keeps Georgian for ka', () => {
    assert.equal(petsMessageEn('ცხოველი ვერ მოიძებნა.'), 'Pet not found.');
    assert.equal(petsMessageEn('შენიშვნა მაქსიმუმ 500 სიმბოლოა.'), 'Note can be at most 500 characters.');
    assert.equal(petsMessage('ცხოველი ვერ მოიძებნა.', 'ka'), 'ცხოველი ვერ მოიძებნა.');
    assert.equal(petsMessageEn('user text'), null);
  });

  it('middleware rewrites error only for English requests', () => {
    let sent = null;
    const res = { json: (body) => { sent = body; return body; } };
    petsEnglishErrors({ lang: 'en' }, res, () => {});
    res.json({ error: 'ჩანაწერი ვერ მოიძებნა.', code: 'X' });
    assert.deepEqual(sent, { error: 'Entry not found.', code: 'X' });
    const resKa = { json: (body) => { sent = body; return body; } };
    petsEnglishErrors({ lang: 'ka' }, resKa, () => {});
    resKa.json({ error: 'ჩანაწერი ვერ მოიძებნა.' });
    assert.equal(sent.error, 'ჩანაწერი ვერ მოიძებნა.');
  });

  it('species labels follow the language', () => {
    assert.equal(publicPetsCatalog('en').species[0].labelKa, 'Dog');
    assert.equal(publicPetsCatalog().species[0].labelKa, 'ძაღლი');
  });
});
