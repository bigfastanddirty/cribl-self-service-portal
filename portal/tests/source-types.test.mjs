import {test} from 'node:test';import assert from 'node:assert/strict';
import {sourceTypeChoices} from '../source-types.mjs';
test('shows only enabled configured sources with descriptions; no unconfigured types',()=>{
 const choices=sourceTypeChoices([{key:'hec',type:'splunk_hec',label:'Splunk HEC',disabled:false},{key:'syslog',type:'syslog',label:'Syslog',disabled:true}],{source:'hec'});
 assert.equal(choices.length,1);assert.equal(choices[0].provisioning,'hec');assert.ok(choices[0].description);assert.deepEqual(sourceTypeChoices([]),[]);
});
