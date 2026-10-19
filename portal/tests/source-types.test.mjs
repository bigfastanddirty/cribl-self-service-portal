import {test} from 'node:test';
import assert from 'node:assert/strict';
import {SOURCE_TYPES,sourceTypeChoices} from '../source-types.mjs';
test('all catalog types have help and unique safe summary choices',()=>{
 const choices=sourceTypeChoices([]);
 assert.equal(new Set(choices.map(s=>s.key)).size,SOURCE_TYPES.length);
 assert.ok(choices.length>70);
 assert.ok(choices.every(s=>s.description.length>20 && s.provisioning==='summary'));
 assert.ok(!choices.some(s=>/^(system|cribl|journal)/i.test(s.label)));
 assert.ok(choices.some(s=>s.key==='type:collector:rest'));
});
test('configured mapped HEC alone can provision; disabled HEC stays summary-only',()=>{
 for(const disabled of [false,true]) {
  const choices=sourceTypeChoices([{key:'hec',label:'Splunk HEC',type:'splunk_hec',disabled}],{source:'hec'});
  assert.equal(choices.filter(s=>s.label==='Splunk HEC').length,1);
  assert.equal(choices.find(s=>s.key==='hec').provisioning,disabled?'summary':'hec');
 }
});
