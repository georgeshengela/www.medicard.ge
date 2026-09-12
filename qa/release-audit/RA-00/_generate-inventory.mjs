/**
 * RA-00 inventory generator — discovery only. Does not change product logic.
 * Reads source and writes JSON artifacts under qa/release-audit/RA-00/.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'qa/release-audit/RA-00');

function walk(dir, acc = [], filter) {
  if (!fs.existsSync(dir)) return acc;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (['node_modules', '.git', 'dist', '.expo', 'android', 'ios'].includes(ent.name)) continue;
      walk(p, acc, filter);
    } else if (!filter || filter(p, ent.name)) acc.push(p);
  }
  return acc;
}

function rel(p) {
  return path.relative(ROOT, p).replaceAll('\\', '/');
}

function read(p) {
  return fs.readFileSync(p, 'utf8');
}

function writeJson(name, data) {
  const dest = path.join(OUT, name);
  fs.writeFileSync(dest, JSON.stringify(data, null, 2) + '\n');
  return dest;
}

function moduleFromPath(p) {
  const s = p.replaceAll('\\', '/').toLowerCase();
  if (s.includes('/(auth)') || s.includes('/auth')) return 'AUTH';
  if (s.includes('onboarding') || s.includes('profile-setup') || s.includes('assessment')) return 'ONBOARDING';
  if (s.includes('/home') || s.includes('home/')) return 'HOME';
  if (s.includes('/chat') || s.includes('/ai') || s.includes('medi') && s.includes('prompt')) return 'MEDI_AI';
  if (s.includes('/lab') || s.includes('extract-lab') || s.includes('explain-lab')) return 'LABS';
  if (s.includes('medication')) return 'MEDICATIONS';
  if (s.includes('symptom')) return 'SYMPTOMS';
  if (s.includes('/visit') || s.includes('doctor')) return 'DOCTOR_HISTORY';
  if (s.includes('postpartum')) return 'POSTPARTUM';
  if (s.includes('pregnancy') || s.includes('prenatal')) return 'PREGNANCY';
  if (s.includes('/ttc') || s.includes('try_to_conceive') || s.includes('cycleTtc')) return 'TTC';
  if (s.includes('perimenopause') || s.includes('peri')) return 'PERIMENOPAUSE';
  if (s.includes('/cycle')) return 'CYCLE';
  if (s.includes('hydration')) return 'HYDRATION';
  if (s.includes('/steps') || s.includes('step')) return 'STEPS';
  if (s.includes('weight')) return 'WEIGHT';
  if (s.includes('health-metric') || s.includes('healthmetric')) return 'HEALTH_METRICS';
  if (s.includes('weather')) return 'WEATHER';
  if (s.includes('pharmacy')) return 'PHARMACY';
  if (s.includes('quest') || s.includes('achievement')) return 'QUEST';
  if (s.includes('companion') || s.includes('journey')) return 'COMPANION';
  if (s.includes('reward') || s.includes('wallet')) return 'REWARDS';
  if (s.includes('partner')) return 'PARTNER_REWARDS';
  if (s.includes('notif') || s.includes('push') || s.includes('brain')) return 'NOTIFICATIONS';
  if (s.includes('/profile') || s.includes('permissions') || s.includes('privacy') || s.includes('terms')) return 'PROFILE';
  if (s.includes('setting')) return 'SETTINGS';
  if (s.includes('export') || s.includes('summary') || s.includes('report') || s.includes('/week')) return 'EXPORTS';
  if (s.includes('/admin')) return 'ADMIN';
  if (s.includes('run/')) return 'RUN';
  if (s.includes('package')) return 'BILLING';
  if (s.includes('share')) return 'CYCLE';
  if (s.includes('record')) return 'RECORDS';
  if (s.includes('location') || s.includes('health-sync') || s.includes('healthkit') || s.includes('health-connect')) return 'DEVICE_INTEGRATIONS';
  return 'PLATFORM';
}

function expoRouteFromFile(file) {
  let r = rel(file).replace(/^mobile\/app/, '').replace(/\\/g, '/');
  r = r.replace(/\/index\.tsx$/, '');
  r = r.replace(/\.tsx$/, '');
  r = r.replace(/\/_layout$/, '');
  if (!r.startsWith('/')) r = '/' + r;
  if (r === '/') return '/';
  return r.replace(/\/+/g, '/');
}

// ---------- screens ----------
const appFiles = walk(path.join(ROOT, 'mobile/app'), [], (p, n) => n.endsWith('.tsx'));
const layouts = appFiles.filter((p) => path.basename(p) === '_layout.tsx');
const screens = appFiles.filter((p) => path.basename(p) !== '_layout.tsx');

const ORPHANS = {
  '/cycle/journal': 'strong — no inbound navigator; journal is CycleJournalPane on /cycle',
  '/health-metrics/hydration/calendar': 'strong — never linked; alias of hydration index',
  '/symptoms/conditions': 'soft — Redirect to /symptoms/results',
  '/cycle/pregnancy': 'soft — Redirect to /cycle; still referenced by insight actions',
  '/(auth)/phone': 'soft — DEV/figma only, not on sign-in',
  '/(auth)/profile-setup/dev-launcher': 'experimental — __DEV__ only',
};

const DEEP_LINKS = {
  '/week': ['notif medi_engage weekly/feature/insight'],
  '/(tabs)/profile': ['notif question → ?action=question'],
  '/chat/[mode]': ['/chat/DOCTOR', '/chat/doctor', '/chat/consilium', 'quota_reset'],
  '/cycle': ['cycle_tip/reminder', 'landing cycle'],
  '/cycle/log': ['cycle_reminder'],
  '/cycle/trends': ['engage insight=cycle'],
  '/cycle/pregnancy/care-plan': ['pregnancy_care_plan notif'],
  '/share/cycle/[code]': ['https://medicard.ge/share/cycle/{code}', 'medicard:// implied'],
  '/health-metrics/hydration': ['engage hydration'],
  '/health-metrics/steps': ['steps-goal', 'engage steps'],
  '/health-metrics/weight': ['weight-goal'],
  '/medications/[id]': ['notif type=medication'],
  '/medications/add': ['engage unfinished'],
  '/medications/reminders': ['engage insight=meds'],
  '/visits': ['visit_reminder'],
  '/visits/editor': ['/visits/editor?id='],
  '/medi-quest': ['engage questSmart'],
  '/weather': ['engage weatherWellness → /weather?from=push'],
  '/(tabs)/home': ['landing hub', 'admin push default'],
};

const screenInventory = screens.map((file) => {
  const route = expoRouteFromFile(file);
  const parentDir = path.dirname(file);
  let parent = 'root Stack';
  const layoutHere = path.join(parentDir, '_layout.tsx');
  const layoutUp = path.join(path.dirname(parentDir), '_layout.tsx');
  if (fs.existsSync(layoutHere)) parent = rel(layoutHere);
  else if (fs.existsSync(layoutUp)) parent = rel(layoutUp);
  const auth = route.startsWith('/(auth)') ? 'public-or-onboarding' : 'required';
  const orphanNote = ORPHANS[route] || null;
  return {
    route,
    file: rel(file),
    component: path.basename(file, '.tsx'),
    parentNavigator: parent,
    authRequirement: auth,
    deepLinks: DEEP_LINKS[route] || [],
    reachableThroughUi: !orphanNote || orphanNote.startsWith('soft'),
    reachableOnlyProgrammatically: Boolean(orphanNote && orphanNote.startsWith('strong')),
    orphaned: Boolean(orphanNote),
    orphanNotes: orphanNote,
    module: moduleFromPath(file),
  };
});

// ---------- controls ----------
const CONTROL_RE = /<(Pressable|TouchableOpacity|TouchableHighlight|TouchableWithoutFeedback|Switch|TextInput|RefreshControl|Button|Checkbox)\b([^>]*?)(\/>|>)/gs;
const ONPRESS_RE = /on(?:Press|LongPress|ValueChange|ChangeText|SubmitEditing|Refresh)\s*=\s*\{([^}]+)\}/;
const A11Y_RE = /accessibilityLabel\s*=\s*\{?["'`]([^"'`]+)["'`]\}?/;
const LABEL_RE = /(?:accessibilityLabel|title|placeholder)\s*=\s*\{?["'`]([^"'`]{1,80})["'`]\}?/;

const controlFiles = [
  ...appFiles,
  ...walk(path.join(ROOT, 'mobile/src/components'), [], (p, n) => n.endsWith('.tsx') || n.endsWith('.ts')),
];

const controls = [];
let controlSeq = 0;
for (const file of controlFiles) {
  const src = read(file);
  const routeGuess = file.includes(`${path.sep}app${path.sep}`) ? expoRouteFromFile(file) : null;
  let m;
  const re = new RegExp(CONTROL_RE.source, CONTROL_RE.flags);
  while ((m = re.exec(src))) {
    const type = m[1];
    const attrs = m[2] || '';
    const actionMatch = attrs.match(/on(Press|LongPress|ValueChange|ChangeText|SubmitEditing|Refresh)/);
    const a11y = attrs.match(A11Y_RE);
    const label = a11y?.[1] || attrs.match(LABEL_RE)?.[1] || null;
    const hasA11y = Boolean(a11y);
    const line = src.slice(0, m.index).split('\n').length;
    controlSeq += 1;
    const id = `MC-${String(controlSeq).padStart(4, '0')}`;
    const module = moduleFromPath(file);
    const mutationish = /save|delete|submit|confirm|claim|redeem|wipe|logout|taken|skip|upload|send|create|remove|export|share/i.test(
      `${label || ''} ${attrs}`,
    );
    controls.push({
      id,
      module,
      screen: routeGuess || rel(file),
      route: routeGuess,
      component: path.basename(file),
      control: label || `${type}@L${line}`,
      controlType: type,
      preconditions: [],
      action: actionMatch ? `on${actionMatch[1]}` : type,
      expectedResult: 'UI responds; later RA phases verify outcome',
      backendCall: null,
      mutation: mutationish,
      databaseEffects: [],
      permissions: [],
      privacyBoundary: [],
      relevantModes: [],
      loadingState: /loading|busy|saving/i.test(attrs),
      emptyState: false,
      errorState: false,
      offlineRelevant: /cycle|log|hydrat|dose/i.test(rel(file)),
      accessibilityRelevant: !hasA11y,
      currentTestCoverage: [],
      auditStatus: 'NOT_RUN',
      sourceFile: rel(file),
      sourceLine: line,
      hasAccessibilityLabel: hasA11y,
    });
  }
}

// ---------- API routes ----------
const routeFiles = walk(path.join(ROOT, 'server/src/routes'), [], (p, n) => n.endsWith('.routes.js'));
const MOUNTS = {
  'auth.routes.js': { prefix: '/api/auth', auth: 'per-route' },
  'health-profile.routes.js': { prefix: '/api/health-profile', auth: 'requireAuth-router' },
  'account.routes.js': { prefix: '/api/account', auth: 'requireAuth-router' },
  'health-metrics.routes.js': { prefix: '/api/health-metrics', auth: 'requireAuth-router' },
  'ai.routes.js': { prefix: '/api/ai', auth: 'requireAuth-router' },
  'chats.routes.js': { prefix: '/api/chats', auth: 'requireAuth-router' },
  'records.routes.js': { prefix: '/api/records', auth: 'requireAuth-router' },
  'medications.routes.js': { prefix: '/api/medications', auth: 'requireAuth-router' },
  'visits.routes.js': { prefix: '/api/visits', auth: 'requireAuth-router' },
  'cycle.routes.js': { prefix: '/api/cycle', auth: 'requireAuth-router' },
  'usage.routes.js': { prefix: '/api/usage', auth: 'per-route' },
  'push.routes.js': { prefix: '/api/push', auth: 'per-route' },
  'pharmacy.routes.js': { prefix: '/api/pharmacy', auth: 'none' },
  'check-in.routes.js': { prefix: '/api/check-in', auth: 'per-route' },
  'location.routes.js': { prefix: '/api/location', auth: 'per-route' },
  'quests.routes.js': { prefix: '/api/quests', auth: 'requireAuth-router' },
  'achievements.routes.js': { prefix: '/api/achievements', auth: 'requireAuth-router' },
  'rewards.routes.js': { prefix: '/api/rewards', auth: 'requireAuth-router' },
  'mediCompanion.routes.js': { prefix: '/api/medi-companion', auth: 'requireAuth-router' },
  'app.routes.js': { prefix: '/api/app', auth: 'none' },
  'admin.routes.js': { prefix: '/api/admin', auth: 'per-route-admin' },
  'adminRewards.routes.js': { prefix: '/api/admin/rewards', auth: 'requireAdmin-router' },
};

function classifyApi(file, method, routePath, srcAround) {
  const f = path.basename(file);
  const mount = MOUNTS[f];
  const p = ((mount?.prefix || '') + (routePath.startsWith('/') ? routePath : '/' + routePath)).replace(/\/+/g, '/');
  const publicAuth = [
    '/api/auth/register',
    '/api/auth/login',
    '/api/auth/password/forgot',
    '/api/auth/password/reset',
    '/api/auth/phone/start',
    '/api/auth/phone/verify',
  ];
  if (publicAuth.includes(p)) return { class: 'PUBLIC', authRequired: false };
  if (f === 'pharmacy.routes.js' || f === 'app.routes.js') return { class: 'PUBLIC', authRequired: false };
  if (f === 'admin.routes.js' || f === 'adminRewards.routes.js') {
    if (p === '/api/admin/login' && method === 'POST') return { class: 'PUBLIC', authRequired: false };
    return { class: 'ADMIN_ONLY', authRequired: true, adminScope: true };
  }
  if (p.includes('/cycle/share/') && (p.endsWith('/accept') || /share\/:code$/.test(p))) {
    return { class: 'PARTNER_SCOPED', authRequired: true, partnerScope: true };
  }
  if (mount?.auth === 'none') return { class: 'PUBLIC', authRequired: false };
  if (p === '/api/ai/engines' || p === '/api/push/templates' || p === '/api/visits/geocode') {
    return { class: 'AUTHENTICATED', authRequired: true };
  }
  if (mount?.auth === 'requireAuth-router' || srcAround.includes('requireAuth') || f === 'auth.routes.js') {
    return { class: 'OWNER_ONLY', authRequired: true, ownerScope: true };
  }
  return { class: 'UNKNOWN', authRequired: null };
}

const apiRoutes = [];
const METHOD_RE = /(\w+)\.(get|post|put|patch|delete)\(\s*(?:\[\s*)?(['"`])([^'"`]+)\3/g;
for (const file of routeFiles) {
  const src = read(file);
  let m;
  const re = new RegExp(METHOD_RE.source, 'g');
  while ((m = re.exec(src))) {
    const method = m[2].toUpperCase();
    const routePath = m[4];
    const around = src.slice(Math.max(0, m.index - 200), m.index + 400);
    const mount = MOUNTS[path.basename(file)];
    const full = (mount?.prefix || '') + (routePath.startsWith('/') ? routePath : '/' + routePath);
    const cls = classifyApi(file, method, routePath, around);
    const mutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    apiRoutes.push({
      method,
      path: full.replace(/\/+/g, '/').replace(/\/$/, '') || full,
      sourceFile: rel(file),
      handler: m[1],
      authRequired: cls.authRequired,
      ownerScope: Boolean(cls.ownerScope),
      adminScope: Boolean(cls.adminScope),
      partnerScope: Boolean(cls.partnerScope),
      securityClass: cls.class,
      requestBody: around.includes('parse(') || around.includes('Schema') ? 'zod-validated' : 'unspecified',
      validation: around.includes('Schema') || around.includes('.parse(') ? 'zod' : 'unknown',
      responseShape: 'json',
      statusCodes: mutation ? [200, 201, 400, 401, 404] : [200, 401, 404],
      dbModelsTouched: [],
      externalProviders: full.includes('/ai') || full.includes('/insights') ? ['OpenRouter', 'EvidenceMD'] : [],
      sideEffects: [],
      notificationsTriggered: full.includes('push') || full.includes('wipe') || full.includes('medications'),
      socketEvents: [],
      cachesInvalidated: [],
      privacySensitivity: full.includes('cycle') || full.includes('ai') || full.includes('health') || full.includes('record') || full.includes('medication')
        ? 'critical'
        : full.includes('admin')
          ? 'high'
          : 'low',
      currentAutomatedTests: [],
    });
  }
}

// top-level server.js mounts
const topLevel = [
  { method: 'GET', path: '/privacy', class: 'PUBLIC' },
  { method: 'GET', path: '/terms', class: 'PUBLIC' },
  { method: 'GET', path: '/calculators', class: 'PUBLIC' },
  { method: 'GET', path: '/calculators/:slug', class: 'PUBLIC' },
  { method: 'GET', path: '/health', class: 'PUBLIC' },
  { method: 'GET', path: '/admin', class: 'PUBLIC' },
  { method: 'GET', path: '/uploads/*', class: 'UNKNOWN' },
  { method: 'GET', path: '/share', class: 'PUBLIC' },
  { method: 'GET', path: '/api/cycle/share/:code', class: 'PUBLIC', notes: 'legacy partnerShareClosedHandler' },
];
for (const t of topLevel) {
  apiRoutes.push({
    method: t.method,
    path: t.path,
    sourceFile: 'server/src/server.js',
    handler: t.path === '/uploads/*' ? 'express.static' : 'anonymous',
    authRequired: false,
    ownerScope: false,
    adminScope: false,
    partnerScope: false,
    securityClass: t.class,
    requestBody: null,
    validation: 'none',
    responseShape: t.path === '/health' ? 'json' : 'html-or-static',
    statusCodes: [200],
    dbModelsTouched: [],
    externalProviders: [],
    sideEffects: [],
    notificationsTriggered: false,
    socketEvents: [],
    cachesInvalidated: [],
    privacySensitivity: t.path === '/uploads/*' ? 'critical' : 'low',
    currentAutomatedTests: [],
    notes: t.notes || null,
  });
}

const classCounts = {};
for (const r of apiRoutes) classCounts[r.securityClass] = (classCounts[r.securityClass] || 0) + 1;

// ---------- prisma ----------
const schema = read(path.join(ROOT, 'server/prisma/schema.prisma'));
const models = [];
const modelBlocks = [...schema.matchAll(/^model\s+(\w+)\s*\{([^}]+)\}/gms)];
for (const block of modelBlocks) {
  const name = block[1];
  const body = block[2];
  const fields = [...body.matchAll(/^\s+(\w+)\s+(\S+)/gm)].map((x) => ({ name: x[1], type: x[2] }));
  const uniques = [...body.matchAll(/@@unique\(\[([^\]]+)\]/g)].map((x) => x[1]);
  const indexes = [...body.matchAll(/@@index\(\[([^\]]+)\]/g)].map((x) => x[1]);
  const fks = [...body.matchAll(/(\w+)\s+\w+\s+@relation\([^)]*onDelete:\s*(\w+)/g)].map((x) => ({
    field: x[1],
    onDelete: x[2],
  }));
  const owner = fields.find((f) => /^(userId|ownerUserId)$/.test(f.name));
  const sensitive = fields
    .filter((f) =>
      /email|password|phone|token|prompt|reply|analysis|symptom|flow|bbt|mucus|weight|blood|note|message|codeHash|fullName|birth/i.test(
        f.name,
      ),
    )
    .map((f) => f.name);
  models.push({
    name,
    purpose: null,
    ownerRelation: owner ? owner.name : null,
    sensitiveFields: sensitive,
    uniqueConstraints: uniques,
    indexes,
    foreignKeys: fks,
    cascadeDeletes: fks.filter((f) => f.onDelete === 'Cascade'),
    nullableOwnership: owner && /\?/.test(owner.type),
    timestamps: fields.filter((f) => /createdAt|updatedAt|syncedAt/.test(f.name)).map((f) => f.name),
    softDelete: /archivedAt|revokedAt/.test(body) ? 'present' : 'none',
    migrations: [],
    apisTouching: apiRoutes.filter((r) => r.path.toLowerCase().includes(name.toLowerCase().slice(0, 8))).map((r) => `${r.method} ${r.path}`),
  });
}

const migrationDirs = fs.existsSync(path.join(ROOT, 'server/prisma/migrations'))
  ? fs.readdirSync(path.join(ROOT, 'server/prisma/migrations')).filter((n) => n !== 'migration_lock.toml')
  : [];
const phaseSql = walk(path.join(ROOT, 'server/prisma'), [], (p, n) => n.endsWith('.sql') && n.startsWith('phase'));

// ---------- tests ----------
const testFiles = walk(ROOT, [], (p, n) => /\.test\.(js|ts|tsx)$/.test(n) && !p.includes('node_modules'));
const qaScripts = walk(path.join(ROOT, 'qa'), [], (p, n) => /qa-run\.(js|mjs)$/.test(n));

const testInventory = {
  generatedAt: new Date().toISOString(),
  groups: {
    serverUnit: testFiles.filter((p) => rel(p).startsWith('server/')).map(rel),
    mobileUnit: testFiles.filter((p) => rel(p).startsWith('mobile/')).map(rel),
    qaScripts: qaScripts.map(rel),
    e2e: [],
    maestro: [],
    adminTests: testFiles.filter((p) => /admin/i.test(p)).map(rel),
    contractTests: testFiles.filter((p) => /contract|golden/i.test(p)).map(rel),
  },
  commands: {
    server: 'npm --prefix server test',
    apiSmoke: 'npm run test:api',
    aiCheck: 'npm run test:ai',
    mobileOffline: 'npm --prefix mobile run test:offline',
    mobileLab: 'npm --prefix mobile run test:lab',
    mobileGeo: 'npm --prefix mobile run test:geo',
    mobileWeather: 'npm --prefix mobile run test:weather',
    mobileQuest: 'npm --prefix mobile run test:quest',
    mobileHome: 'npm --prefix mobile run test:home',
    mobileEngage: 'npm --prefix mobile run test:engage',
    typecheck: 'npm --prefix mobile run typecheck',
  },
  counts: {
    automatedTestFiles: testFiles.length,
    qaRunScripts: qaScripts.length,
    maestro: 0,
    e2e: 0,
  },
};

// ---------- admin screens ----------
const adminScreens = [
  { hash: '#/overview', file: 'server/admin/command-center-v3.js', title: 'Command Center' },
  { hash: '#/users', file: 'server/admin/admin-users-v3.js', title: 'Users registry' },
  { hash: '#/users/:id', file: 'server/admin/admin-users-v3.js', title: 'User investigation' },
  { hash: '#/push', file: 'server/admin/v3/modules/push.js', title: 'Push & Brain' },
  { hash: '#/health', file: 'server/admin/v3/modules/health.js', title: 'Feature usage' },
  { hash: '#/ai', file: 'server/admin/v3/modules/medi.js', title: 'Medi quality' },
  { hash: '#/rewards', file: 'server/admin/v3/modules/rewards.js', title: 'Rewards commerce' },
  { hash: '#/packages', file: 'server/admin/v3/modules/packages.js', title: 'Packages' },
  { hash: '#/orders', file: 'server/admin/v3/modules/orders.js', title: 'Orders' },
  { hash: '#/sms', file: 'server/admin/v3/modules/sms.js', title: 'SMS' },
  { hash: '#/pharmacy', file: 'server/admin/v3/modules/pharmacy.js', title: 'Pharmacy sync' },
  { hash: '#/quality', file: 'server/admin/v3/modules/quality.js', title: 'Data quality' },
  { hash: '#/cycleqa', file: 'server/admin/v3/modules/cycleqa.js', title: 'Cycle QA board' },
  { hash: '#/audit', file: 'server/admin/v3/modules/audit.js', title: 'Audit log' },
  { hash: '#/settings', file: 'server/admin/v3/modules/settings.js', title: 'App settings' },
];

const adminMutations = apiRoutes.filter((r) => r.adminScope && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method));
let adminSeq = controls.length;
for (const mut of adminMutations) {
  adminSeq += 1;
  controls.push({
    id: `MC-${String(adminSeq).padStart(4, '0')}`,
    module: 'ADMIN',
    screen: mut.path.startsWith('/api/admin/rewards') ? '#/rewards' : '#/admin-api',
    route: mut.path,
    component: path.basename(mut.sourceFile),
    control: `${mut.method} ${mut.path}`,
    controlType: 'admin-mutation',
    preconditions: ['admin JWT', mut.path.includes('rewards') ? 'capability ACL' : 'requireAdmin'],
    action: mut.method,
    expectedResult: 'Authorized admin mutation succeeds; unauthorized rejected',
    backendCall: `${mut.method} ${mut.path}`,
    mutation: true,
    databaseEffects: ['admin-scoped'],
    permissions: ['ADMIN_ONLY'],
    privacyBoundary: ['admin-operator'],
    relevantModes: [],
    loadingState: true,
    emptyState: false,
    errorState: true,
    offlineRelevant: false,
    accessibilityRelevant: false,
    currentTestCoverage: mut.path.includes('reward') ? ['server/src/lib/rewardsAdmin.test.js'] : [],
    auditStatus: 'NOT_RUN',
    sourceFile: mut.sourceFile,
    sourceLine: null,
    hasAccessibilityLabel: true,
  });
}

// ---------- AI ----------
const aiPipelines = [
  {
    id: 'AI-CHAT',
    name: 'Medi chat',
    route: 'POST /api/ai/query',
    providers: ['OpenRouter gemini_flash', 'OpenRouter ling_free', 'EvidenceMD'],
    promptFile: 'server/src/lib/prompts.js',
    context: 'withPatientAiContext',
    dataSent: ['health profile', '14-day metrics', 'active meds', 'cycle mode'],
    persistentState: 'ChatSession + AiInteraction',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-CONSILIUM',
    name: 'Consilium',
    route: 'POST /api/ai/query mode=CONSILIUM',
    providers: ['OpenRouter', 'EvidenceMD'],
    promptFile: 'server/src/lib/prompts.js',
    context: 'withPatientAiContext',
    dataSent: ['same as chat'],
    persistentState: 'ChatSession + AiInteraction',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-CYCLE-INSIGHTS',
    name: 'Cycle wellness tips',
    route: 'POST /api/cycle/insights',
    providers: ['EvidenceMD CYCLE_WELLNESS', 'local heuristic fallback'],
    promptFile: 'server/src/lib/prompts.js',
    context: 'cycle profile; POSTPARTUM fail-closed',
    dataSent: ['cycle mode/context unless POSTPARTUM'],
    persistentState: 'CycleProfile.aiInsights ~18h cache',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-LAB-EXTRACT',
    name: 'Lab OCR/extract',
    route: 'POST /api/ai/extract-lab',
    providers: ['OpenRouter vision'],
    promptFile: 'server/src/lib/prompts.js VISION',
    context: 'images/PDF pages',
    dataSent: ['lab images'],
    persistentState: 'client lab panels + possible records',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-LAB-EXPLAIN',
    name: 'Lab explain',
    route: 'POST /api/ai/explain-lab',
    providers: ['EvidenceMD/OpenRouter'],
    promptFile: 'server/src/lib/prompts.js LAB',
    context: 'withPatientAiContext + extracted values',
    dataSent: ['lab values', 'patient context'],
    persistentState: 'AiInteraction',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-LAB-ALIGN',
    name: 'Lab name align',
    route: 'POST /api/ai/align-lab',
    providers: ['OpenAI/OpenRouter'],
    promptFile: 'server/src/lib/labAlign.js',
    context: 'OCR names',
    dataSent: ['parameter names'],
    persistentState: 'AiInteraction',
    medicalClaimsPersist: false,
  },
  {
    id: 'AI-IMAGE',
    name: 'Analyze image (imaging/skin)',
    route: 'POST /api/ai/analyze-image',
    providers: ['OpenRouter vision', 'Anthropic', 'OpenAI GPT-4o'],
    promptFile: 'server/src/lib/vision.js',
    context: 'optional patient context',
    dataSent: ['image bytes', 'kind prompt'],
    persistentState: 'MedicalRecord.aiAnalysis',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-WEIGHT',
    name: 'Weight advice',
    route: 'POST /api/ai/weight-advice',
    providers: ['OpenRouter'],
    promptFile: 'server/src/lib/weightAdvice.js',
    context: 'weight logs',
    dataSent: ['weight history'],
    persistentState: 'cached per day',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-SKINCARE',
    name: 'Skincare',
    route: 'POST /api/ai/skincare',
    providers: ['OpenRouter/EvidenceMD'],
    promptFile: 'server/src/lib/prompts.js SKINCARE',
    context: 'withPatientAiContext',
    dataSent: ['patient context'],
    persistentState: 'AiInteraction',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-MED-REVIEW',
    name: 'Medication review',
    route: 'POST /api/ai/medication-review',
    providers: ['OpenRouter/EvidenceMD'],
    promptFile: 'server/src/lib/prompts.js MEDICATION',
    context: 'schedules',
    dataSent: ['medication names/doses'],
    persistentState: 'AiInteraction',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-SYMPTOM',
    name: 'Symptom check',
    route: 'POST /api/ai/symptom-check',
    providers: ['OpenRouter/EvidenceMD'],
    promptFile: 'server/src/lib/prompts.js SYMPTOM_CHECKER',
    context: 'structured symptoms',
    dataSent: ['symptom payload', 'patient context'],
    persistentState: 'MedicalRecord + AiInteraction',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-ONBOARDING',
    name: 'Onboarding analysis',
    route: 'POST /api/health-profile/onboarding-analysis',
    providers: ['OpenRouter'],
    promptFile: 'server/src/lib/onboardingAnalysis.js',
    context: 'profile + extraAnswers + 14d metrics + meds + cycle',
    dataSent: ['health profile'],
    persistentState: 'heuristic score + AI nudge',
    medicalClaimsPersist: true,
  },
  {
    id: 'AI-ADMIN-SCAN',
    name: 'Admin AI quality scan',
    route: 'POST /api/admin/ai/scan',
    providers: ['OpenRouter judge'],
    promptFile: 'server/src/lib/aiQuality.js',
    context: 'stored interactions',
    dataSent: ['prompts/replies from AiInteraction'],
    persistentState: 'AiEvalRun/Result',
    medicalClaimsPersist: false,
  },
];

// ---------- notifications ----------
const notifications = {
  architecture: {
    brain: 'mobile/src/lib/mediNotificationBrain.ts',
    localScheduler: 'mobile/src/lib/notifications.ts',
    remotePush: 'server/src/lib/push.js',
    templates: 'server/src/lib/pushTemplates.js',
  },
  local: [
    'medication reminders',
    'cycle reminders',
    'pregnancy care DATE_BASED',
    'pregnancy care EXACT_TIME',
    'visit reminders',
    'steps/weight goals',
    'Brain engage families',
    'quota reset local category',
  ],
  remote: ['admin campaigns', 'AI quota reset sweeper 30s'],
  engageFamilies: [
    'birthday', 'visitFollowup', 'insight', 'achievement', 'weekly', 'reengage', 'unfinished',
    'questSmart', 'hydration', 'stepsQuiet', 'streak', 'chat', 'morning', 'checkin', 'sleep',
    'question', 'feature', 'weatherWellness',
  ],
  actionButtons: {
    'medi-med': ['TAKE', 'SNOOZE'],
    'medi-hydration': ['DRANK'],
    'medi-checkin': ['OK', 'CHAT'],
    'medi-visit': ['OPEN', 'SNOOZE'],
    'medi-quota': ['CHAT'],
  },
  deepLinks: Object.entries(DEEP_LINKS).map(([route, links]) => ({ route, links })),
  quietHours: '22:00–08:00 default; bumpOutOfQuiet; EXACT_TIME visit-alarm policy',
  jobs: [
    { name: 'quotaResetSweeper', interval: '30s', file: 'server/src/lib/usageNotify.js' },
    { name: 'pharmacy-sync', interval: '0 */6 * * *', file: 'render.yaml' },
  ],
};

