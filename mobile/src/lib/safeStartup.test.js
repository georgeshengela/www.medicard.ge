import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

describe('safe startup', () => {
  it('defers post-login side effects', () => {
    const text = readFileSync(join(here, 'safeStartup.js'), 'utf8');
    assert.match(text, /schedulePostLoginWork/);
    assert.match(text, /InteractionManager\.runAfterInteractions/);
    assert.match(text, /POST_LOGIN_DEFER_MS/);
  });

  it('hydrate does not mount a session before api.auth.me succeeds', () => {
    const text = readFileSync(join(here, '..', 'store', 'AuthContext.tsx'), 'utf8');
    const hydrate = text.slice(text.indexOf('const hydrate = useCallback'), text.indexOf('}, [applyVisualSession, resetSession]);'));
    assert.doesNotMatch(hydrate, /setUser\(snapshot\.user\)/);
    assert.doesNotMatch(hydrate, /saveSessionSnapshot/);
    assert.match(hydrate, /api\.auth\.me\(\)/);
    assert.match(hydrate, /runPostLoginSideEffects/);
  });
});
