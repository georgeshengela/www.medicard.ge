/** Synthetic UI harness only. No network, accounts, or health data. */
export const preview = { screen: 'lab', scenario: 'success', owner: 'analysis-preview-A', calls: [] as string[], attempt: 0 };
export const sampleImage = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="400" height="460"><rect width="400" height="460" fill="#fff"/><text x="32" y="62" font-size="22" fill="#0F766E">SYNTHETIC LAB REPORT</text><path d="M32 88H368" stroke="#14B8A6" stroke-width="3"/><text x="32" y="135" font-size="18">Hemoglobin   13.2 g/dL</text><text x="32" y="175" font-size="18">Reference    12 - 16</text><text x="32" y="235" font-size="16" fill="#46565A">Visual test fixture only</text></svg>');
export const extract = { date: null, parameters: [{ key: 'hemoglobin', nameKa: 'ჰემოგლობინი', nameEn: 'Hemoglobin', value: 13.2, display: '13.2', unit: 'g/dL', refLow: 12, refHigh: 16, flag: 'N' }] };
export const answer = '## რას ვხედავთ\nეს არის ვიზუალური შემოწმების საცდელი შედეგი.\n\n## შემდეგი ნაბიჯი\nგადაამოწმე მონაცემები ორიგინალ დოკუმენტთან. ეს ტექსტი სამედიცინო რჩევა არ არის.';
export const skincareAnswer = 'საცდელი რუტინა — მხოლოდ ეკრანის შესამოწმებლად.\n\n## დილის რუტინა\n1. საცდელი პირველი ნაბიჯი.\n2. საცდელი მეორე ნაბიჯი.\n\n## საღამოს რუტინა\n1. საცდელი საღამოს ნაბიჯი.\n\n## საყურადღებო\nეს არის სინთეზური მონაცემები.';
export async function request(name: string) {
  preview.calls.push(name); preview.attempt++;
  await new Promise(resolve => setTimeout(resolve, 650));
  if (preview.scenario === 'error' || (preview.scenario === 'partial' && preview.attempt === 2)) throw new ApiError('საცდელი კავშირი შეწყდა. სცადე ხელახლა.', 503);
}
export class ApiError extends Error { isQuotaExceeded = false; usage: any; constructor(message: string, public status = 500) { super(message); } }
const record = (type = 'LAB') => ({ id: 'synthetic-record', type, imageUrl: null, aiAnalysis: answer, createdAt: '2026-09-20T12:00:00Z' });
export const api: any = {
  ai: {
    extractLab: async () => { await request('extract'); return { record: record(), notes: '', labExtract: preview.scenario === 'empty' ? { date: null, parameters: [] } : extract, usage: {} }; },
    explainLab: async () => { await request('explain'); return { analysis: preview.scenario === 'empty' ? '' : answer, usage: {} }; },
    analyzeImage: async ({ kind }: any) => { await request(kind); return { record: record(kind === 'IMAGING' ? 'CT_MRI' : 'SKIN'), analysis: preview.scenario === 'empty' ? '' : answer, usage: {} }; },
    skincare: async () => { await request('skincare'); return { recordId: 'synthetic-routine', analysis: preview.scenario === 'empty' ? '' : skincareAnswer, usage: {} }; },
    feedback: async () => ({}),
  },
  records: { list: async () => ({ records: [] }), get: async () => { await request('history'); return { record: { ...record('SKINCARE'), aiAnalysis: skincareAnswer } }; } },
  chats: { get: async () => { await request('chat-history'); return { session: { messages: [] } }; } },
};
export function useAuth(): any { return { user: { id: preview.owner, fullName: 'საცდელი მომხმარებელი' }, usage: null, applyUsage: () => undefined }; }
export async function streamAiQuery(_: any, { onDelta, signal }: any) {
  await request('chat');
  if (preview.scenario === 'empty') return { answer: '', sessionId: 'test' };
  const full = answer + '\n\n' + ('საცდელი პასუხის დამატებითი აბზაცი გრძელი საუბრისა და გადახვევის შესამოწმებლად.\n\n').repeat(16);
  for (const word of full.split(' ')) { if (signal?.aborted) throw new ApiError('გაუქმდა', 499); onDelta(word + ' '); await new Promise(resolve => setTimeout(resolve, 8)); }
  return { answer: full, sessionId: 'test', interactionId: 'synthetic-chat' };
}
export function scheduleAccountSyncPush() {}
export function requestQuestRefresh() { preview.calls.push('quest-refresh'); }
