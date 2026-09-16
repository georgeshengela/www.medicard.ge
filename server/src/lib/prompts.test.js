import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROMPT_VERSION,
  SYSTEM_PROMPTS,
  VET_DISCLAIMER_KA,
  buildDoctorTurnContext,
  looksLikeBrokenDoctorReply,
  stripDoctorDisclaimer,
} from './prompts.js';

test('prompt version tracks the Medi voice rewrite', () => {
  assert.equal(PROMPT_VERSION, '1.8.1');
});

test('doctor prompt treats clinical_context as untrusted data', () => {
  assert.match(SYSTEM_PROMPTS.DOCTOR, /clinical_context/);
  assert.match(SYSTEM_PROMPTS.DOCTOR, /დაგეგმილი მედიკამენტი ან შეხსენება არ არის მიღება/);
});

test('doctor prompt is a friendly Georgian health friend, not a clerk', () => {
  assert.match(SYSTEM_PROMPTS.DOCTOR, /მეგობარი, რომელიც კარგად იცის მედიცინა/);
  assert.match(SYSTEM_PROMPTS.DOCTOR, /მადლობა შეტყობინებას/);
  assert.match(SYSTEM_PROMPTS.DOCTOR, /ბავშვი, შვილი/);
  assert.match(SYSTEM_PROMPTS.DOCTOR, /ჯიგარო/);
  assert.match(SYSTEM_PROMPTS.DOCTOR, /სამი დღეა თავი მტკივა/);
});

test('first Medi turn still gives advice when the user already named a child', () => {
  const turn = buildDoctorTurnContext({ userTurnCount: 1, assistantTurnCount: 0 });
  assert.match(turn, /ბავშვი\/შვილი/);
  assert.match(turn, /რა გააკეთოს ახლა/);
  assert.doesNotMatch(turn, /ჯერ შეაგროვე ინფორმაცია/);
});

test('looksLikeBrokenDoctorReply catches the production failure modes', () => {
  const fever =
    'მადლობა შეტყობინებას. მაგრამ პაციენტის პროფილის მიხედვით, ასაკი 30 წელია.\n' +
    'რამდენჯერ იზდგას და რა სიმპტომები ერთად აქვს (ქიბის დღეები, თხველა, ქსულურება, მძილე ვაჟლობა და სხვა)?\n\n' +
    '---\n⚠️ ეს არ არის საბოლოო დიაგნოზი — მიმართეთ ექიმს.';
  const slang =
    'პირველი სტრიქონი გასაგებად არ გვექნება — შეგიძლია გაიმეოროთ ან დაწეროს ხელით?\n' +
    'ბავშვის ლათვის შესახებ:\n- რამდენ წლისაა ბავშვი?\n- რამდენჯე\n\n---\n⚠️ ეს არ არის საბოლოო დიაგნოზი — მიმართეთ ექიმს.';
  const ok =
    '38,5 °C ბავშვზე სიცხეა. მიეცით სითხე, მსუბუქი ტანსაცმელი და თუ 3 თვემდეა ან სუნთქვა უჭირს — 112.\n' +
    'რამდენი თვის ან წლისაა შვილი?';

  assert.equal(looksLikeBrokenDoctorReply(fever), true);
  assert.equal(looksLikeBrokenDoctorReply(slang), true);
  assert.equal(looksLikeBrokenDoctorReply(ok), false);
  assert.match(stripDoctorDisclaimer(fever), /იზდგას/);
  assert.doesNotMatch(stripDoctorDisclaimer(fever), /საბოლოო დიაგნოზი/);
});

test('VET prompt is Medi Vet and does not ask if the owner is a child', () => {
  assert.match(SYSTEM_PROMPTS.VET, /Medi Vet/);
  assert.match(SYSTEM_PROMPTS.VET, /არ ხარ ლიცენზირებული ვეტერინარი/);
  assert.match(SYSTEM_PROMPTS.VET, /pet_record/);
  assert.match(SYSTEM_PROMPTS.VET, /ნუ ჰკითხავ/);
  assert.doesNotMatch(SYSTEM_PROMPTS.VET, /Nightingale/);
  assert.match(VET_DISCLAIMER_KA, /ვეტერინარს/);
  assert.doesNotMatch(VET_DISCLAIMER_KA, /მიმართეთ ექიმს/);
});
