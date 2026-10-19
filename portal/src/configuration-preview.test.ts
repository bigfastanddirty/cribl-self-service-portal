import {describe,it,expect} from 'vitest';
import {planJsonPreview,generatePipeline} from './configuration-preview';
describe('JSON configuration proposal',()=>{
 it('matches the supplied JSON pipeline structure',()=>{
  const plan=planJsonPreview({pipelineId:'pl_test_json',barometerIT:'sdffsesdfsdf'});
  expect(generatePipeline(plan.pipeline)).toEqual({id:'pl_test_json',conf:{output:'default',streamtags:[],groups:{},asyncFuncTimeout:1000,functions:[{filter:'true',conf:{mode:'extract',type:'json',srcField:'_raw',remove:[]},id:'serde'},{filter:'true',conf:{printUndefineds:false,add:[{disabled:false,name:'BarometerIT',value:'"sdffsesdfsdf"'}],keep:[],remove:['_raw']},id:'eval'}],description:''}});
  expect(plan.route.status).toBe('unresolved');
  expect(plan.route.missing).toContain('Approved event matching rule');
 });
 it('encodes customer text as a literal, including quotes and backslashes',()=>{
  const input=`a'"\\; (()=>evil())()`;
  const plan=planJsonPreview({pipelineId:'pl_json',barometerIT:input});
  const value=generatePipeline(plan.pipeline).conf.functions[1].conf.add![0].value;
  expect(JSON.parse(value)).toBe(input);
 });
 it('rejects invalid IDs and BarometerIT values',()=>{
  for(const pipelineId of ['', '../foo','x y','x'.repeat(129)]) expect(()=>planJsonPreview({pipelineId,barometerIT:'BAR-1'})).toThrow();
  for(const barometerIT of ['', '  ', 'x\n', 'x'.repeat(129)]) expect(()=>planJsonPreview({pipelineId:'pl_json',barometerIT})).toThrow();
 });
 it('rejects altered recipes and unsupported actions',()=>{
  const plan=planJsonPreview({pipelineId:'pl_json',barometerIT:'BAR-1'}).pipeline;
  plan.actions.pop(); expect(()=>generatePipeline(plan)).toThrow('Unsupported pipeline plan');
 });
 it('is deterministic and trims outer BarometerIT whitespace',()=>{
  const input={pipelineId:'pl_json',barometerIT:' BAR-1 '};
  expect(planJsonPreview(input)).toEqual(planJsonPreview(input));
  expect(planJsonPreview(input).pipeline.actions[1]).toEqual({kind:'set-literal',field:'BarometerIT',value:'BAR-1'});
 });
});