// ---------- permissions ----------
const permissions = [
  { capability: 'notifications', request: 'mobile/src/lib/notifications.ts + appPermissions.ts', denied: 'Alert + openSettings', permanentDenied: 'openSettings', retry: 'permissions screen' },
  { capability: 'camera', request: 'appPermissions.ts / AnalysisModule.tsx', denied: 'settings alert', permanentDenied: 'settings', retry: 'permissions screen' },
  { capability: 'photos', request: 'requestMediaLibraryPermissionsAsync', denied: 'settings alert', permanentDenied: 'settings', retry: 'permissions screen' },
  { capability: 'microphone', request: 'DECLARED ONLY — no runtime request found', denied: 'n/a', permanentDenied: 'n/a', retry: 'absent' },
  { capability: 'location-foreground', request: 'mobile/src/lib/userLocation.ts', denied: 'settings if !canAskAgain', permanentDenied: 'settings', retry: 'permissions screen' },
  { capability: 'location-background', request: 'ABSENT', denied: 'n/a', permanentDenied: 'n/a', retry: 'n/a' },
  { capability: 'healthkit', request: 'healthSyncPlatform.ios.ts', denied: 'toast + settings', permanentDenied: 'settings', retry: 'permissions + CycleHealthConnectCard' },
  { capability: 'health-connect', request: 'healthSyncPlatform.android.ts', denied: 'toast + Health Connect settings', permanentDenied: 'settings', retry: 'permissions' },
  { capability: 'calendar', request: 'pregnancyCareCalendar.ts explicit tap', denied: 'permission_denied UI', permanentDenied: 'permission_revoked UI', retry: 'care-plan export' },
  { capability: 'biometrics', request: 'appPermissions.ts authenticateAsync', denied: 'hardware/enrolled checks', permanentDenied: 'settings hint', retry: 'face-id / cycle lock' },
  { capability: 'bluetooth', request: 'ABSENT', denied: 'n/a', permanentDenied: 'n/a', retry: 'n/a' },
  { capability: 'activity-recognition', request: 'implicit via Health Connect Steps', denied: 'unknown', permanentDenied: 'unknown', retry: 'unknown' },
];

