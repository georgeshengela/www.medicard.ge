import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countryIso,
  doseKeys,
  doseTextFromName,
  factsFromPharmadepot,
  factsFromPsp,
  formGroupOf,
  identityOf,
  innCompatible,
  innKey,
  modifiersOf,
  parseDose,
  parseVolume,
  phon,
  splitInn,
} from './facts.js';
import { prescriptionFromLeaflet } from './sources/psp.js';

test('one spelling key for a word in either alphabet', () => {
  assert.equal(phon('ნუროფენი'), phon('Nurofen'));
  assert.equal(phon('კონკორი'), phon('Concor'));
  assert.equal(phon('ცეტირიზინი'), phon('Cetirizine'));
  // The Georgian genitive names the same thing („ტროქსერუტინის გელი“).
  assert.equal(phon('ტროქსერუტინის'), phon('ტროქსერუტინი'));
});

test('doses: concentrations per ml/g, percentages, sums and the volume make the same dose agree', () => {
  assert.equal(parseDose('7.5მგ/5მლ').key, '1.5mg/u');
  assert.equal(parseDose('1.5მგ/მლ').key, '1.5mg/u');
  assert.equal(parseDose('5%').key, '50mg/u');
  assert.equal(parseDose('(10მგ+5მგ)/1მლ').key, '5mg+10mg/u');
  assert.equal(parseDose('(1მგ+5მგ)მლ').key, '1mg+5mg/u');
  assert.equal(parseDose('50მკგ/1დოზა').key, '0.05mg');
  assert.equal(parseDose('100 000სე+100მგ').key, '100mg+100000iu');
  assert.equal(parseDose('0.25'), null);
  // PSP writes Amoxiclav 1000მგ where Pharmadepot writes 875მგ+125მგ.
  assert.ok(doseKeys(parseDose('875მგ+125მგ')).includes('1000mg'));
  // An ampoule: „150მგ+1.5მგ 3მლ“ is „(150მგ+1.5მგ)/3მლ“.
  assert.ok(doseKeys(parseDose('150მგ+1.5მგ'), parseVolume('3მლ')).includes(parseDose('(150მგ+1.5მგ)3მლ').key));
});

test('a dose inside a name: never glued to a vitamin letter, never a tube’s grams', () => {
  assert.equal(doseTextFromName('მექსი B6 - Mexi B6 125მგ+10მგ 30 ტაბლეტი'), '125მგ+10მგ');
  assert.equal(doseTextFromName('დიკლაკი გელი 5% 50გრ ტუბი #1'), '5%');
  assert.equal(doseTextFromName('ინტელექტა - Intelecta 1გ/10მლ პერორალური ხსნარი 10 ფლაკონი'), '1გ/10მლ');
  assert.equal(doseTextFromName('სანოვიტი - Sunovit სიროფი 100 მლ'), null);
});

test('dosage-form groups: the brand name never decides the form', () => {
  assert.equal(formGroupOf('როტიკოქსი - Roticox ტაბ.120მგ N7'), 'tablet');
  assert.equal(formGroupOf('კრემი', 'ადვანტანი - Advantan კრემი 0.1% 30გ'), 'cream');
  assert.equal(formGroupOf('მალამო', 'ვიროგელი მალამო ცხვირის 0.3% 15გრ'), 'ointment');
  assert.equal(formGroupOf('ხსნარი საინექციო'), 'injection');
  assert.equal(formGroupOf('ტაბლეტი შუშხუნა'), 'tablet-eff');
});

test('variant marks agree across alphabets', () => {
  assert.deepEqual(modifiersOf('ასკოფენი ლ ტაბლეტი #10'), modifiersOf('Askophen L - ასკოფენი L 10 ტაბლეტი'));
  assert.deepEqual(modifiersOf('ტრიმეკორი MR ტაბლეტი 35მგ #60'), ['mr']);
  assert.deepEqual(modifiersOf('ნუროფენი ექსპრეს ფორტე'), modifiersOf('Nurofen Express Forte'));
});

