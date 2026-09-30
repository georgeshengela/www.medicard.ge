import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGeoLatinMap, buildLooseMatchSignature } from './normalize.js';

function signatures(names) {
  const geo = buildGeoLatinMap(names);
  return names.map((n) => buildLooseMatchSignature(n, geo));
}

test('a release qualifier (MR) does not split PSP and Pharmadepot/GPC names of the same drug', () => {
  const [psp, pd, gpc] = signatures([
    'ტრიმეკორი MR - Trimecor MR 35მგ 60 ტაბლეტი',
    'ტრიმეკორი MR ტაბლეტი 35მგ #60',
    'ტრიმეკორი MR ტაბლეტი 35მგ #60',
  ]);
  assert.equal(psp, 'trimecor|mr|35|q60');
  assert.equal(pd, psp);
  assert.equal(gpc, psp);
});

test('the qualifier stays part of the identity: MR and plain are different products', () => {
  const [mr, plain] = signatures([
    'გლუკოფაჟი XR - Glucophage XR 500მგ 30 ტაბლეტი',
    'გლუკოფაჟი - Glucophage 500მგ 30 ტაბლეტი',
  ]);
  assert.notEqual(mr, plain);
  assert.equal(mr, 'glucophage|xr|500|q30');
});

test('names without a qualifier keep their previous signature', () => {
  const [psp, pd] = signatures(['ბისოგამა - Bisogamma 10მგ 30 ტაბლეტი', 'ბისოგამა ტაბლეტი 10მგ #30']);
  assert.equal(psp, 'bisogamma|10|q30');
  assert.equal(pd, psp);
});
