import { diagnosticFetch, initializeDiagnostics, recordDiagnostic } from './diagnostics';
import './style.css';
import {createProcessingSender} from './processing';
import { createSummarySender } from './summary';
import { initializeHec } from './hec';
import { classifyLog, type LogFinding } from './log-analysis';
import { validateDraft, validateSample, type Catalog, type CatalogEntry, type Draft, type Errors } from './domain';
import { parseCatalog, parseSourceCatalog } from './catalog';

function element<T extends HTMLElement>(id: string): T {
  const result = document.getElementById(id);
  if (!result) throw new Error(`Missing interface element: ${id}`);
  return result as T;
}
initializeDiagnostics();
const form = element<HTMLFormElement>('request-form');
const barometerId = element<HTMLInputElement>('barometer-id');
const applicationName = element<HTMLInputElement>('application-name');
const email = element<HTMLInputElement>('requester-email');
const summarySender = createSummarySender();
const processingSender = createProcessingSender();
let submitting = false;
const group = element<HTMLSelectElement>('worker-group');
const method = element<HTMLSelectElement>('collection-method');
const sampleInput = element<HTMLInputElement>('sample');
const volume = element<HTMLInputElement>('daily-volume');
const volumeUnit = element<HTMLSelectElement>('volume-unit');
const override = element<HTMLSelectElement>('log-type-override');
const previewButton = element<HTMLButtonElement>('preview-button');
const hec = initializeHec(group, method, form);
let catalog: Catalog | undefined;
let sourceVersion = 0;
let selectedFile: File | undefined;
let finding: LogFinding | undefined;
let analysisVersion = 0;
let attemptedReview = false;
const fields = { applicationName, email, barometerId, group, sample: sampleInput, method, volume, override };

