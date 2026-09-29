// MEDICARD web — ჩემი ცხოველები (/pets, /pets/:id). Replicates mobile/app/pets/** on the same /api/pets endpoints.
// Product freeze: bug-fix scope only — nothing here that the app does not already do.
// Isolation: pet data never touches human health records; Medi Vet uses its own endpoint and storage.
import {
  h, mount, clear, icon, tile, section, button, iconButton, badge, empty, skeleton, errorBox, segmented,
  toast, openModal, confirmDialog, formModal, field, input, textarea, select, fmtDate, fmtNum, ymd, markdown, relDay,
} from '../ui.js';
import { get, post, patch, del, request, stream, authedBlobUrl, ApiError, invalidate } from '../api.js';
import { lineChart, sparkline } from '../charts.js';
import { withAiConsent } from '../aiConsent.js';
import { featureOn } from '../session.js';

const CSS = '/app/css/pets.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

/* ── Copy (mobile/src/i18n/ka.ts `pets`) ─────────── */
const T = {
  sexMale: 'მამრი', sexFemale: 'მდედრი', sexUnknown: 'სქესი უცნობია',
  ageUnknown: 'ასაკი უცნობია',
  unitKg: 'კგ', unitG: 'გ', unitLb: 'ფუნტი',
  kinds: { VACCINATION: 'აცრა', FLEA_TICK: 'რწყილი / ტკიპა', DEWORMING: 'ჭიების საწინააღმდეგო', MEDICATION: 'დანიშნული მედიკამენტი', OTHER: 'სხვა მოვლა' },
  kindIcon: { VACCINATION: 'syringe', FLEA_TICK: 'bug', DEWORMING: 'pill', MEDICATION: 'pill', OTHER: 'heart' },
  kindInk: { VACCINATION: 'blue', FLEA_TICK: 'amber', DEWORMING: 'violet', MEDICATION: 'rose', OTHER: 'teal' },
  routes: { oral: 'პერორალური', topical: 'გარეგანი', injection: 'ინექცია', other: 'სხვა', unknown: 'უცნობი' },
  recurrence: { ONCE: 'ერთჯერადი', EVERY_N_DAYS: 'ყოველ N დღეში', EVERY_N_WEEKS: 'ყოველ N კვირაში', EVERY_N_MONTHS: 'ყოველ N თვეში', DAILY_COURSE: 'ყოველდღიური კურსი' },
  sources: { VETERINARIAN: 'ვეტერინარი', PRODUCT_INSTRUCTIONS: 'პროდუქტის ინსტრუქცია', USER_ENTERED: 'ჩემი ჩანაწერი' },
  allergyCats: { medication: 'მედიკამენტი', food: 'საკვები', environmental: 'გარემო', other: 'სხვა', unknown: 'უცნობი' },
  allergyStatus: { suspected: 'მფლობელის დაკვირვება (სავარაუდო)', veterinarian_confirmed: 'ვეტერინარის დადასტურებული' },
  condStatus: { active: 'აქტიური', resolved: 'დასრულებული', unknown: 'უცნობი' },
  condBasis: { owner_reported: 'მფლობელის ჩანაწერი', veterinarian_confirmed: 'ვეტერინარის დადასტურებული' },
  plannedDisclaimer: 'ეს დაგეგმილი მოვლაა, არა გარანტირებული დაცვა ან სამედიცინო რეკომენდაცია.',
  vetDisclaimer: 'ეს არ არის ვეტერინარული დიაგნოზი — საჭიროების შემთხვევაში მიმართე ვეტერინარს.',
  vetDisclosureBody: 'შესაბამისი ცხოველის ჩანაწერი და შენი შეტყობინებები იგზავნება AI პროვაიდერთან (OpenRouter). ეს არ არის ვეტერინარული დიაგნოზი.',
  vetStarters: ['მოვლის ისტორიის შეჯამება', 'ვეტერინართან ვიზიტისთვის მომზადება', 'კითხვა ცხოველის მოვლაზე'],
  vetFailed: 'პასუხი ვერ მოვიდა. სცადე თავიდან.', vetCancelled: 'მოთხოვნა გაუქმდა.', vetPartial: 'პასუხი არ დასრულებულა.',
  vetUnavailable: 'Medi Vet ჯერ მზად არ არის ამ სერვერზე.',
  saveError: 'შენახვა ვერ მოხერხდა. შეავსებული ველები შენარჩუნებულია.',
};
const APP_URL = 'https://apps.apple.com/app/id6812517519';

const rid = () => (crypto?.randomUUID ? crypto.randomUUID() : `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`);
const today = () => ymd();
const utcOffsetMinutes = () => -new Date().getTimezoneOffset();
const tzName = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch { return null; } };
const opt = (map) => Object.entries(map).map(([value, label]) => ({ value, label }));
const nz = (v) => { const s = String(v ?? '').trim(); return s ? s : null; };

/* ── Catalog ─────────────────────────────────────── */
let catalog = null;
async function loadCatalog() {
  if (catalog) return catalog;
  try { catalog = await get('/api/pets/catalog'); } catch { catalog = { species: [] }; }
  return catalog;
}
const speciesOf = (id) => catalog?.species?.find((s) => s.id === id) || null;
function breedLabel(pet) {
  if (pet.breedId === 'custom') return pet.customBreed || 'მითითებული ჯიში';
  if (pet.breedId === 'mixed') return 'შერეული ჯიში';
  return speciesOf(pet.speciesId)?.breeds?.find((b) => b.id === pet.breedId)?.label || 'ჯიში უცნობია';
}
function ageLabel(age) {
  if (!age || age.kind === 'UNKNOWN' || (age.years == null && age.months == null)) return T.ageUnknown;
  const y = age.years ?? 0, m = age.months ?? 0;
  if (y <= 0 && m <= 0) return T.ageUnknown;
  const approx = age.kind === 'APPROXIMATE' ? '≈ ' : '';
  if (y <= 0) return `${approx}${m} თვე`;
  if (m <= 0) return `${approx}${y} წელი`;
  return `${approx}${y} წ. ${m} თვე`;
}
const sexLabel = (s) => (s === 'MALE' ? T.sexMale : s === 'FEMALE' ? T.sexFemale : T.sexUnknown);
const weightLabel = (log) => (log.inputUnit === 'g' ? `${fmtNum(log.inputValue)} გ` : log.inputUnit === 'lb' ? `${fmtNum(log.inputValue, 2)} ფუნტი` : `${fmtNum(log.inputValue, 2)} კგ`);

function petPhoto(pet, size = 64) {
  const el = h('span', { class: 'pet-photo', style: { width: `${size}px`, height: `${size}px`, fontSize: `${Math.round(size * 0.38)}px` } },
    (pet?.name || '?').trim().slice(0, 1).toUpperCase());
  if (pet?.photoUrl) {
    authedBlobUrl(pet.photoUrl).then((src) => {
      if (!src) return;
      mount(el, h('img', { src, alt: '', loading: 'lazy' }));
      el.classList.add('has-img');
    }).catch(() => {});
  }
  return el;
}

function petErr(e) {
  if (e instanceof ApiError && e.status === 503) return 'ცხოველების მოდული ჯერ მზად არ არის.';
  return e?.message || T.saveError;
}

/* ── Photo: downscale large pictures before upload (the app does the same on device). ── */
async function preparePhoto(file) {
  if (!file) return null;
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) throw new Error('ატვირთე JPEG, PNG ან WEBP ფოტო.');
  if (file.type === 'image/gif' || file.size < 1.5 * 1024 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'pet.jpg', { type: 'image/jpeg' }) : file;
  } catch { return file; }
}
async function uploadPhoto(petId, file) {
  const fd = new FormData();
  fd.append('file', await preparePhoto(file), file.name || 'pet.jpg');
  return request(`/api/pets/${petId}/photo`, { method: 'POST', body: fd, timeoutMs: 60_000 });
}

