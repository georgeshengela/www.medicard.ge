import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
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

  it('package screen is a compatibility redirect with no purchase CTA', () => {
    const text = src('app/package/index.tsx');
    assert.match(text, /Redirect href="\/profile"/);
    assert.doesNotMatch(text, /purchasesEnabled/);
    assert.doesNotMatch(text, /upgradeCta/);
  });

  it('consumer screens do not open a package purchase route', () => {
    const roots = [join(mobileRoot, 'app'), join(mobileRoot, 'src')];
    const files = [];
    function visit(dir) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const file = join(dir, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (/\.(tsx|ts|js)$/.test(entry.name)) files.push(file);
      }
    }
    roots.forEach(visit);
    for (const file of files) {
      if (file.endsWith(`${sep}package${sep}index.tsx`)) continue;
      const text = readFileSync(file, 'utf8');
      assert.doesNotMatch(text, /push\(['"`]\/package/, file);
    }
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

  it('logged-in session shows a user-gesture permission gate', () => {
    const auth = src('src/store/AuthContext.tsx');
    const layout = src('app/_layout.tsx');
    assert.doesNotMatch(auth, /bootstrapDeviceAccess/);
    assert.match(layout, /PermissionGateHost/);
  });

  it('boot entry ignores RN LogBox toasts that cover Home CTAs', () => {
    const text = src('index.js');
    assert.match(text, /LogBox\.ignoreLogs/);
    assert.match(text, /Open debugger to view warnings/);
  });

  it('OTP field covers the digit boxes instead of a 1px hit target', () => {
    const text = src('src/components/auth/OtpCodeInput.tsx');
    assert.match(text, /position: 'absolute'/);
    assert.match(text, /height: box/);
    assert.doesNotMatch(text, /width: 1/);
  });

  it('profile setup footer lifts above the Android IME', () => {
    const text = src('src/components/profile/ProfileSetupShell.tsx');
    assert.match(text, /useKeyboardHeight/);
    assert.match(text, /footerPadBottom/);
    assert.match(text, /Platform\.OS === 'android'/);
  });

  it('login CTA uses the same gutter above the IME as below the status bar', () => {
    const shell = src('src/components/AuthShell.tsx');
    assert.match(shell, /authFooterBottomPad/);
    assert.match(shell, /authScrollTopPad/);
    assert.match(shell, /useKeyboardMetrics/);
    assert.doesNotMatch(shell, /KeyboardAvoidingView/);
    assert.doesNotMatch(shell, /borderTopWidth/);
  });

  it('permissions toggle treats iOS authorized as granted and skips a second OS prompt', () => {
    const helper = src('src/lib/notificationPermission.js');
    const page = src('app/profile/permissions.tsx');
    const notifications = src('src/lib/notifications.ts');
    assert.match(helper, /IOS_ALLOWED/);
    assert.match(notifications, /notificationResponseIsGranted/);
    assert.match(page, /enablePushConnection/);
    assert.doesNotMatch(page, /requestNotificationAccess/);
    assert.match(page, /pushRegisterToken/);
    assert.match(notifications, /admin_broadcast/);
    assert.doesNotMatch(notifications, /development: true/);
  });

  it('login keyboard-open wordmark is not clipped and empty taps dismiss IME', () => {
    const header = src('src/components/auth/AuthBrandHeader.tsx');
    const shell = src('src/components/AuthShell.tsx');
    assert.match(header, /BrandWordmark/);
    assert.match(header, /includeFontPadding: false/);
    assert.doesNotMatch(header, /overflow: 'hidden' \}, wordStyle/);
    assert.match(shell, /keyboardShouldPersistTaps="handled"/);
    assert.match(shell, /Keyboard\.dismiss/);
  });

  it('root layout and custom entry install the boot guard', () => {
    const layout = src('app/_layout.tsx');
    const entry = src('index.js');
    const pkg = src('package.json');
    assert.match(layout, /bootGuard/);
    assert.match(entry, /bootGuard/);
    assert.match(pkg, /"main": "index.js"/);
  });

  it('health screens keep last data when a pull is cancelled', () => {
    const steps = src('src/hooks/useStepsMetrics.ts');
    const metrics = src('src/hooks/useHealthMetrics.ts');
    const hydration = src('src/hooks/useHydration.ts');
    assert.match(steps, /if \(isHealthPullCancelled\(err\)\) return;/);
    assert.match(metrics, /if \(isHealthPullCancelled\(err\)\) return;/);
    assert.doesNotMatch(steps, /setBundle\(null\)/);
    assert.doesNotMatch(metrics, /setBundle\(null\)/);
    assert.doesNotMatch(steps, /useEffect\(\(\) => \{\s*void refresh\(\);/);
    assert.doesNotMatch(metrics, /useEffect\(\(\) => \{\s*void refresh\(\);/);
    assert.doesNotMatch(hydration, /force: true/);
  });

  it('server health rows are fetched without waiting for native HealthKit', () => {
    const steps = src('src/lib/stepsMetrics.ts');
    const metrics = src('src/lib/healthMetrics.ts');
    const stepsFn = steps.slice(steps.indexOf('export async function fetchStepsMetrics'), steps.indexOf('export async function fetchStepsTotalBetween'));
    const metricsFn = metrics.slice(metrics.indexOf('export async function fetchHealthMetrics'), metrics.indexOf('export { getHealthPlatform'));
    assert.match(stepsFn, /const storedPromise = pullStoredHealth/);
    assert.match(metricsFn, /const storedPromise = pullStoredHealth/);
    assert.match(stepsFn, /void syncNativeHealthToServer/);
    assert.doesNotMatch(stepsFn, /await syncNativeHealthToServer/);
  });
});
