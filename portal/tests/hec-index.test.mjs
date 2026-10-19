import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';
import {validHecIndex,hecRouteFilter} from '../hec-index.mjs';
test('matches the selected HEC input AND an index containing the entered text',()=>{
 const filter=hecRouteFilter({source:'HEC',index:'aquasec'});
 assert.equal(filter,"__inputId=='splunk_hec:HEC' && index.includes('aquasec')");
 for(const [source,index,expected] of [['splunk_hec:HEC','prod_aquasec_logs',true],['splunk_hec:other','prod_aquasec_logs',false],['splunk_hec:HEC','other',false],['splunk_hec:HEC','AQUASEC',false]])assert.equal(vm.runInNewContext(filter,{__inputId:source,index},{timeout:100}),expected);
});
test('quotes index text as data, never executable filter source',()=>{
 const index="a'\\ || hacked=true; //";const filter=hecRouteFilter({source:'HEC',index});const context={__inputId:'splunk_hec:HEC',index,hacked:false};
 assert.equal(vm.runInNewContext(filter,context,{timeout:100}),true);assert.equal(context.hacked,false);
});
test('rejects missing, blank, control characters and oversized index text',()=>{
 for(const index of [undefined,'','   ','a\nb','x'.repeat(129)]){assert.equal(validHecIndex(index),false);assert.throws(()=>hecRouteFilter({source:'HEC',index}));}
 assert.equal(validHecIndex(' aquasec '),true);
});