// ---------- analytics ----------
const analytics = {
  provider: 'first-party ProductEvent table (no PostHog/Amplitude/Sentry)',
  clientKinds: [
    'weekly_report_opened', 'insight_opened', 'insight_actioned', 'insight_dismissed',
    'notification_permission', 'quest_hub_opened', 'quest_claim_tapped', 'quest_history_opened',
    'quest_wallet_opened', 'step_setup_opened', 'hydration_setup_opened', 'achievements_opened',
    'achievements_opened_from_hub', 'achievement_claim_tapped', 'quest_why_target_opened',
    'medi_companion_opened', 'medi_journey_opened', 'medi_journey_milestone_viewed',
    'medi_cosmetic_equipped', 'medi_talk_tapped',
  ],
  serverOnlyKinds: [
    'weekly_report_generated', 'insight_generated', 'quest_assigned', 'quest_completed',
    'quest_claimed', 'smart_quest_assigned', 'medi_journey_milestone_unlocked',
  ],
  droppedClientKinds: ['weather_* kinds in weather/events.ts — not in PRODUCT_EVENT_KINDS'],
  consent: 'no dedicated analytics SDK consent; privacy policy copy only',
  healthSensitive: false,
  userIdentifiers: 'userId on server row; client sends kinds + entityId allowlisted',
};

