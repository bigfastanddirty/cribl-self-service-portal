import {test} from 'node:test';import assert from 'node:assert/strict';
import {applicationPipelineId,cloneJsonTemplate,applicationRoute} from '../json-clone.mjs';
const template={id:'pl_json',conf:{functions:[{id:'serde',conf:{mode:'extract',type:'json',srcField:'_raw'}},{id:'eval',conf:{add:[{name:'BarometerIT',value:"'old'"}],remove:['_raw']}}],output:'default'}};
test('clones template configuration and changes only identity and BarometerIT',()=>{
 const before=structuredClone(template),input={applicationName:'Akamai Audit',barometerId:' BAR-1 '};
 const result=cloneJsonTemplate(template,input);assert.equal(result.id,'pl_Akamai_Audit');assert.equal(result.conf.functions[1].conf.add[0].value,'"BAR-1"');assert.deepEqual(template,before);
 result.conf.functions[1].conf.add[0].value="'old'";assert.deepEqual(result.conf,template.conf);
});
test('rejects missing template, ambiguous assignments and reserved identity',()=>{
 assert.throws(()=>cloneJsonTemplate(undefined,{applicationName:'A',barometerId:'B'}));
 const multiple=structuredClone(template);multiple.conf.functions[1].conf.add.push({name:'BarometerIT',value:'1'});
 assert.throws(()=>cloneJsonTemplate(multiple,{applicationName:'A',barometerId:'B'}));assert.throws(()=>applicationPipelineId('json'));
});
test('requires explicit route policy and generates the requested references',()=>{
 assert.throws(()=>applicationRoute('Akamai Audit','pl_Akamai_Audit'));
 const route=applicationRoute('Akamai Audit','pl_Akamai_Audit','disabled-review',{source:'HEC',index:'aquasec'});
 assert.equal(route.name,'Akamai Audit');assert.equal(route.pipeline,'pl_Akamai_Audit');assert.equal(route.filter,"__inputId=='splunk_hec:HEC' && index.includes('aquasec')");assert.equal(route.output,'devnull');assert.equal(route.disabled,true);
});
