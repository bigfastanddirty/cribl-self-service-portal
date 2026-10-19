/** Pure, versioned proposal generation. No network, filesystem, or deployment. */
export type ProcessingAction =
  | {kind:'parse-json'; sourceField:'_raw'}
  | {kind:'set-literal'; field:'BarometerIT'; value:string}
  | {kind:'remove-fields'; fields:['_raw']};
export interface PipelinePlan {
  version:1;
  recipe:'json-with-barometer-v1';
  id:string;
  actions:ProcessingAction[];
}
export interface ConfigurationPreview {
  version:1;
  mode:'preview-only';
  pipeline:PipelinePlan;
  route:{status:'unresolved'; missing:string[]};
  summary:string[];
  limitations:string[];
}
interface CriblFunction {
  id:'serde'|'eval';
  filter:'true';
  conf:{mode?:'extract';type?:'json';srcField?:'_raw';remove:string[];printUndefineds?:false;add?:{disabled:false;name:'BarometerIT';value:string}[];keep?:string[]};
}
function validIdentity(id:string,barometerIT:string):string {
  if(typeof id!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error('Invalid proposed pipeline identifier');
  if(typeof barometerIT!=='string' || !barometerIT.trim() || barometerIT.trim().length>128 || /[\x00-\x1f\x7f]/.test(barometerIT)) throw new Error('Invalid BarometerIT');
  return barometerIT.trim();
}
export function planJsonPreview(input:{pipelineId:string;barometerIT:string}):ConfigurationPreview {
  const value=validIdentity(input.pipelineId,input.barometerIT);
  if(input.pipelineId !== 'pl_json') throw new Error('JSON recipe pipeline must be named pl_json');
  return {
    version:1,mode:'preview-only',
    pipeline:{version:1,recipe:'json-with-barometer-v1',id:'pl_json',actions:[{kind:'parse-json',sourceField:'_raw'},{kind:'set-literal',field:'BarometerIT',value},{kind:'remove-fields',fields:['_raw']}]},
    route:{status:'unresolved',missing:['Approved event matching rule','Destination reference','Route placement and stop-after-match policy','Resource naming and collision policy']},
    summary:['Extract fields from JSON in the original log message.',`Set BarometerIT to ${value}.`,'Remove the original log message after the processing steps.','Propose a pipeline only; no Cribl configuration is changed.'],
    limitations:['JSON processing is an explicitly selected recipe, not inferred from the collection source.','Malformed JSON, field collisions, and raw-message removal on parse failure require runtime verification before deployment.','The default output and 1,000 ms timeout reproduce the supplied example; they are not approved routing policy.','Route generation is blocked until matching, destination, placement, and naming policies are defined.'],
  };
}
export function generatePipeline(plan:PipelinePlan) {
  // Fixed recipe only: reject changed/unapproved actions rather than interpreting them.
  const value=plan?.actions?.[1]?.kind==='set-literal' ? plan.actions[1].value : '';
  const expected=planJsonPreview({pipelineId:plan?.id,barometerIT:value}).pipeline;
  if(JSON.stringify(plan)!==JSON.stringify(expected)) throw new Error('Unsupported pipeline plan');
  const functions:CriblFunction[]=[
    {filter:'true',conf:{mode:'extract',type:'json',srcField:'_raw',remove:[]},id:'serde'},
    {filter:'true',conf:{printUndefineds:false,add:[{disabled:false,name:'BarometerIT',value:JSON.stringify(value).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')}],keep:[],remove:['_raw']},id:'eval'},
  ];
  return {id:plan.id,conf:{output:'default',streamtags:[],groups:{},asyncFuncTimeout:1000,functions,description:''}};
}
