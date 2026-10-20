import { diagnosticFetch, monitorHecProgress } from './diagnostics';
export function initializeHec(group: HTMLSelectElement, method: HTMLSelectElement, form: HTMLFormElement): { submit: (onTokenCreated?: (id:string)=>Promise<void>) => Promise<string | undefined>; busy: () => boolean } {
  const find = <T extends HTMLElement>(id: string) => document.getElementById(id)! as T;
  const section = find('hec-action');
  const error = find('hec-error');
  const dialog = find<HTMLDialogElement>('hec-dialog');
  const submitButton = find<HTMLButtonElement>('preview-button');
  const controls = [find<HTMLInputElement>('barometer-id'), find<HTMLInputElement>('requester-email'), group, method, find<HTMLInputElement>('daily-volume'), find<HTMLSelectElement>('volume-unit'), submitButton, form.querySelector<HTMLButtonElement>('button[type=reset]')!, find<HTMLButtonElement>('retry-catalog')];
  let requestId: string | undefined;
  let credentials: { endpoint: string; token: string } | undefined;
  let saved = false;
  let busy = false;
  function clearDialog() { find('hec-endpoint').textContent = ''; find('hec-token').textContent = ''; find('hec-copy-status').textContent = ''; }
  function isHec() { return method.selectedOptions[0]?.dataset.provisioning === 'hec'; }
  function render() { section.hidden = !isHec();find<HTMLInputElement>('hec-index').required=isHec();find<HTMLInputElement>('hec-index').disabled=!isHec(); }
  function reset() { find<HTMLInputElement>('hec-index').value='';requestId = undefined; credentials = undefined; saved = false; error.hidden = true; dialog.close(); clearDialog(); render(); }
  function showCredentials() {
    find('hec-endpoint').textContent = credentials!.endpoint;
    find('hec-token').textContent = credentials!.token;
    find('hec-dialog-status').textContent = 'Token saved in Cribl. No commit or deployment was performed. Ask your administrator to review and deploy before sending logs.';
    if (!dialog.open) dialog.showModal();
  }
  group.addEventListener('change', reset); method.addEventListener('change', reset);
  form.addEventListener('reset', () => { reset(); queueMicrotask(render); });
  dialog.addEventListener('close', clearDialog);
  find('close-hec').addEventListener('click', () => dialog.close());
  find('copy-hec').addEventListener('click', async () => {
    if (!credentials) return;
    try { await navigator.clipboard.writeText(credentials.token); find('hec-copy-status').textContent = 'Token copied.'; }
    catch { find('hec-copy-status').textContent = 'Select the token text and copy it manually.'; }
  });
  render();
  return { busy: () => busy, async submit(onTokenCreated?: (id:string)=>Promise<void>) {
    if (busy || !group.value || !isHec()) return;
    if (credentials && saved) { showCredentials(); if(requestId)await onTokenCreated?.(requestId);return requestId; }
    // getRandomValues also works on the development portal's LAN HTTP origin.
    if (!requestId) {
      const bytes = crypto.getRandomValues(new Uint8Array(16)); bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      requestId = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
    }
    const previousDisabled = controls.map(control => control.disabled);
    find('hec-progress').textContent = 'Saving HEC credentials in Cribl…';
    busy = true; error.hidden = true; controls.forEach(control => control.disabled = true); submitButton.textContent = 'Submitting…'; find('hec-progress').hidden = false;
    const stopProgress=monitorHecProgress(requestId!);
    try {
      let displayed = false;
      if (credentials) { showCredentials(); displayed = true; }
      const response=await diagnosticFetch('/api/hec',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({group:group.value,requestId,source:method.value,index:find<HTMLInputElement>('hec-index').value.trim(),barometerId:find<HTMLInputElement>('barometer-id').value.trim()}),cache:'no-store'});
      if(!response.ok || response.status===202)throw new Error();
      const data=await response.json();
      if(typeof data.endpoint!=='string' || typeof data.token!=='string' || !data.token)throw new Error();
      credentials={endpoint:data.endpoint,token:data.token};saved=true;
      if(!displayed || dialog.open)showCredentials();
      await onTokenCreated?.(requestId!);
      find('hec-progress').textContent='HEC credentials saved for administrator review.';return requestId;
    } catch { if (credentials) find('hec-dialog-status').textContent = 'Token saved. No commit or deployment was performed.'; error.hidden = false; error.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    finally { stopProgress();find('hec-progress').hidden = true; busy = false; controls.forEach((control,index) => control.disabled = previousDisabled[index]); submitButton.textContent = 'Submit request'; }
  } };
}
