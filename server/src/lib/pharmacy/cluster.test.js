import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clusterOffers } from './cluster.js';
import { factsFromPharmadepot, factsFromPsp, identityOf } from './facts.js';

let n = 0;
const psp = (name, f = {}) => {
  const facts = factsFromPsp({
    moqmedi_nivtiereba: f.inn,
    doza: f.dose,
    migebis_forma: f.form,
    moculoba: f.volume,
    raodenoba_forma: f.pack,
    country_of_manufacture: f.country,
    attrs: f.units ? { units: String(f.units) } : {},
  });
  n += 1;
  return { key: `PSP:${n}`, sourceId: 'PSP', name, identity: identityOf(name, facts, 'PSP') };
};
const pd = (sourceId, name, c, medCode = null) => {
  const facts = factsFromPharmadepot({ id: n, name: c.brand, full_name: name, med_code: medCode, medicament_characteristic: { generic: c.inn, dose: c.dose, shape: c.form, volume: c.volume, numerus: c.count, manufacturer_country_name: c.country, need_recipe: c.rx ?? null } });
  n += 1;
  return { key: `${sourceId}:${n}`, sourceId, name, identity: identityOf(name, facts, sourceId) };
};
const groupOf = (groups, offer) => groups.find((g) => g.includes(offer.key));

test('the same box at PSP, Pharmadepot and GPC is one product', () => {
  const a = psp('ნუროფენი - Nurofen 200მგ 10 ტაბლეტი', { inn: 'ibuprofen', dose: '200მგ', form: 'ტაბლეტი', units: 10, country: 'GB' });
  const b = pd('PHARMADEPOT', 'ნუროფენი ტაბლეტი 200მგ #10', { brand: 'ნუროფენი', inn: 'იბუპროფენი', dose: '200მგ', form: 'ტაბლეტი', count: 10, country: 'დიდი ბრიტანეთი' }, '77');
  const c = pd('GPC', 'ნუროფენი ტაბლეტი 200მგ #10', { brand: 'ნუროფენი', inn: 'იბუპროფენი', dose: '200მგ', form: 'ტაბლეტი', count: 10, country: 'დიდი ბრიტანეთი' }, '77');
  const other = pd('PHARMADEPOT', 'ნუროფენი ტაბლეტი 200მგ #20', { brand: 'ნუროფენი', inn: 'იბუპროფენი', dose: '200მგ', form: 'ტაბლეტი', count: 20, country: 'დიდი ბრიტანეთი' }, '78');
  const groups = clusterOffers([a, b, c, other]);
  assert.deepEqual(groupOf(groups, a).sort(), [a.key, b.key, c.key].sort());
  assert.deepEqual(groupOf(groups, other), [other.key]);
});

test('Concor made in Germany is compared with Concor made in Germany, not with the Turkish one', () => {
  const tr = psp('კონკორი - Concor 10მგ 30 ტაბლეტი', { inn: 'bisoprolol', dose: '10მგ', form: 'ტაბლეტი', units: 30, country: 'TR' });
  const de = psp('Concor - კონკორი 10მგ. 30 ტაბლეტი', { inn: 'bisoprolol', dose: '10მგ', form: 'ტაბლეტი', units: 30, country: 'DE' });
  const pdDe = pd('PHARMADEPOT', 'კონკორი ტაბლეტი 10მგ #30', { brand: 'კონკორი', inn: 'ბისოპროლოლი', dose: '10მგ', form: 'ტაბლეტი', count: 30, country: 'გერმანია' });
  const groups = clusterOffers([tr, de, pdDe]);
  assert.deepEqual(groupOf(groups, pdDe).sort(), [de.key, pdDe.key].sort());
  assert.deepEqual(groupOf(groups, tr), [tr.key]);
});