// ---------- exports ----------
const exportsInv = [
  { id: 'cycle-json', name: 'Cycle personal JSON export', api: 'GET /api/cycle/export', privacy: 'owner-only full journal', allowlist: 'buildCycleExportPayload' },
  { id: 'doctor-summary', name: 'Doctor summary JSON+PDF', api: 'GET /api/cycle/doctor-summary', privacy: 'document-scoped opt-in observations; not partner/AI', allowlist: 'cycleObservationRegistry doctorSummary' },
  { id: 'cycle-wipe', name: 'Cycle wipe', api: 'POST /api/cycle/wipe', privacy: 'destroys owner cycle rows + local queue', allowlist: 'confirm DELETE_CYCLE_DATA' },
  { id: 'partner-share', name: 'Partner peek', api: 'GET/POST /api/cycle/share*', privacy: 'stripped OPK/BBT/mucus/intercourse', allowlist: 'buildPartnerPayload' },
  { id: 'calendar-ics', name: 'OS Calendar export prenatal plannedDate', api: 'device-local expo-calendar', privacy: 'no plannedPlace; no OS alarms', allowlist: 'PREGNANCY_CARE_CALENDAR_EXPORT_CONTRACT' },
  { id: 'account-delete', name: 'Delete account', api: 'DELETE /api/auth/me', privacy: 'cascades user health', allowlist: 'deleteUser.js' },
  { id: 'admin-csv', name: 'Admin exports users/decisions/outcomes/audit', api: 'GET /api/admin/export/*', privacy: 'admin-only; claimed no chat text', allowlist: 'admin analytics sanitize' },
];