/* ── Pet form (add / edit) — same fields and rules as PetForm.tsx ── */
async function petForm(pet, onSaved) {
  await loadCatalog();
  const species = catalog.species || [];
  const cur = pet || { speciesId: species[0]?.id || 'dog', breedId: 'unknown', sex: 'UNKNOWN', neutered: null, ageKind: 'UNKNOWN' };
  const speciesSel = select(species.map((s) => ({ value: s.id, label: s.labelKa })), cur.speciesId, { name: 'speciesId' });
  const breedSel = h('select', { class: 'input select', name: 'breedId' });
  const customWrap = field('ჩაწერე ჯიში', input({ name: 'customBreed', maxlength: 80, value: cur.customBreed || '' }));
  const fillBreeds = (sid, value) => {
    const sp = speciesOf(sid);
    const opts = [{ id: 'unknown', label: 'არ ვიცი' }, ...(sp?.allowsMixed ? [{ id: 'mixed', label: 'შერეული ჯიში' }] : []), { id: 'custom', label: 'თავად ჩავწერ' },
      ...(sp?.breeds || []).filter((b) => !['unknown', 'mixed', 'custom'].includes(b.id))];
    mount(breedSel, opts.map((b) => h('option', { value: b.id, selected: b.id === value }, b.label)));
    if (!opts.some((b) => b.id === value)) breedSel.value = 'unknown';
    customWrap.hidden = breedSel.value !== 'custom';
  };
  fillBreeds(cur.speciesId, cur.breedId);
  speciesSel.addEventListener('change', () => fillBreeds(speciesSel.value, 'unknown'));
  breedSel.addEventListener('change', () => { customWrap.hidden = breedSel.value !== 'custom'; });

  const ageSel = select([{ value: 'EXACT', label: 'ვიცი თარიღი' }, { value: 'APPROXIMATE', label: 'დაახლოებით' }, { value: 'UNKNOWN', label: 'არ ვიცი' }], cur.ageKind, { name: 'ageKind' });
  const exactWrap = field('დაბადების თარიღი', input({ type: 'date', name: 'birthDate', max: today(), value: cur.birthDate ? String(cur.birthDate).slice(0, 10) : '' }));
  const approxWrap = h('div', { class: 'stack', style: { gap: '6px' } },
    h('div', { class: 'form-row' },
      field('წელი', input({ type: 'number', name: 'approxYears', min: 0, max: 80, step: 1, placeholder: '0', value: cur.approxAgeYears ?? '' })),
      field('თვე', input({ type: 'number', name: 'approxMonths', min: 0, max: 11, step: 1, placeholder: '0–11', value: cur.approxAgeMonths ?? '' }))),
    h('span', { class: 'field-hint' }, cur.approxAgeRecordedOn ? `ეს შეფასება ჩაიწერა ${String(cur.approxAgeRecordedOn).slice(0, 10)}-ს. შეცვლისას მიუთითე დღევანდელი ასაკი.` : 'მიუთითე დღევანდელი სავარაუდო ასაკი.'));
  const syncAge = () => { exactWrap.hidden = ageSel.value !== 'EXACT'; approxWrap.hidden = ageSel.value !== 'APPROXIMATE'; };
  ageSel.addEventListener('change', syncAge);
  syncAge();

  const fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp,image/gif', class: 'pet-file' });
  const removePhoto = h('input', { type: 'checkbox', name: 'removePhoto' });
  const preview = h('span', { class: 'pet-form-photo' }, pet ? petPhoto(pet, 72) : h('span', { class: 'pet-photo', style: { width: '72px', height: '72px' } }, icon('camera', { size: 24 })));
  fileInput.addEventListener('change', () => {
    const f = fileInput.files?.[0];
    if (!f) return;
    mount(preview, h('span', { class: 'pet-photo has-img', style: { width: '72px', height: '72px' } }, h('img', { src: URL.createObjectURL(f), alt: '' })));
    removePhoto.checked = false;
  });
  const vetOpen = Boolean(cur.vetClinicName || cur.vetName || cur.vetPhone || cur.vetAddress || cur.vetNotes);

  formModal({
    title: pet ? `${pet.name} — რედაქტირება` : 'ცხოველის დამატება',
    size: 'lg',
    submit: pet ? 'შენახვა' : 'დამატება',
    fields: () => h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'pet-form-head' }, preview,
        h('div', { class: 'stack', style: { gap: '6px' } },
          h('b', null, pet ? 'მისი ამბავი, განახლებული.' : 'გავიცნოთ შენი მეგობარი'),
          h('span', { class: 'faint', style: { fontSize: '13px' } }, 'ფოტო სურვილისამებრ. შეცვლა ყოველთვის შეგიძლია.'),
          h('label', { class: 'btn btn-ghost btn-sm pet-file-btn' }, icon('upload', { size: 16 }), h('span', null, 'ფოტოს არჩევა'), fileInput),
          pet?.photoUrl ? h('label', { class: 'hstack faint', style: { fontSize: '13px', gap: '6px' } }, removePhoto, 'ფოტოს წაშლა') : null)),
      field('რა ჰქვია? *', input({ name: 'name', required: true, maxlength: 40, placeholder: 'მაგალითად, ლუნა', value: cur.name || '', autocomplete: 'off' })),
      h('div', { class: 'form-row' }, field('სახეობა *', speciesSel), field('ჯიში', breedSel)),
      customWrap,
      h('div', { class: 'form-row' },
        field('სქესი', select([{ value: 'MALE', label: 'მამრი' }, { value: 'FEMALE', label: 'მდედრი' }, { value: 'UNKNOWN', label: 'არ ვიცი' }], cur.sex, { name: 'sex' })),
        field('სტერილიზაცია / კასტრაცია', select([{ value: 'true', label: 'კი' }, { value: 'false', label: 'არა' }, { value: '', label: 'არ ვიცი' }], cur.neutered == null ? '' : String(cur.neutered), { name: 'neutered' }))),
      field('ასაკი', ageSel),
      exactWrap, approxWrap,
      h('details', { class: 'pet-details', open: vetOpen },
        h('summary', null, tile('stethoscope', 'teal', 34), h('span', null, h('b', null, 'ვეტერინარის კონტაქტი'), h('small', null, 'სურვილისამებრ · ყველაფერი ერთ ადგილას')), icon('chevronDown', { size: 16 })),
        h('div', { class: 'stack', style: { gap: '12px', marginTop: '12px' } },
          h('div', { class: 'form-row' },
            field('კლინიკა', input({ name: 'vetClinicName', maxlength: 160, value: cur.vetClinicName || '' })),
            field('ვეტერინარის სახელი', input({ name: 'vetName', maxlength: 80, value: cur.vetName || '' }))),
          h('div', { class: 'form-row' },
            field('ტელეფონი', input({ name: 'vetPhone', type: 'tel', maxlength: 40, value: cur.vetPhone || '' })),
            field('მისამართი', input({ name: 'vetAddress', maxlength: 300, value: cur.vetAddress || '' }))),
          field('შენიშვნა', textarea({ name: 'vetNotes', maxlength: 500, rows: 2, value: cur.vetNotes || '' })))),
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, '* მხოლოდ სახელი და სახეობაა აუცილებელი. ცხოველის ჩანაწერები შენს ჯანმრთელობის მონაცემებს არ ერევა.')),
    onSubmit: async (v, close) => {
      const name = v.name.trim();
      if (!name) throw new Error('ჯერ შენი ცხოველის სახელი ჩაწერე.');
      if (!speciesOf(v.speciesId) && species.length) throw new Error('აირჩიე ცხოველის სახეობა.');
      if (v.breedId === 'custom' && !String(v.customBreed || '').trim()) throw new Error('ჩაწერე ჯიში ან აირჩიე „არ ვიცი“.');
      const body = {
        name, speciesId: v.speciesId, breedId: v.breedId || 'unknown', customBreed: v.breedId === 'custom' ? v.customBreed.trim() : null,
        sex: v.sex, neutered: v.neutered === '' ? null : v.neutered === 'true',
        ageKind: v.ageKind, birthDate: null, approxAgeYears: null, approxAgeMonths: null, approxAgeRecordedOn: null,
        vetClinicName: nz(v.vetClinicName), vetName: nz(v.vetName), vetPhone: nz(v.vetPhone), vetAddress: nz(v.vetAddress), vetNotes: nz(v.vetNotes),
      };
      if (v.ageKind === 'EXACT') {
        if (!v.birthDate) throw new Error('შეიყვანე სრული თარიღი — დღე, თვე, წელი.');
        if (v.birthDate > today()) throw new Error('ჩანაწერის თარიღი მომავალში ვერ იქნება.');
        const oldest = new Date(); oldest.setFullYear(oldest.getFullYear() - 80);
        if (v.birthDate < ymd(oldest)) throw new Error('შეამოწმე დაბადების წელი — ასაკი 80 წელს არ უნდა აღემატებოდეს.');
        body.birthDate = v.birthDate;
      } else if (v.ageKind === 'APPROXIMATE') {
        const y = v.approxYears === '' ? 0 : Number(v.approxYears), m = v.approxMonths === '' ? 0 : Number(v.approxMonths);
        if (!Number.isInteger(y) || y < 0 || y > 80) throw new Error('წლები უნდა იყოს 0–80.');
        if (!Number.isInteger(m) || m < 0 || m > 11) throw new Error('თვეები უნდა იყოს 0–11.');
        if (y + m === 0) throw new Error('მიუთითე ასაკი ან აირჩიე „არ ვიცი“.');
        body.approxAgeYears = v.approxYears === '' ? null : y;
        body.approxAgeMonths = v.approxMonths === '' ? null : m;
        // Keep the estimate's anchor date unless the numbers changed (identityAgeBody).
        const same = pet && pet.ageKind === 'APPROXIMATE' && pet.approxAgeYears === body.approxAgeYears && pet.approxAgeMonths === body.approxAgeMonths;
        body.approxAgeRecordedOn = same ? pet.approxAgeRecordedOn || null : null;
      }
      let saved;
      try {
        saved = pet ? (await patch(`/api/pets/${pet.id}`, body)).pet : (await post('/api/pets', body)).pet;
      } catch (e) { throw new Error(petErr(e)); }
      const file = fileInput.files?.[0];
      try {
        if (file) saved = (await uploadPhoto(saved.id, file)).pet || saved;
        else if (pet?.photoUrl && removePhoto.checked) saved = (await del(`/api/pets/${saved.id}/photo`)).pet || saved;
      } catch (e) {
        toast(`პროფილი შეინახა, ფოტო — ვერა: ${e?.message || ''}`.trim(), 'error');
      }
      invalidate('/api/pets');
      close();
      toast(pet ? 'შენახულია' : `${saved.name} დაემატა`);
      onSaved?.(saved);
    },
  });
}

async function archivePet(pet, after) {
  const ok = await confirmDialog({ title: 'არქივში გადავიტანოთ?', body: 'არქივში გადატანის შემდეგ სიაში აღარ გამოჩნდება. ჩანაწერი არ წაიშლება.', confirm: 'არქივში', danger: true });
  if (!ok) return;
  try {
    await post(`/api/pets/${pet.id}/archive`);
    invalidate('/api/pets');
    toast(`${pet.name} არქივშია`);
    after?.();
  } catch (e) { toast(petErr(e), 'error'); }
}

/* ── Router entry ────────────────────────────────── */
export default async function petsPage(root, ctx) {
  ensureCss();
  return ctx.params?.id ? petDetail(root, ctx) : petsHub(root, ctx);
}

