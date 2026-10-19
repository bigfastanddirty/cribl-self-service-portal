import {test} from 'node:test';import assert from 'node:assert/strict';import {diagnosticCode} from '../diagnostics.mjs';
test('diagnostic errors expose only fixed codes, never upstream messages or secrets',()=>{
 assert.equal(diagnosticCode(new Error('password=secret token=secret')),'SETUP_UNCONFIRMED');
 assert.equal(diagnosticCode(new Error('Pending configuration changes require administrator review')),'CRIBL_PENDING_CHANGES');
 assert.equal(diagnosticCode({status:403,message:'private upstream response'}),'CRIBL_FORBIDDEN');
});