// ---------- coverage gaps ----------
const modules = [
  'AUTH', 'ONBOARDING', 'HOME', 'MEDI_AI', 'LABS', 'MEDICATIONS', 'SYMPTOMS', 'DOCTOR_HISTORY',
  'CYCLE', 'TTC', 'PREGNANCY', 'POSTPARTUM', 'PERIMENOPAUSE', 'HEALTH_METRICS', 'STEPS', 'HYDRATION',
  'WEIGHT', 'WEATHER', 'PHARMACY', 'QUEST', 'COMPANION', 'JOURNEY', 'ACHIEVEMENTS', 'REWARDS',
  'PARTNER_REWARDS', 'NOTIFICATIONS', 'PROFILE', 'SETTINGS', 'REPORTS', 'EXPORTS', 'ADMIN',
  'ANALYTICS', 'DEVICE_INTEGRATIONS', 'SECURITY_PRIVACY', 'RUN', 'BILLING', 'RECORDS', 'PLATFORM',
];

const testsByModuleHint = {
  CYCLE: 'high — dozens of unit/contract tests; no E2E clicking UI',
  TTC: 'high unit / none interaction',
  PREGNANCY: 'high unit / none interaction',
  POSTPARTUM: 'high unit / none interaction',
  PERIMENOPAUSE: 'high unit / none interaction',
  QUEST: 'high unit / none interaction',
  REWARDS: 'high unit / none interaction',
  COMPANION: 'partial unit / none interaction',
  NOTIFICATIONS: 'partial unit (brain, plan, contract) / none interaction',
  AUTH: 'partial (qaOtp, checkIn) / none interaction',
  MEDI_AI: 'partial (aiEngine, onboardingAnalysis) / none interaction',
  LABS: 'partial mobile lab unit / none interaction',
  MEDICATIONS: 'none dedicated suite / none interaction',
  HOME: 'partial homeSectionOrder / none interaction',
  ADMIN: 'partial analytics/help/rewardsAdmin / none interaction',
  HYDRATION: 'partial hydrationSync / none interaction',
  STEPS: 'partial via quest engine / none interaction',
  WEIGHT: 'none / none interaction',
  WEATHER: 'partial recommendation tests / none interaction',
  PHARMACY: 'none / none interaction',
  SYMPTOMS: 'none / none interaction',
  PROFILE: 'none / none interaction',
  RUN: 'none / none interaction',
  DEVICE_INTEGRATIONS: 'none / none interaction',
};

