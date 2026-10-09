const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readdirSync, readFileSync, statSync } = require('node:fs');
const { join, relative } = require('node:path');

// Integration review IR-4 (2026-10-09): older app JS hides the weekly Medi mission but toasted
// „მისია შესრულდა 🎉“ for its `quest:completed` socket event, so the server no longer announces that
// completion. The socket event was also how MEDIQUEST refreshed after a health answer: every screen that
// streams a Medi answer (/api/ai/query) now asks for the refresh itself once the answer arrived.

const root = join(__dirname, '..');

function sources(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

test('every screen that streams a Medi answer refreshes MEDIQUEST after it', () => {
  const callers = [...sources(join(root, 'src')), ...sources(join(root, 'app'))]
    .filter((path) => /\bstreamAiQuery\(/.test(readFileSync(path, 'utf8')));
  assert.ok(callers.length >= 2, 'found the Medi chat and MEDISCAN');
  for (const path of callers) {
    const src = readFileSync(path, 'utf8');
    const call = src.indexOf('await streamAiQuery(');
    const after = src.slice(call, src.indexOf('} catch', call));
    assert.match(after, /requestQuestRefresh\(\)/, `${relative(root, path)} refreshes the quests after the answer`);
  }
});
