import {hecRouteFilter} from './hec-index.mjs';
/** Clone preparation only. Callers must separately authorize applying drafts. */
export function applicationPipelineId(applicationName) {
 if(typeof applicationName!=='string' || !applicationName.trim() || applicationName.trim().length>100 || /[\x00-\x1f\x7f]/.test(applicationName)) throw new Error('Invalid application / log name');
 const suffix=applicationName.trim().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_').replace(/^_+|_+$/g,'');
 if(!suffix)throw new Error('Application name must include letters or numbers');
 const id='pl_'+suffix;
 if(id==='pl_json')throw new Error('Application name conflicts with the template');
 return id;
}
export function cloneJsonTemplate(template,{applicationName,barometerId}) {
 const id=applicationPipelineId(applicationName);
 if(typeof barometerId!=='string' || !barometerId.trim() || barometerId.trim().length>128 || /[\x00-\x1f\x7f]/.test(barometerId))throw new Error('Invalid BarometerIT');
 if(template?.id!=='pl_json' || !Array.isArray(template.conf?.functions))throw new Error('The pl_json template is unavailable');
 const clone=structuredClone(template);
 const matches=clone.conf.functions.flatMap(f=> f.id==='eval' && !f.disabled ? (f.conf?.add||[]).filter(a=>a.name==='BarometerIT' && !a.disabled):[]);
 if(matches.length!==1)throw new Error('Template must contain exactly one active BarometerIT assignment');
 matches[0].value=JSON.stringify(barometerId.trim()).replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
 // Preserve the template configuration, never metadata added by read APIs.
 return {id,conf:clone.conf};
}
export function applicationRoute(applicationName,pipelineId,policy,matching) {
 if(pipelineId!==applicationPipelineId(applicationName))throw new Error('Pipeline reference mismatch');
 if(!['disabled-review','first-final','before-default-final'].includes(policy))throw new Error('Route placement policy must be approved');
 return {name:applicationName.trim(),pipeline:pipelineId,filter:hecRouteFilter(matching),output:'devnull',disabled:policy==='disabled-review',final:policy!=='disabled-review',description:'',enableOutputExpression:false,clones:[]};
}