/* ── /pets ───────────────────────────────────────── */
async function petsHub(root, ctx) {
  const grid = h('div', null, h('div', { class: 'grid grid-auto' }, skeleton(3), skeleton(3), skeleton(3)));
  let pets = [];
  const addBtn = button('ცხოველის დამატება', { icon: 'plus', onClick: () => petForm(null, (p) => ctx.navigate(`/pets/${p.id}`)) });
  mount(root,
    h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' }, h('h1', null, 'ჩემი ცხოველები'), h('p', null, 'მეტი ზრუნვა, ნაკლები დავიწყება. შენი ცხოველების ამბები და ყოველდღიური მოვლა ერთ სივრცეში.')),
      h('div', { class: 'page-head-actions' }, addBtn)),
    grid,
    h('div', { class: 'grid grid-main pets-lower' },
      section('ვეტკლინიკები', clinicsCard()),
      section('როგორ დავიწყო?', h('div', { class: 'card stack pets-steps' }, [
        ['01 · შექმენი პროფილი', 'თითოეულ ცხოველს თავისი ჩანაწერები და ისტორია აქვს.'],
        ['02 · შეინახე და დაგეგმე', 'უკვე ჩატარებული პროცედურა ჩაწერე ისტორიაში, მომავალი კი მოვლის გეგმაში.'],
        ['03 · ჰკითხე Medi Vet-ს', 'შენახულ ჩანაწერებზე დაყრდნობით მოვლის კითხვებს გიპასუხებს. ეს არ არის დიაგნოზი.'],
      ].map(([t, b]) => h('div', null, h('b', null, t), h('p', { class: 'muted', style: { fontSize: '13.5px', marginTop: '2px' } }, b)))))));

  const draw = async () => {
    try {
      await loadCatalog();
      const res = await get('/api/pets');
      pets = res?.pets || [];
      addBtn.hidden = pets.length >= 20;
      if (!pets.length) {
        mount(grid, h('div', { class: 'card pad-lg' }, empty('პირველი ნაბიჯი — გაცნობა.', 'დაიწყე სახელითა და სახეობით. ფოტო, ასაკი და სხვა დეტალები მოგვიანებითაც შეგიძლია დაამატო.',
          button('ცხოველის დამატება', { icon: 'plus', onClick: () => petForm(null, (p) => ctx.navigate(`/pets/${p.id}`)) }))));
        return;
      }
      mount(grid, section(`ჩემი ცხოველები · ${pets.length}`, h('div', { class: 'grid pets-grid' }, pets.map((p) => petCard(p)))));
    } catch (e) {
      mount(grid, errorBox(e instanceof ApiError && e.status === 503 ? new Error('ცხოველების მოდული ჯერ მზად არ არის.') : e, draw));
    }
  };

  function petCard(p) {
    const sp = speciesOf(p.speciesId);
    return h('div', { class: 'card hover pet-card' },
      h('a', { class: 'pet-card-link', href: `/pets/${p.id}`, 'data-link': '', 'aria-label': p.name }),
      h('div', { class: 'pet-card-top' }, petPhoto(p, 64),
        h('div', { class: 'pet-card-main' },
          h('div', { class: 'pet-card-name' }, p.name),
          h('div', { class: 'muted', style: { fontSize: '13px' } }, [sp?.labelKa, sexLabel(p.sex)].filter(Boolean).join(' · ')),
          h('div', { class: 'faint', style: { fontSize: '12.5px' } }, [breedLabel(p), ageLabel(p.age)].join(' · '))),
        h('div', { class: 'pet-card-actions' },
          iconButton('edit', { title: 'რედაქტირება', onClick: (e) => { e.preventDefault(); e.stopPropagation(); petForm(p, draw); } }),
          iconButton('archive', { title: 'არქივში გადატანა', onClick: (e) => { e.preventDefault(); e.stopPropagation(); archivePet(p, draw); } }))),
      h('div', { class: 'pet-card-links' },
        h('a', { href: `/pets/${p.id}?tab=care`, 'data-link': '', class: 'chip' }, icon('calendarCheck', { size: 14 }), 'მოვლა'),
        h('a', { href: `/pets/${p.id}?tab=health`, 'data-link': '', class: 'chip' }, icon('scale', { size: 14 }), 'წონა'),
        featureOn('mediVet') ? h('a', { href: `/pets/${p.id}?tab=vet`, 'data-link': '', class: 'chip' }, icon('stethoscope', { size: 14 }), 'Medi Vet') : null));
  }

  await draw();
}

function clinicsCard() {
  const slot = h('div', { class: 'card' }, skeleton(4));
  (async () => {
    try {
      const dir = await get('/api/pets/clinics');
      const all = dir?.clinics || [];
      let onlyOpen = false;
      let query = '';
      let expanded = false;
      const list = h('div', { class: 'list' });
      const draw = () => {
        const q = query.trim().toLowerCase();
        const rows = all.filter((c) => (!onlyOpen || c.openNow === true) && (!q || `${c.name} ${c.location || ''}`.toLowerCase().includes(q)));
        const shown = expanded ? rows : rows.slice(0, 6);
        mount(list, shown.length ? shown.map((c) => h('div', { class: 'row pet-clinic' }, tile('stethoscope', 'teal', 36),
          h('div', { class: 'row-main' },
            h('div', { class: 'row-title' }, c.name),
            h('div', { class: 'row-sub' }, [c.location, c.hoursKnown ? null : 'საათი უცნობია'].filter(Boolean).join(' · ') || '—')),
          h('div', { class: 'row-trail' },
            c.openNow === true ? badge('ღიაა', 'ok') : c.openNow === false ? badge('დაკეტილია', 'neutral') : null,
            c.phones?.[0] ? h('a', { class: 'icon-btn', href: `tel:${c.phones[0].tel}`, title: `დარეკვა · ${c.phones[0].display}`, 'aria-label': `დარეკვა ${c.phones[0].display}` }, icon('phone', { size: 18 })) : null)))
          : h('p', { class: 'muted', style: { padding: '12px 4px' } }, 'კლინიკები ამ ფილტრში არ ჩანს.'),
        !expanded && rows.length > shown.length ? h('div', { style: { textAlign: 'center', paddingTop: '6px' } },
          button(`ყველას ნახვა · ${rows.length}`, { variant: 'ghost', size: 'sm', onClick: () => { expanded = true; draw(); } })) : null);
      };
      const search = input({ type: 'search', placeholder: 'კლინიკის ძებნა', 'aria-label': 'კლინიკის ძებნა' });
      search.addEventListener('input', () => { query = search.value; draw(); });
      draw();
      mount(slot,
        h('div', { class: 'pet-clinic-tools' }, search,
          segmented([{ value: 'all', label: 'ყველა' }, { value: 'open', label: 'ღია ახლა' }], 'all', (v) => { onlyOpen = v === 'open'; draw(); })),
        dir?.stale ? h('p', { class: 'faint', style: { fontSize: '12.5px', margin: '8px 0' } }, 'ბოლო შენახული სია — დირექტორია ახლა მიუწვდომელია.') : null,
        list,
        h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '8px' } }, dir?.source?.url
          ? h('a', { href: dir.source.url, target: '_blank', rel: 'noopener', class: 'link' }, `წყარო: ${dir.source.name || 'Dogdog.ge'}`, icon('externalLink', { size: 12 }))
          : 'წყარო: Dogdog.ge'));
    } catch (e) {
      mount(slot, h('p', { class: 'muted' }, 'კლინიკების სია ვერ ჩაიტვირთა.'));
    }
  })();
  return slot;
}