test('a box named only by its substance from another country is another maker’s box', () => {
  const a = psp('კაპტოპრილი - Captopril 25მგ 40 ტაბლეტი', { inn: 'captopril', dose: '25მგ', form: 'ტაბლეტი', units: 40, country: 'BG' });
  const b = pd('PHARMADEPOT', 'კაპტოპრილი ტაბლეტი 25მგ #40', { brand: 'კაპტოპრილი', inn: 'კაპტოპრილი', dose: '25მგ', form: 'ტაბლეტი', count: 40, country: 'რუსეთის ფედერაცია' });
  const groups = clusterOffers([a, b]);
  assert.equal(groups.length, 2);
});

test('cream and ointment of one brand stay apart', () => {
  const cream = psp('ადვანტანი - Advantan კრემი 0.1% 30გ', { inn: 'methylprednisolone aceponate', form: 'კრემი', units: 1, country: 'TR' });
  const ointment = pd('PHARMADEPOT', 'ადვანტანი მალამო 0.1% 30გრ ტუბი #1', { brand: 'ადვანტანი', inn: 'მეთილპრედნიზოლონის აცეპონატი', dose: '0.1%', form: 'მალამო', volume: '30გრ', count: 1, country: 'თურქეთი' });
  const pdCream = pd('PHARMADEPOT', 'ადვანტანი კრემი 0.1% 30გრ ტუბი #1', { brand: 'ადვანტანი', inn: 'მეთილპრედნიზოლონის აცეპონატი', dose: '0.1%', form: 'კრემი', volume: '30გრ', count: 1, country: 'თურქეთი' });
  const groups = clusterOffers([cream, ointment, pdCream]);
  assert.deepEqual(groupOf(groups, cream).sort(), [cream.key, pdCream.key].sort());
  assert.deepEqual(groupOf(groups, ointment), [ointment.key]);
});

test('a flavour both chains name is its own box', () => {
  const plain = psp('დორიტრიცინი - Doritricin 20 ტაბლეტი', { form: 'ტაბლეტი საწუწნი', units: 20, country: 'DE' });
  const berry = psp('დორიტრიცინი - Doritricin ტყის კენკრა 20 ტაბლეტი', { form: 'ტაბლეტი საწუწნი', units: 20, country: 'DE' });
  const pdPlain = pd('PHARMADEPOT', 'დორიტრიცინი ტაბლეტი საწუწნი #20', { brand: 'დორიტრიცინი', form: 'ტაბლეტი საწუწნი', count: 20, country: 'გერმანია' });
  const pdBerry = pd('PHARMADEPOT', 'დორიტრიცინი ტყის კენკრა ტაბლეტი საწუწნი #20', { brand: 'დორიტრიცინი ტყის კენკრა', form: 'ტაბლეტი საწუწნი', count: 20, country: 'გერმანია' });
  const groups = clusterOffers([plain, berry, pdPlain, pdBerry]);
  assert.deepEqual(groupOf(groups, plain).sort(), [plain.key, pdPlain.key].sort());
  assert.deepEqual(groupOf(groups, berry).sort(), [berry.key, pdBerry.key].sort());
});

test('a PSP syrup without a dose joins the one Pharmadepot box that fits — and only that one', () => {
  const ivy = psp('ჰერბიონი - Herbion ivy surup სუროს სიროფი-უშაქრო150მლ', { inn: 'hedera helix', form: 'სიროფი', volume: '150 მლ', units: 1, country: 'SI' });
  const plantain = psp('ჰერბიონი - Herbion plantain syrup მრავალძარღვა 150მლ. სიროფი', { form: 'სიროფი', volume: '150 მლ', units: 1, country: 'SI' });
  const pdPlantain = pd('PHARMADEPOT', 'ჰერბიონი მრავალძარღვას სიროფი 150მლ ფლაკონი #1', { brand: 'ჰერბიონი მრავალძარღვას', inn: 'მრავალძარღვა', form: 'სიროფი', volume: '150მლ', count: 1, country: 'სლოვენია' });
  const groups = clusterOffers([ivy, plantain, pdPlantain]);
  assert.deepEqual(groupOf(groups, pdPlantain).sort(), [plantain.key, pdPlantain.key].sort());
  assert.deepEqual(groupOf(groups, ivy), [ivy.key]);
});
