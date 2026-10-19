export function validHecIndex(value) {
 return typeof value==='string' && !!value.trim() && value.trim().length<=128 && !/[\x00-\x1f\x7f]/.test(value);
}
export function hecRouteFilter({index,source}={}) {
 if(!validHecIndex(index) || typeof source!=='string' || !/^[A-Za-z0-9_-]{1,256}$/.test(source))throw new Error('Invalid HEC route matching fields');
 const literal=value=>"'"+value.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+"'";
 return '__inputId=='+literal('splunk_hec:'+source)+' && index.includes('+literal(index.trim())+')';
}