function draft(): Draft {
  return { applicationName:applicationName.value.trim(), barometerId:barometerId.value.trim(), email: email.value.trim(), group: group.value, method: method.value, dailyVolume: {value:volume.value,unit:volumeUnit.value}, logTypeOverride: override.value, sample: selectedFile ? { name: selectedFile.name, size: selectedFile.size, type: selectedFile.type } : undefined };
}
function showErrors(errors: Errors): void {
  for (const key of ['email', 'applicationName', 'barometerId', 'group', 'method', 'volume', 'sample', 'override'] as const) {
    element(`${key}-error`).textContent = errors[key] || '';
    fields[key].setAttribute('aria-invalid', errors[key] ? 'true' : 'false');
    if (key === 'volume') volumeUnit.setAttribute('aria-invalid', errors[key] ? 'true' : 'false');
  }
}
function invalidatePreview(): void {
  if (!element('preview-result').hidden) element('announcement').textContent = 'Your request changed. Review the preview again to see the latest selections.';
  element('preview-result').hidden = true;
  element('preview-empty').hidden = false;
  element('processing-status').textContent = '';
  element('processing-error').hidden = true;
  element('email-status').textContent = '';
  element('summary-email-error').hidden = true;
  if (attemptedReview && catalog) showErrors(validateDraft(draft(), catalog, false));
}
function byteLabel(bytes: number): string {
  return bytes >= 1_000_000 ? `${(bytes / 1_000_000).toFixed(2)} MB` : bytes >= 1000 ? `${(bytes / 1000).toFixed(1)} KB` : `${bytes} bytes`;
}
function clearOverride(): void {
  override.value = '';
  override.options[0].textContent = 'Use detected type';
  element('override-control').hidden = true;
}
function clearSample(): void {
  clearOverride();
  analysisVersion++;
  finding = undefined;
  element('sample-type').textContent = '';
  selectedFile = undefined;
  sampleInput.value = '';
  element('sample-info').hidden = true;
  element('sample-name').textContent = '';
  element('sample-meta').textContent = '';
}
async function selectSample(file: File): Promise<void> {
  clearOverride();
  const version = ++analysisVersion;
  finding = undefined;
  element('sample-type').textContent = '';
  const error = validateSample(file);
  selectedFile = undefined;
  element('sample-info').hidden = true;
  if (error) { sampleInput.value = ''; }
  else {
    element('sample-name').textContent = file.name;
    element('sample-meta').textContent = `${byteLabel(file.size)} (${file.size.toLocaleString()} bytes) · Selected for preview only`;
    element('sample-info').hidden = false;
  }
  invalidatePreview();
  element('sample-error').textContent = error || '';
  sampleInput.setAttribute('aria-invalid', error ? 'true' : 'false');
  if (error) return;
  element('sample-type').textContent = 'Checking log type…';
  try {
    const bytes = await file.arrayBuffer();
    if (version !== analysisVersion) return;
    try {
      finding = classifyLog(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    } catch { finding = { type: 'Other', explanation: 'This sample could not be read as UTF-8 text. Its format could not be determined.' }; }
    selectedFile = file;
    override.options[0].textContent = `Use detected type (${finding.type})`;
    element('override-control').hidden = false;
    element('sample-type').textContent = `Detected type: ${finding.type} · ${finding.explanation}`;
    if (attemptedReview && catalog) showErrors(validateDraft(draft(), catalog, false));
  } catch {
    if (version !== analysisVersion) return;
    clearSample();
    element('sample-error').textContent = 'This file could not be read. Please select it again.';
    sampleInput.setAttribute('aria-invalid', 'true');
  }
}
sampleInput.addEventListener('change', () => {
  const file = sampleInput.files?.[0];
  if (file) void selectSample(file);
});

const uploadBox = element('upload-box');
let dragDepth = 0;
function hasFiles(event: DragEvent): boolean { return Array.from(event.dataTransfer?.types || []).includes('Files'); }
function endDrag(): void { dragDepth = 0; uploadBox.classList.remove('drag-over'); }
uploadBox.addEventListener('dragenter', event => {
  if (!hasFiles(event)) return;
  event.preventDefault();
  dragDepth++;
  uploadBox.classList.add('drag-over');
});
uploadBox.addEventListener('dragover', event => {
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = hasFiles(event) ? 'copy' : 'none';
});
uploadBox.addEventListener('dragleave', () => {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) endDrag();
});
uploadBox.addEventListener('drop', event => {
  event.preventDefault();
  endDrag();
  const files = event.dataTransfer?.files;
  if (!files || files.length !== 1) {
    clearSample(); invalidatePreview();
    element('sample-error').textContent = 'Drop one file at a time, or use the file picker.';
    sampleInput.setAttribute('aria-invalid', 'true');
    return;
  }
  // Mirror the dropped file in the native picker so both entry paths share state.
  sampleInput.files = files;
  void selectSample(files[0]);
});
// Prevent the browser opening a dropped sample as a new page outside the drop zone.
document.addEventListener('dragover', event => { if (hasFiles(event)) event.preventDefault(); });
document.addEventListener('drop', event => { if (hasFiles(event)) event.preventDefault(); endDrag(); });
document.addEventListener('dragend', endDrag);
element('remove-sample').addEventListener('click', () => {
  clearSample(); invalidatePreview(); sampleInput.focus();
});
applicationName.addEventListener('input', invalidatePreview);
email.addEventListener('input', invalidatePreview);
barometerId.addEventListener('input', invalidatePreview);
group.addEventListener('change', invalidatePreview);
method.addEventListener('change', () => { invalidatePreview(); element('source-description').textContent = catalog?.collectionMethods.find(e => e.key === method.value)?.description || ''; });
volume.addEventListener('input', invalidatePreview);
override.addEventListener('change', invalidatePreview);
volumeUnit.addEventListener('change', () => { volume.min = volumeUnit.value === 'TB' ? '0.001' : '1'; invalidatePreview(); });
form.addEventListener('reset', () => {
  resetSources();
  attemptedReview = false; applicationName.value = ''; email.value = ''; barometerId.value = ''; summarySender.reset();
  group.value = ''; method.value = ''; volume.value = ''; volumeUnit.value = 'GB'; volume.min = '1';
  clearSample(); showErrors({}); invalidatePreview();
  element('announcement').textContent = 'Request cleared. The selected sample has been removed.';
});
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!catalog || hec.busy() || submitting) return;
  attemptedReview = true;
  const errors = validateDraft(draft(), catalog, false);
  if (!applicationName.value.trim() || applicationName.value.trim().length > 100 || /[\x00-\x1f\x7f]/.test(applicationName.value)) errors.applicationName = 'Enter an application / log name (up to 100 characters).';
  showErrors(errors);
  const firstError = (['email', 'applicationName', 'barometerId', 'group', 'method', 'volume', 'sample', 'override'] as const).find(key => errors[key]);
  if (firstError) {
    element('preview-result').hidden = true;
    element('preview-empty').hidden = false;
    element('announcement').textContent = 'Please complete the highlighted questions.';
    fields[firstError].focus(); return;
  }
  element('review-application-name').textContent = applicationName.value.trim();
  element('review-barometer-id').textContent = barometerId.value.trim();
  element('review-email').textContent = email.value.trim();
  element('review-group').textContent = catalog.workerGroups.find(e => e.key === group.value)!.label;
  element('review-method').textContent = catalog.collectionMethods.find(e => e.key === method.value)!.label;
  element('review-volume').textContent = `${Number(volume.value)} ${volumeUnit.value} per day`;
  element('preview-empty').hidden = true;
  element('preview-result').hidden = false;
  const heading = element('preview-heading');
  heading.setAttribute('tabindex', '-1');
  heading.focus({ preventScroll: true });
  if (window.innerWidth <= 850) element('preview-result').scrollIntoView({ behavior: 'smooth', block: 'center' });
  element('announcement').textContent = 'Your request summary is ready.';
  submitting = true;
  const controls = Array.from(form.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>('input, select, button'));
  controls.push(element<HTMLButtonElement>('retry-catalog'));
  const disabled = controls.map(control => control.disabled);
  controls.forEach(control => control.disabled = true);
  try {
    const provisionsHec = catalog.collectionMethods.find(e => e.key === method.value)?.provisioning === 'hec';
    recordDiagnostic('Workflow',provisionsHec?'SOURCE_HEC_SETUP':catalog.collectionMethods.find(e=>e.key===method.value)?.disabled?'SOURCE_DISABLED':'SOURCE_SUMMARY_ONLY');
    const hecRequestId = provisionsHec ? await hec.submit() : undefined;
    if (provisionsHec && !hecRequestId) return;
    if (hecRequestId && !await processingSender.send({applicationName:applicationName.value.trim(),barometerId:barometerId.value.trim(),email:email.value.trim(),group:group.value,source:method.value,dailyVolume:{value:volume.value,unit:volumeUnit.value},hecRequestId})) return;
    await summarySender.send({applicationName:applicationName.value.trim(),barometerId:barometerId.value.trim(),email:email.value.trim(),group:group.value,method:method.value,dailyVolume:{value:volume.value,unit:volumeUnit.value},...(hecRequestId ? {hecRequestId} : {})});
  } finally {
    submitting = false;
    controls.forEach((control,index) => control.disabled = disabled[index]);
  }
});
function populate(select: HTMLSelectElement, entries: CatalogEntry[], placeholder: string): void {
  select.replaceChildren(new Option(placeholder, ''));
  for (const entry of entries) { const option = new Option(entry.label, entry.key); option.title = entry.description || ''; option.dataset.provisioning = entry.provisioning || 'summary'; select.add(option); }
  select.disabled = entries.length === 0;
}
function resetSources(): void {
  sourceVersion++;
  if (catalog) { catalog.collectionMethods = []; element('service-error').hidden = true; }
  populate(method, [], 'Select a location first');
  element('source-status').textContent = 'Choose a location to load available source choices.';
  method.dispatchEvent(new Event('change'));
}
group.addEventListener('change', () => { void loadSources(); });
async function loadSources(): Promise<void> {
  resetSources();
  if (!catalog || !group.value) return;
  const version = sourceVersion, selectedGroup = group.value;
  populate(method, [], 'Loading sources…');
  element('service-error').hidden = true;
  element('source-status').textContent = 'Loading source choices…';
  try {
    const response = await diagnosticFetch('/source-catalog.json?group=' + encodeURIComponent(selectedGroup), {cache:'no-store'});
    if (!response.ok) throw new Error('Sources unavailable');
    const choices = parseSourceCatalog(await response.json());
    if (version !== sourceVersion || group.value !== selectedGroup || !catalog) return;
    catalog.collectionMethods = choices;
    populate(method, choices, choices.length ? 'Select a collection method' : 'No source choices available');
    element('source-status').textContent = choices.length ? 'Choose a source to see what it collects. Only approved HEC connections provide automatic setup; other choices record your request.' : 'No source choices are available in this location.';
  } catch {
    if (version !== sourceVersion || !catalog) return;
    populate(method, [], 'Sources unavailable');
    element('source-status').textContent = 'Sources could not be loaded. Use Try again above.';
    element('catalog-failure').textContent = 'We couldn’t load sources for this location.';
    element('service-error').hidden = false;
  }
}
element('retry-catalog').addEventListener('click', () => { if (catalog && group.value) void loadSources(); else void loadCatalog(); });
async function loadCatalog(): Promise<void> {
  resetSources();
  const retry = element<HTMLButtonElement>('retry-catalog');
  retry.disabled = true;
  element('catalog-status').textContent = 'Loading Worker Groups…';
  try {
    const response = await diagnosticFetch('/catalog.json', { cache: 'no-store' });
    if (!response.ok) {
      element('catalog-failure').textContent = 'We couldn’t load your choices. Please try again.';
      throw new Error('Catalog unavailable');
    }
    catalog = parseCatalog(await response.json());
    element('service-error').hidden = true;
    populate(group, catalog.workerGroups, 'Select a location');
    populate(method, [], 'Select a location first');
    const available = catalog.workerGroups.length > 0;
    previewButton.disabled = !available;
    element('catalog-status').textContent = available ? catalog.provenance : 'No choices are available. Please check back Worker Groups are available in Cribl.';
  } catch {
    element('service-error').hidden = false;
    catalog = undefined;
    populate(group, [], 'Choices unavailable'); populate(method, [], 'Choices unavailable');
    element('catalog-status').textContent = 'Worker Groups could not be loaded from Cribl. Use Try again to reload the catalog.';
    previewButton.disabled = true;
  } finally {
    retry.disabled = false;
  }
}
void loadCatalog();
