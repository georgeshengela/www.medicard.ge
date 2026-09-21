import test from 'node:test';
import assert from 'node:assert/strict';
import { assistantFieldChoices } from './assistantOptions.ts';

test('partial label choices never hide valid enum options',()=>{
  const {options}=assistantFieldChoices('destination',{enum:['home','cycle','pets']},{},{destination:[{value:'home',label:'მთავარი'}]});
  assert.deepEqual(options,['home','cycle','pets']);
});
test('pet destinations retain every page and never reuse human profile labels',()=>{
  const {options,refs}=assistantFieldChoices('destination',{enum:['profile','edit','care','care/history']},{},{destination:[{value:'profile',label:'ჩემი პროფილი'}]});
  assert.deepEqual(options,['profile','edit','care','care/history']);assert.equal(refs,undefined);
});
test('no owned records remains an empty selector rather than a free-text identifier',()=>{
  const {options}=assistantFieldChoices('medicationId',{type:'string'},{},{medicationId:[]});
  assert.deepEqual(options,[]);
});
test('care products are selected for the chosen pet only',()=>{
  const {options}=assistantFieldChoices('productId',{type:'string'},{petId:'a'},{'productId:a':[{value:'one',label:'One'}],'productId:b':[{value:'two',label:'Two'}]});
  assert.deepEqual(options,['one']);
});
