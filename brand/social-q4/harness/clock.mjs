// Shifts the mock process clock: Date.now() / new Date() report MOCK_NOW (+ elapsed real time).
// Imported first by mock-api.mjs so every fixture (and the server libs they import) sees the same "now".
const RealDate = Date;
const realNow = RealDate.now.bind(RealDate);
let offset = 0;
export function setMockNow(iso) {
  if (!iso) { offset = 0; return null; }
  const at = RealDate.parse(iso);
  if (!Number.isFinite(at)) throw new Error(`bad now: ${iso}`);
  offset = at - realNow();
  return new RealDate(at).toISOString();
}
export function mockNow() { return realNow() + offset; }
class MockDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(realNow() + offset);
    else super(...args);
  }
  static now() { return realNow() + offset; }
}
globalThis.Date = MockDate;
if (process.env.MOCK_NOW) setMockNow(process.env.MOCK_NOW);
