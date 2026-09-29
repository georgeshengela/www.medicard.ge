import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS } from './medipulsi/core/missions.js';
import { MISSIONS_EN, localizeMission, localizeSnapshot } from './medipulsi/missionsEn.js';

test('every stock MEDIRUN mission has English copy', () => {
  for (const m of MISSIONS) assert.ok(MISSIONS_EN[m.id]?.name, m.id);
});

test('English snapshot swaps stock text, keeps admin edits and Georgian requests unchanged', () => {
  const vake = MISSIONS.find((m) => m.id === 'vake');
  const edited = { ...MISSIONS.find((m) => m.id === 'rike'), story: 'ადმინის ახალი ტექსტი' };
  const snap = { missions: [vake, edited], config: { enabled: false, message: 'შეჩერებულია' } };
  const en = localizeSnapshot(snap, 'en');
  assert.equal(en.missions[0].name, 'Vake Park');
  assert.match(en.missions[0].tip, /public pedestrian space/);
  assert.equal(en.missions[1].name, 'Rike Park');
  assert.equal(en.missions[1].story, 'ადმინის ახალი ტექსტი');
  assert.equal(en.config.message, '');
  assert.equal(localizeSnapshot(snap, 'ka'), snap);
  assert.equal(localizeMission(vake, 'ka'), vake);
});
