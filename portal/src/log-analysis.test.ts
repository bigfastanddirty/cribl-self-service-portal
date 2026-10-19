import { it, expect } from 'vitest';
import { classifyLog } from './log-analysis';
it('recognizes JSON objects, arrays, and line-delimited JSON', () => {
  for (const text of ['{"event":"login"}', '[{"a":1}]', '{"a":1}\n{"a":2}']) expect(classifyLog(text).type).toBe('JSON');
});
it('recognizes common traditional and modern syslog headers', () => {
  for (const text of ['<34>Oct 11 22:14:15 host app: hello', 'Oct 11 22:14:15 host app[123]: hello', '<165>1 2026-10-04T12:00:00Z host app 123 ID47 - hello']) expect(classifyLog(text).type).toBe('Syslog');
});
it('does not label malformed JSON, scalar JSON, or mixed formats as a known type', () => {
  for (const text of ['{"a":', '42', 'plain application text', '{"a":1}\nplain text', '<999>Oct 11 22:14:15 host app: hello', 'Oct 99 25:99:99 host app: hello', '']) expect(classifyLog(text).type).toBe('Other');
});
it('does not mistake JSON within a syslog message for JSON log format', () => expect(classifyLog('<34>Oct 11 22:14:15 host app: {"a":1}').type).toBe('Syslog'));
it('ignores blank lines and a UTF-8 text BOM', () => expect(classifyLog('\uFEFF\n{"a":1}\n\n').type).toBe('JSON'));
it('returns findings without retaining sample content', () => {
 const result=classifyLog('{"secret":"private-value"}');
 expect(JSON.stringify(result)).not.toContain('private-value');
 expect(result.explanation).toBeTruthy();
});