const coverageGaps = modules.map((m) => ({
  module: m,
  unit: /CYCLE|TTC|PREGNANCY|POSTPARTUM|PERIMENOPAUSE|QUEST|REWARDS/.test(m) ? 'HIGH' : /AUTH|MEDI_AI|LABS|NOTIFICATIONS|ADMIN|HOME|HYDRATION|COMPANION|WEATHER/.test(m) ? 'PARTIAL' : 'LOW_OR_NONE',
  integration: 'LOW_OR_NONE',
  e2e: 'NONE',
  interactionCoverage: 'NONE',
  note: testsByModuleHint[m] || 'no dedicated automated tests found; no UI click coverage',
}));

const counts = {
  mobileScreens: screenInventory.length,
  mobileLayouts: layouts.length,
  adminScreens: adminScreens.length,
  mobileRoutes: screenInventory.length,
  interactiveControls: controls.length,
  apiEndpoints: apiRoutes.length,
  dbModels: models.length,
  aiPipelines: aiPipelines.length,
  notificationFamilies: notifications.engageFamilies.length,
  devicePermissions: permissions.length,
  exports: exportsInv.length,
  analyticsEvents: analytics.clientKinds.length + analytics.serverOnlyKinds.length,
  automatedTestFiles: testFiles.length,
  masterAuditCases: controls.length,
  prismaMigrations: migrationDirs.length,
  phaseSqlFiles: phaseSql.length,
};

