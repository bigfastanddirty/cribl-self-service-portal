import {test} from 'node:test';import assert from 'node:assert/strict';import {discoveredHecTarget} from '../hec-discovery.mjs';
const sources=[{key:'in_hec',type:'splunk_hec',disabled:false}];
const source={id:'in_hec',type:'splunk_hec',port:8088,splunkHecAPI:'/services/collector',authTokens:[{token:'private'}]};
test('discovers enabled HEC listener with approved default hostname and no secrets',()=>{
 const result=discoveredHecTarget(sources,source);assert.deepEqual(result,{source:'in_hec',endpoint:'http://hec.allstate.com:8088/services/collector'});assert.doesNotMatch(JSON.stringify(result),/private|authTokens/);
 assert.equal(discoveredHecTarget(sources,{...source,port:443,tls:{disabled:false}}).endpoint,'https://hec.allstate.com/services/collector');
});
test('requires exactly one HEC source and valid listener metadata',()=>{
 assert.equal(discoveredHecTarget([],source),undefined);assert.equal(discoveredHecTarget([...sources,...sources],source),undefined);
 for(const invalid of [{port:0},{port:'8088'},{splunkHecAPI:'//other'},{splunkHecAPI:'/../x'},{tls:{}},{id:'wrong'}])assert.equal(discoveredHecTarget(sources,{...source,...invalid}),undefined);
 assert.throws(()=>discoveredHecTarget(sources,source,'https://other/path'));
});
