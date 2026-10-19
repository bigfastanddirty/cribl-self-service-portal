// Only fixed codes cross the diagnostics boundary. Never serialize Error objects.
const known = new Map([
 ['Pending configuration changes require administrator review','CRIBL_PENDING_CHANGES'],
 ['No healthy Worker is available for this location','NO_HEALTHY_WORKER'],
 ['HEC is not enabled for this location','HEC_SOURCE_NOT_READY'],
 ['HEC endpoint mapping does not match its source','HEC_ENDPOINT_MISMATCH'],
 ['Private state directory required','PRIVATE_STATE_PERMISSION'],
 ['HEC commit could not be verified','HEC_COMMIT_UNCONFIRMED'],
 ['HEC is unavailable for this location','HEC_TARGET_UNAVAILABLE'],
 ['The pl_json template is unavailable','JSON_TEMPLATE_MISSING'],
 ['Template must contain exactly one active BarometerIT assignment','JSON_TEMPLATE_INVALID'],
 ['Application pipeline or route already exists; administrator review required','RESOURCE_COLLISION'],
 ['Pipeline collision or configuration changed','RESOURCE_COLLISION'],
 ['Route collision or placement changed','ROUTE_CHANGED'],
 ['Default must be the last route','DEFAULT_ROUTE_PLACEMENT'],
 ['Request changed; use a new request','REQUEST_CHANGED'],
 ['Routing table changed; retry after administrator review','ROUTE_CHANGED'],
 ['Pipeline creation could not be verified','PIPELINE_UNCONFIRMED'],
 ['Route placement could not be verified','ROUTE_UNCONFIRMED'],
 ['Worker Groups unavailable','CRIBL_AUTH_OR_CATALOG_UNAVAILABLE'],
 ['Credentials unavailable','CRIBL_CREDENTIALS_UNAVAILABLE'],
 ['Location unavailable','LOCATION_UNAVAILABLE'],
]);
export function diagnosticCode(failure) {
 if(failure?.cause && failure.cause!==failure){const nested=diagnosticCode(failure.cause);if(nested!=='SETUP_UNCONFIRMED')return nested;}
 if(['SELF_SIGNED_CERT_IN_CHAIN','DEPTH_ZERO_SELF_SIGNED_CERT','UNABLE_TO_VERIFY_LEAF_SIGNATURE','CERT_HAS_EXPIRED'].includes(failure?.code))return 'CRIBL_TLS_TRUST';
 if(['ECONNREFUSED','ENOTFOUND','ETIMEDOUT'].includes(failure?.code) || failure?.name==='TimeoutError')return 'CRIBL_CONNECTION_FAILED';
 if(failure?.status===401)return 'CRIBL_UNAUTHORIZED';
 if(failure?.status===403)return 'CRIBL_FORBIDDEN';
 if(failure?.status===404)return 'CRIBL_RESOURCE_MISSING';
 if(Number.isInteger(failure?.status) && failure.status>=500)return 'CRIBL_UPSTREAM_ERROR';
 if(known.has(failure?.message))return known.get(failure.message);
 if(failure?.code==='EACCES' || failure?.code==='EPERM')return 'PRIVATE_FILE_PERMISSION';
 if(failure?.code==='ENOENT')return 'PRIVATE_FILE_MISSING';
 if(failure?.code==='HEC_PENDING')return 'HEC_PENDING';
 return 'SETUP_UNCONFIRMED';
}