writeJson('screen-inventory.json', {
  generatedAt: new Date().toISOString(),
  scheme: 'medicard',
  counts: { screens: screenInventory.length, layouts: layouts.length },
  screens: screenInventory,
  layouts: layouts.map(rel),
});

writeJson('master-control-matrix.json', {
  generatedAt: new Date().toISOString(),
  auditStatusDefault: 'NOT_RUN',
  count: controls.length,
  items: controls,
});

writeJson('api-inventory.json', {
  generatedAt: new Date().toISOString(),
  count: apiRoutes.length,
  securityClassCounts: classCounts,
  unknownFindings: apiRoutes.filter((r) => r.securityClass === 'UNKNOWN'),
  routes: apiRoutes,
});

writeJson('database-model-inventory.json', {
  generatedAt: new Date().toISOString(),
  schema: 'server/prisma/schema.prisma',
  modelCount: models.length,
  prismaMigrationFolders: migrationDirs,
  standalonePhaseSql: phaseSql.map(rel),
  models,
});

writeJson('ai-pipeline-inventory.json', {
  generatedAt: new Date().toISOString(),
  count: aiPipelines.length,
  engines: ['gemini_flash (default)', 'ling_free', 'evidencemd'],
  visionFallback: ['OpenRouter', 'Anthropic', 'OpenAI'],
  patientContext: 'server/src/lib/patient.js withPatientAiContext',
  retention: 'AiInteraction stores userPrompt + assistantReply; no purge job found',
  pipelines: aiPipelines,
});

writeJson('notification-inventory.json', { generatedAt: new Date().toISOString(), ...notifications });
writeJson('permissions-inventory.json', { generatedAt: new Date().toISOString(), items: permissions });
writeJson('analytics-inventory.json', { generatedAt: new Date().toISOString(), ...analytics });
writeJson('export-inventory.json', { generatedAt: new Date().toISOString(), items: exportsInv });
writeJson('test-suite-inventory.json', testInventory);
writeJson('coverage-gaps.json', { generatedAt: new Date().toISOString(), modules: coverageGaps });
writeJson('admin-inventory.json', {
  generatedAt: new Date().toISOString(),
  spa: 'server/admin/index.html',
  impersonation: 'ABSENT',
  screens: adminScreens,
  mutations: adminMutations.map((m) => `${m.method} ${m.path}`),
});
writeJson('counts.json', counts);

console.log(JSON.stringify({ ok: true, counts, out: rel(OUT) }, null, 2));
