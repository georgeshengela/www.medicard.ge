import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = join(here, '..', '..');

function src(rel) {
  return readFileSync(join(mobileRoot, rel), 'utf8');
}

describe('release crash regressions', () => {
  it('reward detail imports trackQuestEvent, QUEST, and ApiError', () => {
    const text = src('app/medi-quest/rewards/[id].tsx');
    assert.match(text, /import \{ trackQuestEvent \} from '@\/lib\/productObservability'/);
    assert.match(text, /import \{ QUEST \} from '@\/theme\/questTokens'/);
    assert.match(text, /import \{[^}]*ApiError[^}]*\} from '@\/lib\/api'/);
  });

  it('CycleMoreTracking gates pregnancy-test log on showPregnancyTestLog', () => {
    const text = src('src/components/cycle/CycleMoreTracking.tsx');
    assert.match(text, /caps\.showPregnancyTestLog/);
    assert.doesNotMatch(text, /\{pregnancy \?/);
  });

  it('cycleObservations exports alcoholLabel', () => {
    const text = src('src/lib/cycleObservations.ts');
    assert.match(text, /export function alcoholLabel\(/);
  });

  it('signOut cancels all local reminders and unregisters the push token', () => {
    const text = src('src/store/AuthContext.tsx');
    const signOut = text.slice(text.indexOf('signOut: async () => {'), text.indexOf('deleteAccount: async () => {'));
    assert.match(signOut, /cancelAllReminders/);
    assert.match(signOut, /unregisterPushFromServer/);
  });

  it('chat markdown only opens http(s) hrefs', () => {
    const text = src('src/components/ui/Markdown.tsx');
    assert.match(text, /isSafeExternalHref/);
    assert.doesNotMatch(text, /Linking\.openURL\(token\.href/);
  });

  it('package screen does not present a purchase CTA unless the server enables it', () => {
    const text = src('app/package/index.tsx');
    assert.match(text, /purchasesEnabled/);
    assert.match(text, /ka\.usage\.purchasesUnavailable/);
  });

  it('iOS prefs use UserDefaults and never AsyncStorage file writes', () => {
    const text = src('src/lib/storage.ts');
    assert.match(text, /runNativeStorage/);
    assert.match(text, /Settings\.set/);
    assert.match(text, /medicard\.sandbox\.v1/);
    assert.match(text, /withNativeStorageLock/);
    assert.doesNotMatch(text, /from 'expo-file-system/);
    assert.doesNotMatch(text, /writeAsStringAsync/);
    assert.doesNotMatch(text, /from '@react-native-async-storage\/async-storage'/);
  });

  it('auth hydrate recovers from startup storage failures', () => {
    const text = src('src/store/AuthContext.tsx');
    const hydrate = text.slice(text.indexOf('const hydrate = useCallback'), text.indexOf('}, [applyVisualSession, resetSession]);'));
    assert.match(hydrate, /try \{/);
    assert.match(hydrate, /clearToken\(\)/);
    assert.match(hydrate, /resetSession\(\)/);
  });

  it('auth hydrate does not restore UI from snapshot before /me', () => {
    const text = src('src/store/AuthContext.tsx');
    const hydrate = text.slice(text.indexOf('const hydrate = useCallback'), text.indexOf('}, [applyVisualSession, resetSession]);'));
    assert.doesNotMatch(hydrate, /setUser\(snapshot\.user\)/);
    assert.doesNotMatch(hydrate, /saveSessionSnapshot/);
    assert.match(hydrate, /runPostLoginSideEffects/);
  });

  it('root layout and custom entry install the boot guard', () => {
    const layout = src('app/_layout.tsx');
    const entry = src('index.js');
    const pkg = src('package.json');
    assert.match(layout, /bootGuard/);
    assert.match(entry, /bootGuard/);
    assert.match(pkg, /"main": "index.js"/);
  });
});
