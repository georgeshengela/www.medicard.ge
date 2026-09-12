import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeSseBuffer } from './sseParse.js';

test('SSE parser yields JSON events and keeps a partial tail', () => {
  const first = consumeSseBuffer('data: {"type":"delta","text":"გა"}\n\ndata: {"type":"delta","text":"მარჯ');
  assert.deepEqual(first.events, [{ type: 'delta', text: 'გა' }]);
  assert.equal(first.rest, 'data: {"type":"delta","text":"მარჯ');

  const second = consumeSseBuffer(`${first.rest}ობა"}\n\n`);
  assert.deepEqual(second.events, [{ type: 'delta', text: 'მარჯობა' }]);
  assert.equal(second.rest, '');
});

test('SSE parser accepts CRLF and ignores keep-alives', () => {
  const parsed = consumeSseBuffer(':\n\ndata: {"type":"done","answer":"ok"}\r\n\r\n');
  assert.equal(parsed.events[0].type, 'done');
  assert.equal(parsed.events[0].answer, 'ok');
});
