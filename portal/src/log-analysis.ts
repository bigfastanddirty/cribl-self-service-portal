export interface LogFinding { type: 'JSON' | 'Syslog' | 'XML' | 'Other'; explanation: string }
function jsonRecord(text: string): boolean {
  try { const value: unknown = JSON.parse(text); return typeof value === 'object' && value !== null; }
  catch { return false; }
}
function syslogHeader(line: string): boolean {
  const priority = line.match(/^<(\d{1,3})>/);
  if (priority && Number(priority[1]) > 191) return false;
  const body = priority ? line.slice(priority[0].length) : line;
  // Common RFC 3164 / exported traditional syslog header; this is not a full parser.
  if (/^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(?:[1-9]|[12]\d|3[01])\s+(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\s+\S+\s+\S/.test(body)) return true;
  // RFC 5424-like PRI, version, timestamp, host, app, procid, msgid, structured data.
  if (!priority) return false;
  const modern = body.match(/^[1-9]\d{0,2} (\S+) \S+ \S+ \S+ \S+ (?:-(?: |$)|\[)/);
  if (!modern) return false;
  return modern[1] === '-' || (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(modern[1]) && Number.isFinite(Date.parse(modern[1])));
}
function xmlDocument(text: string): boolean {
  if (!text.startsWith('<') || /<!DOCTYPE|<!ENTITY/i.test(text) || typeof DOMParser === 'undefined') return false;
  // Parse into a detached XML document only. Never insert sample nodes into the page.
  const document = new DOMParser().parseFromString(text, 'application/xml');
  return Boolean(document.documentElement) && ['http://www.mozilla.org/newlayout/xml/parsererror.xml', 'http://www.w3.org/1999/xhtml'].every(namespace => document.getElementsByTagNameNS(namespace, 'parsererror').length === 0);
}
export function classifyLog(text: string): LogFinding {
  const trimmed = text.trim();
  if (jsonRecord(trimmed)) return { type: 'JSON', explanation: 'The sample contains a JSON object or array.' };
  const lines = trimmed.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length && lines.every(jsonRecord)) return { type: 'JSON', explanation: 'Each non-empty line contains a JSON object or array.' };
  if (lines.length && lines.every(syslogHeader)) return { type: 'Syslog', explanation: 'Each non-empty line has a recognizable syslog header. This is a format estimate, not complete protocol validation.' };
  if (xmlDocument(trimmed)) return { type: 'XML', explanation: 'The sample is a well-formed XML document. No schema validation was performed.' };
  if (/<!DOCTYPE|<!ENTITY/i.test(trimmed)) return { type: 'Other', explanation: 'XML with document type or entity declarations is outside the supported detection scope. Choose a log type override if needed.' };
  return { type: 'Other', explanation: 'The sample is mixed, empty, or does not match the supported JSON, syslog, or XML formats.' };
}