/* ── /pets/:id ───────────────────────────────────── */
async function petDetail(root, ctx) {
  const id = ctx.params.id;
  let alive = true;
  let pet = null;
  let tab = ['overview', 'health', 'care', 'vet'].includes(ctx.query?.tab) ? ctx.query.tab : 'overview';
  if (tab === 'vet' && !featureOn('mediVet')) tab = 'overview';
  const head = h('div', null, skeleton(2));
  const body = h('div', { class: 'pet-body' });
  const tabItems = [{ value: 'overview', label: 'მიმოხილვა' }, { value: 'health', label: 'ჯანმრთელობა' }, { value: 'care', label: 'მოვლა' }];
  if (featureOn('mediVet')) tabItems.push({ value: 'vet', label: 'Medi Vet' });
  const tabs = segmented(tabItems, tab, (v) => { tab = v; syncUrl(); renderTab(); });
  tabs.classList.add('pet-tabs');
  let chatCleanup = null;
  const syncUrl = () => {
    const u = new URL(location.href);
    if (tab === 'overview') u.searchParams.delete('tab'); else u.searchParams.set('tab', tab);
    history.replaceState(history.state, '', u.pathname + u.search);
  };
  const selectTab = (v) => {
    const i = tabItems.findIndex((t) => t.value === v);
    tabs.querySelectorAll('button')[i]?.click();
  };

  mount(root, h('a', { class: 'back', href: '/pets', 'data-link': '' }, icon('chevronLeft', { size: 16 }), 'ჩემი ცხოველები'), head, tabs, body);

  const loadPet = async () => {
    await loadCatalog();
    const res = await get(`/api/pets/${encodeURIComponent(id)}`);
    pet = res.pet;
    ctx.setTitle?.(pet.name);
    drawHead();
  };

  function drawHead() {
    const sp = speciesOf(pet.speciesId);
    const setup = [
      { label: 'დაამატე ფოტო', done: Boolean(pet.photoUrl) },
      { label: 'მიუთითე ასაკი, თუ იცი', done: pet.ageKind !== 'UNKNOWN' },
      { label: 'შეინახე ვეტერინარის კონტაქტი', done: Boolean(pet.vetPhone || pet.vetName || pet.vetClinicName) },
    ];
    mount(head, h('div', { class: 'pet-hero' },
      petPhoto(pet, 88),
      h('div', { class: 'pet-hero-main' },
        h('h1', null, pet.name),
        h('div', { class: 'muted' }, [sp?.labelKa, breedLabel(pet), sexLabel(pet.sex), ageLabel(pet.age)].filter(Boolean).join(' · ')),
        setup.some((s) => !s.done) ? h('div', { class: 'chips', style: { marginTop: '10px' } }, setup.filter((s) => !s.done).map((s) =>
          h('button', { type: 'button', class: 'chip', onClick: () => petForm(pet, (p) => { pet = p; drawHead(); renderTab(); }) }, icon('plus', { size: 14 }), s.label))) : null),
      h('div', { class: 'page-head-actions' },
        featureOn('mediVet') ? button('Medi Vet', { icon: 'stethoscope', variant: 'secondary', onClick: () => selectTab('vet') }) : null,
        button('რედაქტირება', { icon: 'edit', variant: 'ghost', onClick: () => petForm(pet, (p) => { pet = p; drawHead(); renderTab(); }) }),
        iconButton('archive', { title: 'არქივში გადატანა', onClick: () => archivePet(pet, () => ctx.navigate('/pets')) }))));
  }

  function renderTab() {
    if (typeof chatCleanup === 'function') { chatCleanup(); chatCleanup = null; }
    if (!pet) return;
    if (tab === 'health') renderHealth();
    else if (tab === 'care') renderCare();
    else if (tab === 'vet') chatCleanup = renderVet(body, pet);
    else renderOverview();
  }

  /* Overview */
  function renderOverview() {
    const weightSlot = h('div', null, skeleton(3));
    const careSlot = h('div', null, skeleton(3));
    const healthSlot = h('div', null, skeleton(2));
    const sp = speciesOf(pet.speciesId);
    const rows = [
      ['სახეობა', sp?.labelKa || '—'], ['ჯიში', breedLabel(pet)], ['სქესი', sexLabel(pet.sex)],
      ['სტერილიზაცია / კასტრაცია', pet.neutered == null ? 'უცნობია' : pet.neutered ? 'კი' : 'არა'],
      ['ასაკი', ageLabel(pet.age)],
      pet.birthDate ? ['დაბადების თარიღი', fmtDate(pet.birthDate, { year: true })] : null,
    ].filter(Boolean);
    const vet = [['კლინიკა', pet.vetClinicName], ['ვეტერინარი', pet.vetName], ['ტელეფონი', pet.vetPhone], ['მისამართი', pet.vetAddress], ['შენიშვნა', pet.vetNotes]].filter(([, v]) => v);
    mount(body, h('div', { class: 'grid grid-main pet-grid' },
      h('div', { class: 'stack', style: { gap: '28px' } },
        section('წონა', weightSlot, { action: h('button', { type: 'button', class: 'link text-btn', onClick: () => selectTab('health') }, 'ისტორია', icon('chevronRight', { size: 16 })) }),
        section('პროფილი', h('div', { class: 'card' },
          h('dl', { class: 'pet-dl' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
          h('div', { class: 'pet-vet' },
            h('div', { class: 'card-title', style: { marginBottom: '8px' } }, 'ვეტერინარი'),
            vet.length ? h('dl', { class: 'pet-dl' }, vet.map(([k, v]) => [h('dt', null, k), h('dd', null, k === 'ტელეფონი' ? h('a', { class: 'link', href: `tel:${String(v).replace(/[^\d+]/g, '')}` }, v) : v)]))
              : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'ვეტერინარის კონტაქტი ჯერ არ არის შენახული.'))))),
      h('div', { class: 'stack', style: { gap: '28px' } },
        section('მოვლის კალენდარი', careSlot, { action: h('button', { type: 'button', class: 'link text-btn', onClick: () => selectTab('care') }, 'ყველა', icon('chevronRight', { size: 16 })) }),
        section('ჯანმრთელობა', healthSlot),
        featureOn('mediVet') ? section('Medi Vet', h('div', { class: 'card feature' },
          tile('stethoscope', 'violet', 42),
          h('h3', null, `${pet.name} — უკეთ გავიცნოთ.`),
          h('p', null, 'მოვლა, შენახული ჩანაწერები და შეკითხვები შენს ცხოველზე. ეს არ არის ვეტერინარული დიაგნოზი.'),
          h('button', { type: 'button', class: 'cta text-btn', onClick: () => selectTab('vet') }, 'კითხვის დასმა', icon('arrowRight', { size: 16 })))) : null)));

    (async () => {
      try {
        const w = await get(`/api/pets/${id}/weight`, { limit: 60 });
        const items = [...(w.items || [])].sort((a, b) => String(a.recordedOn).localeCompare(String(b.recordedOn)));
        const latest = w.latest || items[items.length - 1];
        if (!latest) {
          mount(weightSlot, h('div', { class: 'card' }, empty('წონა ჯერ არ არის დამატებული.', 'დაამატე გაზომვა — იდეალური წონა ან დიაგნოზი არ გამოითვლება.',
            button('წონის დამატება', { icon: 'plus', variant: 'secondary', onClick: () => weightForm(null, () => renderOverview()) }))));
          return;
        }
        const first = items[0];
        const diff = items.length > 1 ? latest.weightKg - first.weightKg : 0;
        mount(weightSlot, h('div', { class: 'card pet-weight-card' },
          h('div', { class: 'between' },
            h('div', null, h('div', { class: 'stat-label' }, 'ბოლო ჩანაწერი'),
              h('div', { class: 'stat-value' }, weightLabel(latest)),
              h('div', { class: 'faint', style: { fontSize: '12.5px' } }, fmtDate(latest.recordedOn, { year: true }))),
            items.length > 1 ? badge(Math.abs(diff) < 0.05 ? 'სტაბილური' : diff > 0 ? `+${fmtNum(diff, 2)} კგ` : `${fmtNum(diff, 2)} კგ`, 'neutral') : null),
          items.length > 1 ? sparkline(items.map((i) => i.weightKg), { height: 56 }) : h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, 'ერთი გაზომვა — ტრენდი ჯერ არ ჩანს.'),
          h('div', { style: { marginTop: '10px' } }, button('წონის დამატება', { icon: 'plus', variant: 'ghost', size: 'sm', onClick: () => weightForm(null, () => renderOverview()) }))));
      } catch (e) { mount(weightSlot, errorBox(e)); }
    })();
    (async () => {
      try {
        const up = await get(`/api/pets/${id}/care/upcoming`);
        const all = [...(up.overdue || []).map((o) => ({ ...o, _state: 'overdue' })), ...(up.due || []).map((o) => ({ ...o, _state: 'due' })), ...(up.upcoming || []).map((o) => ({ ...o, _state: 'upcoming' }))].slice(0, 4);
        mount(careSlot, h('div', { class: 'card' }, all.length ? h('div', { class: 'list' }, all.map((o) => occurrenceRow(o, null)))
          : empty('ახლო დღეებში დაგეგმილი მოვლა არ არის.', null, button('მოვლის დაგეგმვა', { icon: 'plus', variant: 'secondary', onClick: () => planForm(null, () => renderOverview()) }))));
      } catch (e) { mount(careSlot, errorBox(e)); }
    })();
    (async () => {
      try {
        const [a, c] = await Promise.all([get(`/api/pets/${id}/allergies`), get(`/api/pets/${id}/conditions`)]);
        const active = (c.items || []).filter((x) => x.status === 'active').length;
        mount(healthSlot, h('div', { class: 'card' }, h('div', { class: 'list' },
          h('button', { type: 'button', class: 'row row-link', onClick: () => selectTab('health') }, tile('alert', 'rose', 38),
            h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'ალერგიები'), h('div', { class: 'row-sub' }, (a.items || []).length ? `${a.items.length} ჩანაწერი` : 'ჯერ არ არის დამატებული')),
            icon('chevronRight', { size: 18, className: 'row-chev' })),
          h('button', { type: 'button', class: 'row row-link', onClick: () => selectTab('health') }, tile('heart', 'violet', 38),
            h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'ჯანმრთელობის მდგომარეობები'), h('div', { class: 'row-sub' }, active ? `${active} აქტიური` : 'აქტიური არ არის მითითებული')),
            icon('chevronRight', { size: 18, className: 'row-chev' })))));
      } catch (e) { mount(healthSlot, errorBox(e)); }
    })();
  }

  /* Health: weight, allergies, conditions */
  function renderHealth() {
    const wSlot = h('div', null, skeleton(4));
    const aSlot = h('div', null, skeleton(3));
    const cSlot = h('div', null, skeleton(3));
    mount(body, h('div', { class: 'stack', style: { gap: '28px' } },
      section('წონა', wSlot, { action: button('დამატება', { icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => weightForm(null, drawWeight) }) }),
      h('div', { class: 'grid grid-2 pet-grid' },
        section('ალერგიები', aSlot, { action: button('დამატება', { icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => allergyForm(null, drawAllergies) }) }),
        section('ჯანმრთელობის მდგომარეობები', cSlot, { action: button('დამატება', { icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => conditionForm(null, drawConditions) }) }))));

    async function drawWeight() {
      try {
        const w = await get(`/api/pets/${id}/weight`, { limit: 100 });
        const items = [...(w.items || [])].sort((a, b) => String(a.recordedOn).localeCompare(String(b.recordedOn)));
        if (!items.length) {
          mount(wSlot, h('div', { class: 'card' }, empty('წონა ჯერ არ არის დამატებული.', 'დაამატე გაზომვა — იდეალური წონა ან დიაგნოზი არ გამოითვლება.',
            button('წონის დამატება', { icon: 'plus', onClick: () => weightForm(null, drawWeight) }))));
          return;
        }
        const recent = [...items].reverse();
        mount(wSlot, h('div', { class: 'grid grid-main pet-grid' },
          h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, 'წონის ისტორია'), h('span', { class: 'faint' }, `${items.length} გაზომვა`)),
            items.length > 1
              ? lineChart({ labels: items.map((i) => fmtDate(i.recordedOn, { short: true })), tipLabels: items.map((i) => fmtDate(i.recordedOn, { year: true })),
                series: [{ name: 'წონა', values: items.map((i) => i.weightKg), color: 'var(--c1)' }], unit: 'კგ', zero: false, height: 230, fmt: (v) => fmtNum(v, 2) })
              : h('p', { class: 'muted' }, 'ერთი გაზომვა — ტრენდი ჯერ არ ჩანს.'),
            h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, 'იდეალური წონა ან დიაგნოზი არ გამოითვლება.')),
          h('div', { class: 'card' }, h('div', { class: 'list pet-scroll' }, recent.map((log) => h('div', { class: 'row' }, tile('scale', 'teal', 36),
            h('div', { class: 'row-main' }, h('div', { class: 'row-title num' }, weightLabel(log)),
              h('div', { class: 'row-sub' }, [fmtDate(log.recordedOn, { year: true }), log.inputUnit !== 'kg' ? `${fmtNum(log.weightKg, 2)} კგ` : null, log.note].filter(Boolean).join(' · '))),
            h('div', { class: 'row-trail' },
              iconButton('edit', { title: 'რედაქტირება', onClick: () => weightForm(log, drawWeight) }),
              iconButton('trash', { title: 'წაშლა', onClick: () => removeChild(`/api/pets/${id}/weight/${log.id}`, drawWeight) }))))))));
      } catch (e) { mount(wSlot, errorBox(e, drawWeight)); }
    }
    async function drawAllergies() {
      try {
        const res = await get(`/api/pets/${id}/allergies`);
        const items = res.items || [];
        mount(aSlot, h('div', { class: 'card' }, items.length ? h('div', { class: 'list' }, items.map((a) => h('div', { class: 'row' }, tile('alert', 'rose', 36),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, a.name),
            h('div', { class: 'row-sub' }, [T.allergyCats[a.category] || a.category, T.allergyStatus[a.reportedStatus], a.reaction, a.notedOn ? fmtDate(a.notedOn, { year: true }) : null].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' },
            iconButton('edit', { title: 'რედაქტირება', onClick: () => allergyForm(a, drawAllergies) }),
            iconButton('trash', { title: 'წაშლა', onClick: () => removeChild(`/api/pets/${id}/allergies/${a.id}`, drawAllergies) })))))
          : empty('ალერგიები ჯერ არ არის დამატებული', 'ცარიელი სია არ ნიშნავს, რომ ალერგია არ აქვს — უბრალოდ ჯერ არ არის ჩაწერილი.')));
      } catch (e) { mount(aSlot, errorBox(e, drawAllergies)); }
    }
    async function drawConditions() {
      try {
        const res = await get(`/api/pets/${id}/conditions`);
        const items = res.items || [];
        const active = items.filter((c) => c.status !== 'resolved');
        const resolved = items.filter((c) => c.status === 'resolved');
        const rowOf = (c) => h('div', { class: 'row' }, tile('heart', c.status === 'active' ? 'violet' : 'neutral', 36),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, c.name),
            h('div', { class: 'row-sub' }, [T.condStatus[c.status], T.condBasis[c.reportedBasis], c.onsetOn ? `დაწყება ${fmtDate(c.onsetOn, { year: true })}` : null, c.resolvedOn ? `დასრულება ${fmtDate(c.resolvedOn, { year: true })}` : null].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' },
            iconButton('edit', { title: 'რედაქტირება', onClick: () => conditionForm(c, drawConditions) }),
            iconButton('trash', { title: 'წაშლა', onClick: () => removeChild(`/api/pets/${id}/conditions/${c.id}`, drawConditions) })));
        mount(cSlot, h('div', { class: 'card' }, items.length ? [
          active.length ? h('div', { class: 'list' }, active.map(rowOf)) : h('p', { class: 'muted' }, 'აქტიური არ არის მითითებული'),
          resolved.length ? h('div', { class: 'pet-subhead' }, 'დასრულებული / ისტორია') : null,
          resolved.length ? h('div', { class: 'list' }, resolved.map(rowOf)) : null,
        ] : empty('მდგომარეობები ჯერ არ არის დამატებული.', 'ჩაწერე, რაც იცი. ეს არ არის დიაგნოზი.')));
      } catch (e) { mount(cSlot, errorBox(e, drawConditions)); }
    }
    drawWeight(); drawAllergies(); drawConditions();
  }

  async function removeChild(path, after) {
    if (!(await confirmDialog({ title: 'წავშალოთ ჩანაწერი?', body: 'ეს მოქმედება ვერ გაუქმდება.', confirm: 'წაშლა', danger: true }))) return;
    try { await del(path); toast('წაიშალა'); after(); } catch (e) { toast(petErr(e), 'error'); }
  }

  function weightForm(log, after) {
    formModal({
      title: log ? 'წონის რედაქტირება' : 'წონის დამატება',
      size: 'sm',
      fields: () => h('div', { class: 'stack' },
        h('div', { class: 'form-row' },
          field('წონა', input({ type: 'number', name: 'inputValue', step: 'any', min: 0, required: true, value: log?.inputValue ?? '', inputmode: 'decimal' })),
          field('ერთეული', select([{ value: 'kg', label: 'კგ' }, { value: 'g', label: 'გრამი' }, { value: 'lb', label: 'ფუნტი' }], log?.inputUnit || 'kg', { name: 'inputUnit' }))),
        field('გაზომვის თარიღი', input({ type: 'date', name: 'recordedOn', max: today(), required: true, value: log ? String(log.recordedOn).slice(0, 10) : today() })),
        field('შენიშვნა', input({ name: 'note', maxlength: 500, placeholder: 'არასავალდებულო', value: log?.note || '' }))),
      onSubmit: async (v, close) => {
        const value = Number(String(v.inputValue).replace(',', '.'));
        if (!v.inputValue || !Number.isFinite(value) || value <= 0) throw new Error('შეიყვანე წონა');
        if (!v.recordedOn) throw new Error('გაზომვის თარიღი');
        if (v.recordedOn > today()) throw new Error('ჩანაწერის თარიღი მომავალში ვერ იქნება.');
        const body = { recordedOn: v.recordedOn, inputValue: value, inputUnit: v.inputUnit, note: nz(v.note) };
        try {
          if (log) await patch(`/api/pets/${id}/weight/${log.id}`, body);
          else await post(`/api/pets/${id}/weight`, { ...body, clientRequestId: rid() });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast('შენახულია'); after?.();
      },
    });
  }

  function allergyForm(a, after) {
    formModal({
      title: a ? 'ალერგიის რედაქტირება' : 'ალერგიის დამატება',
      fields: () => h('div', { class: 'stack' },
        field('ალერგენი', input({ name: 'name', required: true, maxlength: 120, placeholder: 'მაგ. ქათამი, პენიცილინი', value: a?.name || '' })),
        h('div', { class: 'form-row' },
          field('კატეგორია', select(opt(T.allergyCats), a?.category || 'unknown', { name: 'category' })),
          field('წყარო', select(opt(T.allergyStatus), a?.reportedStatus || 'suspected', { name: 'reportedStatus' }))),
        field('რეაქცია', input({ name: 'reaction', maxlength: 300, placeholder: 'რა დაინახე', value: a?.reaction || '' })),
        field('დაფიქსირების თარიღი', input({ type: 'date', name: 'notedOn', max: today(), value: a?.notedOn ? String(a.notedOn).slice(0, 10) : '' }), 'თუ არ იცი, დატოვე ცარიელი.'),
        field('შენიშვნა', textarea({ name: 'notes', maxlength: 1000, rows: 2, value: a?.notes || '' }))),
      onSubmit: async (v, close) => {
        if (!v.name.trim()) throw new Error('შეიყვანე სახელი');
        if (v.notedOn && v.notedOn > today()) throw new Error('ჩანაწერის თარიღი მომავალში ვერ იქნება.');
        const body = { name: v.name.trim(), category: v.category, reportedStatus: v.reportedStatus, reaction: nz(v.reaction), notedOn: v.notedOn || null, notes: nz(v.notes) };
        try {
          if (a) await patch(`/api/pets/${id}/allergies/${a.id}`, body);
          else await post(`/api/pets/${id}/allergies`, { ...body, clientRequestId: rid() });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast('შენახულია'); after?.();
      },
    });
  }

  function conditionForm(c, after) {
    formModal({
      title: c ? 'მდგომარეობის რედაქტირება' : 'მდგომარეობის დამატება',
      fields: () => {
        const status = select(opt(T.condStatus), c?.status || 'active', { name: 'status' });
        const resolvedWrap = field('დასრულების თარიღი', input({ type: 'date', name: 'resolvedOn', max: today(), value: c?.resolvedOn ? String(c.resolvedOn).slice(0, 10) : '' }));
        const sync = () => { resolvedWrap.hidden = status.value !== 'resolved'; };
        status.addEventListener('change', sync); sync();
        return h('div', { class: 'stack' },
          field('მდგომარეობა', input({ name: 'name', required: true, maxlength: 160, placeholder: 'მაგ. ართრიტი', value: c?.name || '' })),
          h('div', { class: 'form-row' }, field('სტატუსი', status), field('წყარო', select(opt(T.condBasis), c?.reportedBasis || 'owner_reported', { name: 'reportedBasis' }))),
          field('დაწყების / დიაგნოზის თარიღი', input({ type: 'date', name: 'onsetOn', max: today(), value: c?.onsetOn ? String(c.onsetOn).slice(0, 10) : '' })),
          resolvedWrap,
          field('შენიშვნა', textarea({ name: 'notes', maxlength: 1000, rows: 2, value: c?.notes || '' })),
          h('p', { class: 'faint', style: { fontSize: '12.5px' } }, 'ჩაწერე, რაც იცი. ეს არ არის დიაგნოზი.'));
      },
      onSubmit: async (v, close) => {
        if (!v.name.trim()) throw new Error('შეიყვანე სახელი');
        if ((v.onsetOn && v.onsetOn > today()) || (v.resolvedOn && v.resolvedOn > today())) throw new Error('ჩანაწერის თარიღი მომავალში ვერ იქნება.');
        const body = { name: v.name.trim(), status: v.status, reportedBasis: v.reportedBasis, onsetOn: v.onsetOn || null, resolvedOn: v.status === 'resolved' ? v.resolvedOn || null : null, notes: nz(v.notes) };
        try {
          if (c) await patch(`/api/pets/${id}/conditions/${c.id}`, body);
          else await post(`/api/pets/${id}/conditions`, { ...body, clientRequestId: rid() });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast('შენახულია'); after?.();
      },
    });
  }

  /* Care: upcoming, plans, products, history */
  function occurrenceRow(o, after) {
    const kind = o.kind || 'OTHER';
    const state = o._state === 'overdue' ? badge('ვადაგასული', 'danger') : o._state === 'due' ? badge('დღეს', 'warn') : null;
    const actions = after ? h('div', { class: 'row-trail' },
      button(kind === 'MEDICATION' ? 'მივეცი' : 'გაკეთდა', { size: 'sm', variant: 'secondary', icon: 'check', onClick: () => completeForm(o, after) }),
      iconButton('x', { title: 'გამოტოვება', onClick: () => skipOccurrence(o, after) })) : h('div', { class: 'row-trail' }, state);
    return h('div', { class: 'row' }, tile(T.kindIcon[kind] || 'heart', T.kindInk[kind] || 'teal', 36),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, o.title || T.kinds[kind]),
        h('div', { class: 'row-sub' }, [T.kinds[kind], relDay(o.plannedOn), o.plannedTime].filter(Boolean).join(' · '), after && state ? ' ' : null, after ? state : null)),
      actions);
  }

  function completeForm(o, after) {
    formModal({
      title: 'მოვლის დადასტურება',
      size: 'sm',
      submit: 'დადასტურება',
      fields: () => h('div', { class: 'stack' },
        h('p', { class: 'muted' }, `${o.title || T.kinds[o.kind] || ''} · დაგეგმილი ${fmtDate(o.plannedOn, { year: true })}`),
        field('მიღების თარიღი', input({ type: 'date', name: 'administeredOn', max: today(), required: true, value: o.plannedOn && o.plannedOn <= today() ? o.plannedOn : today() })),
        field('შენიშვნა', input({ name: 'notes', maxlength: 500, placeholder: 'არასავალდებულო' }))),
      onSubmit: async (v, close) => {
        if (!v.administeredOn) throw new Error('მიღების თარიღი');
        try {
          await post(`/api/pets/${id}/schedules/${o.scheduleId}/complete`, {
            occurrenceKey: o.occurrenceKey, revision: o.revision, administeredOn: v.administeredOn, notes: nz(v.notes), timezone: tzName(), clientRequestId: rid(),
          });
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) { close(); toast('გეგმა შეიცვალა. განაახლე სია და სცადე ხელახლა.', 'info'); after?.(); return; }
          throw new Error(petErr(e));
        }
        close(); toast('შენახულია'); after?.();
      },
    });
  }

  async function skipOccurrence(o, after) {
    if (!(await confirmDialog({ title: 'გამოვტოვოთ?', body: 'გამოტოვება ხურავს ამ შემთხვევას მიღების ჩანაწერის გარეშე.', confirm: 'გამოტოვება' }))) return;
    try {
      await post(`/api/pets/${id}/schedules/${o.scheduleId}/skip`, { occurrenceKey: o.occurrenceKey, revision: o.revision, clientRequestId: rid() });
      toast('გამოტოვებულია'); after?.();
    } catch (e) {
      toast(e instanceof ApiError && e.status === 409 ? 'გეგმა შეიცვალა. განაახლე სია და სცადე ხელახლა.' : petErr(e), 'error');
      after?.();
    }
  }

  async function planForm(draft, after) {
    let products = [];
    try { products = (await get(`/api/pets/${id}/products`)).items || []; } catch { products = []; }
    formModal({
      title: 'მოვლის დაგეგმვა',
      size: 'lg',
      submit: 'გეგმის შენახვა',
      fields: () => {
        const kindSel = select([{ value: '', label: 'აირჩიე…' }, ...opt(T.kinds)], draft?.kind || '', { name: 'kind' });
        const prodSel = h('select', { class: 'input select', name: 'productId' });
        const fillProducts = () => mount(prodSel, [h('option', { value: '' }, 'პროდუქტის გარეშე'),
          ...products.filter((p) => !p.archivedAt && (!kindSel.value || p.kind === kindSel.value)).map((p) => h('option', { value: p.id, selected: p.id === draft?.productId }, p.name))]);
        fillProducts();
        kindSel.addEventListener('change', fillProducts);
        const recSel = select(opt(T.recurrence), draft?.recurrenceKind || 'ONCE', { name: 'recurrenceKind' });
        const intervalWrap = field('რამდენი', input({ type: 'number', name: 'intervalCount', min: 1, step: 1, value: draft?.intervalCount || 1 }));
        const basisWrap = field('გამეორების საფუძველი', select([{ value: 'FIXED_CALENDAR', label: 'კალენდარული თარიღებით' }, { value: 'FROM_ADMINISTRATION', label: 'დადასტურებული მიღებიდან' }], 'FIXED_CALENDAR', { name: 'recurrenceBasis' }));
        const timeWrap = field('საათი (სურვილისამებრ)', input({ type: 'time', name: 'dueTime', value: draft?.dueTime || '' }));
        const timesWrap = field('დროები', input({ name: 'times', value: '08:00,20:00', placeholder: '08:00,20:00' }), 'მძიმით გამოყავი, მაგალითად 08:00,20:00');
        const endWrap = field('კურსის დასასრული', input({ type: 'date', name: 'courseEndsOn' }));
        const limitWrap = field('გამეორებების ლიმიტი', input({ type: 'number', name: 'occurrenceLimit', min: 1, step: 1 }));
        const sync = () => {
          const r = recSel.value;
          intervalWrap.hidden = r === 'ONCE' || r === 'DAILY_COURSE';
          basisWrap.hidden = r === 'ONCE' || r === 'DAILY_COURSE';
          timeWrap.hidden = r === 'DAILY_COURSE';
          timesWrap.hidden = r !== 'DAILY_COURSE';
          endWrap.hidden = r === 'ONCE';
          limitWrap.hidden = r === 'ONCE';
        };
        recSel.addEventListener('change', sync); sync();
        return h('div', { class: 'stack' },
          draft ? h('div', { class: 'disclaimer', style: { marginTop: 0 } }, icon('info', { size: 16 }), 'Medi Vet-ის წინადადება. ჯერ არ არის შენახული — გადაამოწმე და შეინახე მხოლოდ შენი დადასტურებით.') : null,
          h('div', { class: 'form-row' }, field('რა მოვლაა?', kindSel), field('პროდუქტი', prodSel)),
          field('სათაური', input({ name: 'title', maxlength: 120, placeholder: 'მაგ. ცოფის აცრა', value: draft?.title || '' })),
          h('div', { class: 'form-row' },
            field('პირველი თარიღი', input({ type: 'date', name: 'startOn', required: true, value: draft?.startOn || today() })),
            field('გამეორება', recSel)),
          h('div', { class: 'form-row' }, intervalWrap, basisWrap),
          timeWrap, timesWrap,
          h('div', { class: 'form-row' }, endWrap, limitWrap),
          h('div', { class: 'form-row' },
            field('დოზა', input({ name: 'dose', maxlength: 60, value: draft?.dose || '' })),
            field('ერთეული', input({ name: 'doseUnit', maxlength: 40, placeholder: 'მაგ. ტაბლეტი, მლ', value: draft?.doseUnit || '' }))),
          h('div', { class: 'form-row' },
            field('მიღების გზა', select([{ value: '', label: '—' }, ...opt(T.routes)], '', { name: 'route' })),
            field('წყარო', select(opt(T.sources), 'USER_ENTERED', { name: 'source' }))),
          h('p', { class: 'faint', style: { fontSize: '12.5px' } }, `${T.plannedDisclaimer} შეხსენებები MEDICARD აპში ირთვება.`));
      },
      onSubmit: async (v, close) => {
        if (!v.kind) throw new Error('აირჩიე მოვლის ტიპი.');
        if (!v.startOn) throw new Error('პირველი თარიღი: შეიყვანე სრული თარიღი — დღე, თვე, წელი.');
        const r = v.recurrenceKind;
        if (r !== 'ONCE' && v.courseEndsOn && v.courseEndsOn < v.startOn) throw new Error('დასრულება პირველ თარიღზე ადრე ვერ იქნება.');
        const timeOk = (t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t).trim());
        let times = null;
        if (r === 'DAILY_COURSE') {
          times = String(v.times || '').split(',').map((t) => t.trim()).filter(Boolean);
          if (!times.length || times.some((t) => !timeOk(t)) || new Set(times).size !== times.length) throw new Error('ჩაწერე განსხვავებული საათები, მაგალითად 08:00,20:00.');
          if (!v.courseEndsOn && !v.occurrenceLimit) throw new Error('ყოველდღიური კურსისთვის მიუთითე დასრულების თარიღი ან გამეორებების რაოდენობა.');
        } else if (v.dueTime && !timeOk(v.dueTime)) throw new Error('საათი შეიყვანე ფორმატით სს:წწ, მაგალითად 09:00.');
        if (!['ONCE', 'DAILY_COURSE'].includes(r) && (!Number.isInteger(Number(v.intervalCount)) || Number(v.intervalCount) < 1)) throw new Error('ინტერვალი დადებითი მთელი რიცხვი უნდა იყოს.');
        if (r !== 'ONCE' && v.occurrenceLimit && (!Number.isInteger(Number(v.occurrenceLimit)) || Number(v.occurrenceLimit) < 1)) throw new Error('გამეორებების რაოდენობა დადებითი მთელი რიცხვი უნდა იყოს.');
        const product = products.find((p) => p.id === v.productId);
        const body = {
          kind: v.kind,
          title: v.title.trim() || product?.name || T.kinds[v.kind],
          productId: v.productId || null,
          startOn: v.startOn,
          dueTime: r === 'DAILY_COURSE' ? null : v.dueTime || null,
          times: r === 'DAILY_COURSE' ? times : null,
          recurrenceKind: r,
          intervalCount: r === 'ONCE' || r === 'DAILY_COURSE' ? undefined : Number(v.intervalCount),
          recurrenceBasis: r === 'ONCE' ? 'NONE' : r === 'DAILY_COURSE' ? 'FIXED_CALENDAR' : v.recurrenceBasis,
          source: v.source,
          courseEndsOn: r === 'ONCE' ? null : v.courseEndsOn || null,
          occurrenceLimit: r !== 'ONCE' && v.occurrenceLimit ? Number(v.occurrenceLimit) : null,
          dose: nz(v.dose), doseUnit: nz(v.doseUnit), route: v.route || null,
          timezone: tzName(),
          clientRequestId: rid(),
        };
        try { await post(`/api/pets/${id}/schedules`, body); } catch (e) { throw new Error(petErr(e)); }
        close(); toast('გეგმა შენახულია'); after?.();
      },
    });
  }

  async function recordForm(after) {
    let products = [];
    try { products = (await get(`/api/pets/${id}/products`)).items || []; } catch { products = []; }
    formModal({
      title: 'მიღების აღრიცხვა',
      fields: () => h('div', { class: 'stack' },
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'უკვე გაკეთებული აცრა ან მიღება.'),
        h('div', { class: 'form-row' },
          field('რა მოვლაა?', select([{ value: '', label: 'აირჩიე…' }, ...opt(T.kinds)], '', { name: 'kind' })),
          field('პროდუქტი', select([{ value: '', label: 'პროდუქტის გარეშე' }, ...products.filter((p) => !p.archivedAt).map((p) => ({ value: p.id, label: p.name }))], '', { name: 'productId' }))),
        field('სათაური', input({ name: 'title', maxlength: 120 })),
        h('div', { class: 'form-row' },
          field('მიღების თარიღი', input({ type: 'date', name: 'administeredOn', max: today(), required: true, value: today() })),
          field('დრო (თუ იცი)', input({ type: 'time', name: 'administeredTime' }))),
        h('div', { class: 'form-row' },
          field('დოზა', input({ name: 'dose', maxlength: 60 })),
          field('ერთეული', input({ name: 'doseUnit', maxlength: 40, placeholder: 'მაგ. ტაბლეტი, მლ' }))),
        field('მიღების გზა', select([{ value: '', label: '—' }, ...opt(T.routes)], '', { name: 'route' })),
        field('შენიშვნა', textarea({ name: 'notes', maxlength: 1000, rows: 2 }))),
      onSubmit: async (v, close) => {
        if (!v.kind) throw new Error('აირჩიე მოვლის ტიპი.');
        if (!v.administeredOn) throw new Error('მიღების თარიღი');
        if (v.administeredOn > today()) throw new Error('ჩანაწერის თარიღი მომავალში ვერ იქნება.');
        const product = products.find((p) => p.id === v.productId);
        try {
          await post(`/api/pets/${id}/events`, {
            kind: v.kind, title: v.title.trim() || product?.name || T.kinds[v.kind], productId: v.productId || null,
            administeredOn: v.administeredOn, administeredTime: v.administeredTime || null,
            utcOffsetMinutes: v.administeredTime ? utcOffsetMinutes() : null, timezone: v.administeredTime ? tzName() : null,
            dose: nz(v.dose), doseUnit: nz(v.doseUnit), route: v.route || null, notes: nz(v.notes), clientRequestId: rid(),
          });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast('შენახულია'); after?.();
      },
    });
  }

  function productForm(p, after) {
    formModal({
      title: p ? 'პროდუქტის რედაქტირება' : 'პროდუქტის დამატება',
      fields: () => h('div', { class: 'stack' },
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'რას იყენებ — მაგ. ბრუვექტო. ვადა არ ცვლის შემდეგ მიღებას.'),
        h('div', { class: 'form-row' },
          field('რა მოვლაა?', select(opt(T.kinds), p?.kind || 'FLEA_TICK', { name: 'kind' })),
          field('პროდუქტი', input({ name: 'name', required: true, maxlength: 120, placeholder: 'მაგ. ბრუვექტო', value: p?.name || '' }))),
        h('div', { class: 'form-row' },
          field('ფორმა / სიძლიერე', input({ name: 'formulation', maxlength: 120, value: p?.formulation || '' })),
          field('პარტია', input({ name: 'batchId', maxlength: 80, value: p?.batchId || '' }))),
        field('ვადის გასვლის თარიღი', input({ type: 'date', name: 'expiresOn', value: p?.expiresOn ? String(p.expiresOn).slice(0, 10) : '' }), 'ვადა არ განსაზღვრავს შემდეგ მიღებას.'),
        field('შენიშვნა', textarea({ name: 'notes', maxlength: 1000, rows: 2, value: p?.notes || '' }))),
      onSubmit: async (v, close) => {
        if (!v.name.trim()) throw new Error('შეიყვანე სახელი');
        const body = { kind: v.kind, name: v.name.trim(), formulation: nz(v.formulation), batchId: nz(v.batchId), expiresOn: v.expiresOn || null, notes: nz(v.notes) };
        try {
          if (p) await patch(`/api/pets/${id}/products/${p.id}`, body);
          else await post(`/api/pets/${id}/products`, { ...body, clientRequestId: rid() });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast('შენახულია'); after?.();
      },
    });
  }

  function renderCare() {
    const upSlot = h('div', null, skeleton(3));
    const planSlot = h('div', null, skeleton(3));
    const prodSlot = h('div', null, skeleton(2));
    const histSlot = h('div', null, skeleton(3));
    const refresh = () => { drawUpcoming(); drawPlans(); drawHistory(); };
    mount(body, h('div', { class: 'stack', style: { gap: '28px' } },
      h('div', { class: 'hstack pet-care-actions' },
        button('მოვლის დაგეგმვა', { icon: 'calendar', onClick: () => planForm(null, refresh) }),
        button('მიღების აღრიცხვა', { icon: 'check', variant: 'secondary', onClick: () => recordForm(refresh) }),
        button('პროდუქტის დამატება', { icon: 'plus', variant: 'ghost', onClick: () => productForm(null, drawProducts) })),
      h('div', { class: 'grid grid-main pet-grid' },
        h('div', { class: 'stack', style: { gap: '28px' } },
          section('დაგეგმილი მოვლა', upSlot),
          section('მოვლის ისტორია', histSlot)),
        h('div', { class: 'stack', style: { gap: '28px' } },
          section('აქტიური გეგმები', planSlot),
          section('პროდუქტები', prodSlot)))));

    async function drawUpcoming() {
      try {
        const up = await get(`/api/pets/${id}/care/upcoming`);
        const all = [...(up.overdue || []).map((o) => ({ ...o, _state: 'overdue' })), ...(up.due || []).map((o) => ({ ...o, _state: 'due' })), ...(up.upcoming || []).map((o) => ({ ...o, _state: 'upcoming' }))];
        mount(upSlot, h('div', { class: 'card' },
          all.length ? h('div', { class: 'list' }, all.map((o) => occurrenceRow(o, refresh)))
            : empty('მოვლა ჯერ არ არის დამატებული.', 'დააჭირე მოვლის დამატებას — აცრა, რწყილი/ტკიპა, ჭიები ან სხვა რუტინა. ეს დაგეგმილი მოვლაა, არა გარანტირებული დაცვა.'),
          h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), h('span', null, T.plannedDisclaimer, ' შეხსენებები ტელეფონზე მოდის — ',
            h('a', { class: 'link', href: APP_URL, target: '_blank', rel: 'noopener' }, 'MEDICARD აპი'), '.'))));
      } catch (e) { mount(upSlot, errorBox(e, drawUpcoming)); }
    }
    async function drawPlans() {
      try {
        const res = await get(`/api/pets/${id}/schedules`);
        const items = (res.items || []).filter((s) => s.status === 'ACTIVE');
        mount(planSlot, h('div', { class: 'card' }, items.length ? h('div', { class: 'list' }, items.map((s) => h('div', { class: 'row' },
          tile(T.kindIcon[s.kind] || 'heart', T.kindInk[s.kind] || 'teal', 36),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, s.title),
            h('div', { class: 'row-sub' }, [
              s.recurrenceKind === 'ONCE' || s.recurrenceKind === 'DAILY_COURSE' ? T.recurrence[s.recurrenceKind]
                : `ყოველ ${s.intervalCount || 1} ${{ EVERY_N_DAYS: 'დღეში', EVERY_N_WEEKS: 'კვირაში', EVERY_N_MONTHS: 'თვეში' }[s.recurrenceKind] || ''}`,
              s.nextDueOn ? `შემდეგი ${relDay(s.nextDueOn)}${s.nextDueTime ? `, ${s.nextDueTime}` : ''}` : null,
              [s.dose, s.doseUnit].filter(Boolean).join(' ') || null,
              T.sources[s.source],
            ].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' }, iconButton('x', { title: 'გეგმის გაუქმება', onClick: async () => {
            if (!(await confirmDialog({ title: 'გეგმის გაუქმება', body: 'შესრულებული ჩანაწერები დარჩება. მომავალი თარიღები აღარ გამოჩნდება.', confirm: 'გაუქმება', danger: true }))) return;
            try { await post(`/api/pets/${id}/schedules/${s.id}/cancel`); toast('გეგმა გაუქმდა'); refresh(); } catch (e) { toast(petErr(e), 'error'); }
          } })))))
          : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'აქტიური გეგმა ჯერ არ არის.')));
      } catch (e) { mount(planSlot, errorBox(e, drawPlans)); }
    }
    async function drawProducts() {
      try {
        const res = await get(`/api/pets/${id}/products`);
        const items = (res.items || []).filter((p) => !p.archivedAt);
        mount(prodSlot, h('div', { class: 'card' }, items.length ? h('div', { class: 'list' }, items.map((p) => h('div', { class: 'row' },
          tile(T.kindIcon[p.kind] || 'heart', 'neutral', 36),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, p.name),
            h('div', { class: 'row-sub' }, [T.kinds[p.kind], p.formulation, p.expiresOn ? `ვადა ${fmtDate(p.expiresOn, { year: true })}` : null].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' },
            iconButton('edit', { title: 'რედაქტირება', onClick: () => productForm(p, drawProducts) }),
            iconButton('archive', { title: 'არქივში გადატანა', onClick: async () => {
              if (!(await confirmDialog({ title: 'არქივში გადავიტანოთ?', body: 'პროდუქტი არქივშია. ისტორია და გეგმა რჩება.', confirm: 'არქივში' }))) return;
              try { await post(`/api/pets/${id}/products/${p.id}/archive`); toast('არქივშია'); drawProducts(); } catch (e) { toast(petErr(e), 'error'); }
            } })))))
          : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'პროდუქტი ჯერ არ არის დამატებული.')));
      } catch (e) { mount(prodSlot, errorBox(e, drawProducts)); }
    }
    async function drawHistory() {
      try {
        const res = await get(`/api/pets/${id}/events`, { limit: 50 });
        const items = res.items || [];
        mount(histSlot, h('div', { class: 'card' }, items.length ? h('div', { class: 'list' }, items.map((ev) => h('div', { class: `row ${ev.status === 'VOIDED' ? 'pet-voided' : ''}` },
          tile(T.kindIcon[ev.kind] || 'heart', ev.status === 'VOIDED' ? 'neutral' : (T.kindInk[ev.kind] || 'teal'), 36),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, ev.titleSnapshot),
            h('div', { class: 'row-sub' }, [fmtDate(ev.administeredOn, { year: true }), ev.administeredTime, [ev.doseSnapshot, ev.doseUnitSnapshot].filter(Boolean).join(' ') || null,
              ev.productNameSnapshot, ev.status === 'VOIDED' ? 'გაუქმებული ჩანაწერი' : null].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' }, ev.status === 'VOIDED' ? null : iconButton('x', { title: 'ჩანაწერის გაუქმება', onClick: () => voidEvent(ev, refresh) })))))
          : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, 'წარსული მიღება ჯერ არ არის ჩაწერილი.')));
      } catch (e) { mount(histSlot, errorBox(e, drawHistory)); }
    }
    refresh(); drawProducts();
  }

  async function voidEvent(ev, after) {
    if (!(await confirmDialog({ title: 'გავაუქმოთ ჩანაწერი?', body: 'გაუქმება ისტორიაში დარჩება. მომავალი გეგმა ავტომატურად არ გადაითვლება.', confirm: 'ჩანაწერის გაუქმება', danger: true }))) return;
    try {
      await post(`/api/pets/${id}/events/${ev.id}/void`, {});
      toast('ჩანაწერი გაუქმდა'); after?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const ok = await confirmDialog({ title: 'გეგმის განახლება', body: 'ეს მიღება გეგმის შემდეგ თარიღს ცვლის. დაადასტურე, თუ გინდა გეგმის განახლება.', confirm: 'გეგმის განახლება' });
        if (!ok) return;
        try { await post(`/api/pets/${id}/events/${ev.id}/void`, { confirmRecalculate: true }); toast('ჩანაწერი გაუქმდა'); after?.(); } catch (e2) { toast(petErr(e2), 'error'); }
        return;
      }
      toast(petErr(e), 'error');
    }
  }

  /* Medi Vet — its own endpoint and storage (never the human Medi). */
  function renderVet(slot, p) {
    let sessionId;
    let alive2 = true;
    let sending = false;
    let abort = null;
    const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
    const ta = h('textarea', { rows: 1, placeholder: 'კითხვა ცხოველზე…', 'aria-label': 'კითხვა Medi Vet-ს', maxlength: 4000 });
    const sendBtn = h('button', { type: 'button', class: 'btn btn-primary', 'aria-label': 'გაგზავნა' }, icon('send', { size: 18 }));
    const cancelBtn = h('button', { type: 'button', class: 'text-btn pet-cancel', hidden: true }, 'გაუქმება');
    const errEl = h('div', { class: 'form-error', hidden: true });
    const intro = h('div', { class: 'stack pet-vet-intro' },
      h('div', { class: 'card hstack', style: { flexWrap: 'nowrap', alignItems: 'flex-start' } }, tile('stethoscope', 'violet', 42),
        h('div', null, h('div', { class: 'faint', style: { fontSize: '12px', letterSpacing: '.06em' } }, 'MEDI VET · AI'),
          h('b', null, `${p.name} — უკეთ გავიცნოთ.`),
          h('p', { class: 'muted', style: { fontSize: '13.5px', marginTop: '4px' } }, 'შემიძლია აგიხსნა ჩაწერილი მოვლა, დაგეხმარო ვეტერინართან მოსამზადებლად და ზოგადი მოვლის კითხვებზე ვუპასუხო.'),
          h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '6px' } }, T.vetDisclaimer))),
      h('div', { class: 'chips' }, T.vetStarters.map((s) => h('button', { type: 'button', class: 'chip', onClick: () => send(s) }, s))));

    const autosize = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(180, ta.scrollHeight)}px`; };
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
    sendBtn.addEventListener('click', () => send(ta.value));
    cancelBtn.addEventListener('click', () => abort?.abort());

    mount(slot, h('div', { class: 'card pet-chat' },
      h('div', { class: 'pet-chat-head' }, petPhoto(p, 40),
        h('div', { style: { flex: 1, minWidth: 0 } }, h('b', null, 'Medi Vet'), h('div', { class: 'faint', style: { fontSize: '12.5px' } }, p.name)),
        iconButton('info', { title: 'Medi Vet — როგორ მუშაობს', onClick: () => disclosure(true) })),
      h('div', { class: 'chat pet-chat-body' }, log,
        h('div', null, errEl, h('div', { style: { textAlign: 'center' } }, cancelBtn),
          h('div', { class: 'chat-input' }, ta, sendBtn),
          h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '8px', textAlign: 'center' } }, T.vetDisclaimer)))));

    const scrollEnd = () => requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });

    function bubble(msg) {
      if (msg.role === 'user') return h('div', { class: 'bubble me' }, msg.content);
      const content = h('div', { class: 'pet-ai-content' }, msg.content ? markdown(msg.content) : h('span', { class: 'typing' }, h('i'), h('i'), h('i')));
      const b = h('div', { class: 'bubble ai' }, content);
      b._content = content;
      decorate(b, msg);
      return b;
    }
    function decorate(b, msg) {
      b.querySelectorAll('.pet-ai-extra').forEach((x) => x.remove());
      const extra = h('div', { class: 'pet-ai-extra' });
      if (msg.status && msg.status !== 'COMPLETE' && !msg.streaming) {
        extra.appendChild(h('div', { class: 'pet-ai-status' }, msg.status === 'CANCELLED' ? T.vetCancelled : msg.status === 'PARTIAL' ? T.vetPartial : T.vetFailed));
      }
      if (msg.citations?.length) {
        extra.appendChild(h('div', { class: 'pet-ai-sources' }, h('b', null, 'წყაროები'),
          msg.citations.filter((c) => /^https:\/\//.test(c.url || '')).map((c) => h('a', { href: c.url, target: '_blank', rel: 'noopener', class: 'link' }, `${c.title} — ${c.publisher}`))));
      }
      if (msg.draft) {
        const d = msg.draft;
        extra.appendChild(h('div', { class: 'pet-draft' },
          h('b', null, 'მოვლის გეგმის წინადადება'),
          h('div', { class: 'muted', style: { fontSize: '13px' } }, [d.kind ? T.kinds[d.kind] : null, d.title, d.dose, d.doseUnit, d.startOn ? fmtDate(d.startOn, { year: true }) : null].filter(Boolean).join(' · ') || '—'),
          d.incomplete ? h('div', { style: { fontSize: '13px', color: 'var(--warn)' } }, 'არასრული — გამოტოვებული ველები არ შეივსო გამოგონებით.') : null,
          h('div', { class: 'faint', style: { fontSize: '12.5px' } }, 'ჯერ არ არის შენახული. შენახვა მხოლოდ შენი დადასტურების შემდეგ.'),
          button('გეგმის ფორმაში გახსნა', { variant: 'secondary', size: 'sm', onClick: () => planForm(d, () => toast('გეგმა შენახულია')) })));
      }
      if (extra.childNodes.length) b.appendChild(extra);
    }

    async function loadHistory() {
      try {
        const list = await get(`/api/pets/${p.id}/chats`);
        let session = (list.sessions || [])[0];
        if (!session) {
          mount(log, intro);
          return;
        }
        sessionId = session.id;
        const res = await get(`/api/pets/${p.id}/chats/${session.id}/messages`);
        if (!alive2) return;
        const msgs = res.messages || [];
        mount(log, msgs.length ? msgs.map(bubble) : intro);
        scrollEnd();
      } catch (e) {
        mount(log, h('div', { class: 'stack' }, intro, errorBox(e instanceof ApiError && e.status === 503 ? new Error(T.vetUnavailable) : e, loadHistory)));
      }
    }

    function disclosure(force = false) {
      let seen = false;
      try { seen = localStorage.getItem('medicard.web.pets.vetDisclosure.v1') === '1'; } catch { /* ignore */ }
      if (seen && !force) return Promise.resolve(true);
      return new Promise((resolve) => {
        let ok = false;
        openModal({
          title: 'Medi Vet-ის გამოყენება',
          size: 'sm',
          body: h('p', { class: 'muted' }, T.vetDisclosureBody),
          footer: (close) => [button('გასაგებია', { onClick: () => { ok = true; try { localStorage.setItem('medicard.web.pets.vetDisclosure.v1', '1'); } catch { /* ignore */ } close(); } })],
          onClose: () => resolve(ok || seen),
        });
      });
    }

    async function send(text) {
      const message = String(text || '').trim();
      if (message.length < 2 || sending) return;
      if (!(await disclosure())) return;
      sending = true;
      errEl.hidden = true;
      if (log.contains(intro)) clear(log);
      const userMsg = { role: 'user', content: message };
      const aiMsg = { role: 'assistant', content: '', streaming: true, status: 'PARTIAL' };
      log.appendChild(bubble(userMsg));
      const aiBubble = bubble(aiMsg);
      log.appendChild(aiBubble);
      ta.value = ''; autosize();
      sendBtn.disabled = true; cancelBtn.hidden = false;
      scrollEnd();
      const requestId = rid();
      abort = new AbortController();
      let pending = '';
      let timer = null;
      const flush = () => { timer = null; if (!pending) return; aiMsg.content += pending; pending = ''; mount(aiBubble._content, markdown(aiMsg.content)); scrollEnd(); };
      try {
        const result = await withAiConsent(async () => {
          let final = null;
          let failed = null;
          await stream(`/api/pets/${p.id}/chat/query`, { message, sessionId, clientRequestId: requestId, stream: true }, (type, data) => {
            const d = typeof data === 'object' && data ? data : {};
            if (type === 'done' || d.type === 'done') { final = d; return; }
            if (d.type === 'delta' && typeof d.text === 'string') { pending += d.text; if (!timer) timer = setTimeout(flush, 40); return; }
            if (d.type === 'error') failed = d;
          }, { signal: abort.signal });
          if (failed) throw new ApiError(failed.error || T.vetFailed, failed.status || 502, failed);
          return final;
        });
        if (timer) clearTimeout(timer);
        flush();
        if (result?.declined) {
          aiBubble.remove();
          ta.value = message; autosize();
          errEl.textContent = 'Medi Vet-ისთვის საჭიროა თანხმობა მონაცემების AI-სთან გაზიარებაზე.';
          errEl.hidden = false;
          return;
        }
        if (result?.sessionId) sessionId = result.sessionId;
        aiMsg.streaming = false;
        aiMsg.content = result?.answer || aiMsg.content;
        aiMsg.status = result?.status === 'COMPLETE' ? 'COMPLETE' : result ? 'PARTIAL' : aiMsg.content ? 'PARTIAL' : 'FAILED';
        aiMsg.citations = result?.citations || [];
        aiMsg.draft = result?.draft || null;
        mount(aiBubble._content, aiMsg.content ? markdown(aiMsg.content) : '');
        decorate(aiBubble, aiMsg);
      } catch (e) {
        if (timer) clearTimeout(timer);
        flush();
        const cancelled = e?.name === 'AbortError' || e?.code === 'CANCELLED' || e?.status === 499;
        aiMsg.streaming = false;
        aiMsg.status = cancelled ? 'CANCELLED' : aiMsg.content ? 'PARTIAL' : 'FAILED';
        if (!aiMsg.content) mount(aiBubble._content, '');
        decorate(aiBubble, aiMsg);
        errEl.textContent = cancelled ? T.vetCancelled : (e instanceof ApiError && e.status === 503 ? T.vetUnavailable : e?.message || T.vetFailed);
        errEl.hidden = false;
      } finally {
        sending = false; abort = null;
        sendBtn.disabled = false; cancelBtn.hidden = true;
        scrollEnd();
      }
    }

    mount(log, h('div', { class: 'faint', style: { padding: '12px' } }, 'ისტორია იტვირთება…'));
    loadHistory();
    return () => { alive2 = false; abort?.abort(); };
  }

  try {
    await loadPet();
    renderTab();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      mount(head, h('div', { class: 'card' }, empty('ცხოველი ვერ მოიძებნა', 'შესაძლოა არქივში გადავიდა.', button('ჩემი ცხოველები', { href: '/pets' }))));
      tabs.hidden = true;
    } else {
      mount(head, errorBox(e, () => petDetail(root, ctx)));
    }
  }
  return () => { alive = false; if (typeof chatCleanup === 'function') chatCleanup(); };
}
