const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

// Runs the real src/lib/authErrorMessage.ts with the dictionary and ApiError stubbed.
function load() {
  class ApiError extends Error {
    constructor(message, status, payload = {}) {
      super(message);
      this.status = status;
      this.code = payload.code;
    }
  }
  const ka = {
    auth: { loginError: 'LOGIN_ERROR', networkError: 'AUTH_NETWORK', requestTimeout: 'AUTH_TIMEOUT' },
    common: { error: 'GENERIC', networkError: 'COMMON_NETWORK', requestTimeout: 'COMMON_TIMEOUT' },
  };
  const modules = { '@/i18n/ka': { ka }, '@/lib/api': { ApiError } };
  const file = path.resolve(__dirname, '../src/lib/authErrorMessage.ts');
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) => {
      if (!(name in modules)) throw Error('Unmocked: ' + name);
      return modules[name];
    },
  }, { filename: file });
  return { authErrorMessage: exports.authErrorMessage, ApiError };
}

const { authErrorMessage, ApiError } = load();

test('wrong or expired SMS / email codes reach the person as the server wrote them', () => {
  for (const [message, status] of [
    ['კოდი არასწორია.', 400],
    ['კოდი არასწორია ან ვადა გაუვიდა.', 400],
    ['მეტისმეტი მცდელობა. მოითხოვე ახალი კოდი.', 429],
    ['The code is wrong.', 400],
    ['The code is incorrect or has expired.', 400],
  ]) {
    assert.equal(authErrorMessage(new ApiError(message, status)), message);
  }
});

test('other Georgian „არასწორი“ errors are not turned into a password error', () => {
  for (const [message, status, code] of [
    ['შევსებული მონაცემები არასწორია.', 400],
    ['ელ-ფოსტის ფორმატი არასწორია', 400],
    ['პაროლი არასწორია.', 401, 'INVALID_PASSWORD'],
    ['ავტორიზაციის ტოკენი არასწორია.', 401, 'TOKEN_INVALID'],
    ['მოწვევის კოდი არასწორია.', 400],
  ]) {
    assert.equal(authErrorMessage(new ApiError(message, status, { code })), message);
  }
});

test('the real email/password failure still shows the sign-in message', () => {
  assert.equal(authErrorMessage(new ApiError('ელ-ფოსტა ან პაროლი არასწორია.', 401)), 'LOGIN_ERROR');
  assert.equal(authErrorMessage(new ApiError('The email or password is incorrect.', 401)), 'LOGIN_ERROR');
});

test('network and timeout failures keep their auth wording', () => {
  assert.equal(authErrorMessage(new ApiError('COMMON_NETWORK', 0)), 'AUTH_NETWORK');
  assert.equal(authErrorMessage(new ApiError('COMMON_TIMEOUT', 408)), 'AUTH_TIMEOUT');
  assert.equal(authErrorMessage(new ApiError('', 500)), 'GENERIC');
  assert.equal(authErrorMessage(new Error('boom')), 'GENERIC');
});