test('active substances: placeholders are unknown, alphabets and salts compare loosely', () => {
  assert.equal(splitInn('combined drug'), null);
  assert.equal(splitInn('homeopathic comb.drug'), null);
  assert.deepEqual(splitInn('amoxicillin+clavulanic acid'), ['amoxicillin', 'clavulanic acid']);
  assert.equal(innKey(['levothyroxine sodium']), innKey(['levothyroxine']));
  assert.equal(innKey(['vit.D3']), innKey(['ქოლეკალციფეროლი (ვიტამინი D3)']));
  assert.ok(innCompatible(innKey(['magnesium sulfate']), innKey(['მაგნიუმის სულფატი'])));
  assert.ok(!innCompatible(innKey(['atorvastatin']), innKey(['bisoprolol'])));
});

test('prescription from a PSP leaflet: only the dispensing rule counts', () => {
  assert.equal(prescriptionFromLeaflet('ფარმაცევტული პროდუქტის ჯგუფი II, გაიცემა ფორმა №3 რეცეპტით'), true);
  assert.equal(prescriptionFromLeaflet('II ჯგუფი, გაიცემა ფორმა №3 რეცეპტით (გადაუდებელი დახმარებისას გაიცემა ურეცეპტოდ)'), true);
  assert.equal(prescriptionFromLeaflet('ჯგუფი III, გაიცემა რეცეპტის გარეშე'), false);
  // Every leaflet says this; it is not about the medicine itself (Concor was read as OTC because of it).
  assert.equal(prescriptionFromLeaflet('თუ იყენებთ რეცეპტით გაცემულ ან ურეცეპტოდ გაცემულ მედიკამენტს, აცნობეთ ექიმს'), null);
  assert.equal(prescriptionFromLeaflet('კლინიკურ-ფარმაკოლოგიური ჯგუფი: სელექტიური ბეტა1-ადრენობლოკატორი'), null);
});

test('countries from ISO labels and Georgian names', () => {
  assert.equal(countryIso('თურქეთი(TR)'), 'TR');
  assert.equal(countryIso('რუსეთის ფედერაცია'), 'RU');
  assert.equal(countryIso('გერმანია / Germany'), 'DE');
});

test('the same box at PSP and at Pharmadepot gets the same identity', () => {
  const psp = identityOf(
    'ნუროფენი - Nurofen 200მგ 10 ტაბლეტი',
    factsFromPsp({ moqmedi_nivtiereba: 'ibuprofen', doza: '200მგ', migebis_forma: 'ტაბლეტი საღეჭი', raodenoba_forma: '10 შემოგარსული ტაბლეტი', country_of_manufacture: 'GB', attrs: { units: '10' } }),
    'PSP',
  );
  const pd = identityOf(
    'ნუროფენი ტაბლეტი 200მგ #10',
    factsFromPharmadepot({ id: 4423, name: 'ნუროფენი', full_name: 'ნუროფენი ტაბლეტი 200მგ #10', medicament_characteristic: { dose: '200მგ', shape: 'ტაბლეტი', numerus: 10, need_recipe: false, generic: 'იბუპროფენი', manufacturer: 'რეკიტ ბენკიზერი', manufacturer_country_name: 'დიდი ბრიტანეთი' }, med_code: '1' }),
    'PHARMADEPOT',
  );
  assert.ok(pd.brands.some((b) => psp.brands.includes(b)));
  assert.equal(psp.dose, pd.dose);
  assert.equal(psp.count, pd.count);
  assert.equal(psp.formGroup, pd.formGroup);
  assert.ok(innCompatible(psp.inn, pd.inn));
  assert.equal(pd.rx, false);
  assert.equal(psp.country, 'GB');
  assert.equal(pd.country, 'GB');
});

test('a generic named only by its substance keeps its maker word in the brand', () => {
  const a = identityOf('პაროქსეტინი ნორმონი ტაბლეტი 20მგ #28', { brand: 'პაროქსეტინი ნორმონი', innKa: 'პაროქსეტინი' }, 'PHARMADEPOT');
  const b = identityOf('პაროქსეტინი-ნორმონი - Paroxetine Normon 20მგ 28 ტაბლეტი', { inn: 'paroxetine' }, 'PSP');
  assert.ok(a.brands.some((x) => b.brands.includes(x)));
  const plain = identityOf('კაპტოპრილი ტაბლეტი 25მგ #40', { brand: 'კაპტოპრილი', innKa: 'კაპტოპრილი' }, 'PHARMADEPOT');
  assert.equal(plain.generic, true);
});
