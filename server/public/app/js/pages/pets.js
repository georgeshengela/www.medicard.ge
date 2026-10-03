// MEDICARD web — ჩემი ცხოველები (/pets, /pets/:id). Replicates mobile/app/pets/** on the same /api/pets endpoints.
// Product freeze: bug-fix scope only — nothing here that the app does not already do.
// Isolation: pet data never touches human health records; MEDIVET uses its own endpoint and storage.
import {
  h, mount, clear, icon, tile, section, button, iconButton, badge, empty, skeleton, errorBox, segmented,
  toast, openModal, confirmDialog, formModal, field, input, textarea, select, fmtDate, fmtNum, ymd, markdown, relDay,
} from '../ui.js';
import { get, post, patch, del, request, stream, authedBlobUrl, ApiError, invalidate } from '../api.js';
import { lineChart, sparkline } from '../charts.js';
import { withAiConsent } from '../aiConsent.js';
import { featureOn } from '../session.js';
import { t, isEn, plural } from '../i18n.js';

const CSS = '/app/css/pets.css';
function ensureCss() {
  if (!document.querySelector(`link[href="${CSS}"]`)) document.head.append(h('link', { rel: 'stylesheet', href: CSS }));
}

/* ── Copy (mobile/src/i18n/ka.ts `pets`) ─────────── */
const T = {
  sexMale: t('მამრი', 'Male'), sexFemale: t('მდედრი', 'Female'), sexUnknown: t('სქესი უცნობია', 'Sex unknown'),
  ageUnknown: t('ასაკი უცნობია', 'Age unknown'),
  unitKg: t('კგ', 'kg'), unitG: t('გ', 'g'), unitLb: t('ფუნტი', 'lb'),
  kinds: { VACCINATION: t('აცრა', 'Vaccination'), FLEA_TICK: t('რწყილი / ტკიპა', 'Flea / tick'), DEWORMING: t('ჭიების საწინააღმდეგო', 'Deworming'), MEDICATION: t('დანიშნული მედიკამენტი', 'Prescribed medication'), OTHER: t('სხვა მოვლა', 'Other care') },
  kindIcon: { VACCINATION: 'syringe', FLEA_TICK: 'bug', DEWORMING: 'pill', MEDICATION: 'pill', OTHER: 'heart' },
  kindInk: { VACCINATION: 'blue', FLEA_TICK: 'amber', DEWORMING: 'violet', MEDICATION: 'rose', OTHER: 'teal' },
  routes: { oral: t('პერორალური', 'Oral'), topical: t('გარეგანი', 'Topical'), injection: t('ინექცია', 'Injection'), other: t('სხვა', 'Other'), unknown: t('უცნობი', 'Unknown') },
  recurrence: { ONCE: t('ერთჯერადი', 'One time'), EVERY_N_DAYS: t('ყოველ N დღეში', 'Every N days'), EVERY_N_WEEKS: t('ყოველ N კვირაში', 'Every N weeks'), EVERY_N_MONTHS: t('ყოველ N თვეში', 'Every N months'), DAILY_COURSE: t('ყოველდღიური კურსი', 'Daily course') },
  sources: { VETERINARIAN: t('ვეტერინარი', 'Vet'), PRODUCT_INSTRUCTIONS: t('პროდუქტის ინსტრუქცია', 'Product instructions'), USER_ENTERED: t('ჩემი ჩანაწერი', 'My own entry') },
  allergyCats: { medication: t('მედიკამენტი', 'Medication'), food: t('საკვები', 'Food'), environmental: t('გარემო', 'Environmental'), other: t('სხვა', 'Other'), unknown: t('უცნობი', 'Unknown') },
  allergyStatus: { suspected: t('მფლობელის დაკვირვება (სავარაუდო)', 'Owner’s observation (suspected)'), veterinarian_confirmed: t('ვეტერინარის დადასტურებული', 'Confirmed by a vet') },
  condStatus: { active: t('აქტიური', 'Active'), resolved: t('დასრულებული', 'Resolved'), unknown: t('უცნობი', 'Unknown') },
  condBasis: { owner_reported: t('მფლობელის ჩანაწერი', 'Owner’s entry'), veterinarian_confirmed: t('ვეტერინარის დადასტურებული', 'Confirmed by a vet') },
  plannedDisclaimer: t('ეს დაგეგმილი მოვლაა, არა გარანტირებული დაცვა ან სამედიცინო რეკომენდაცია.', 'This is planned care, not guaranteed protection or medical advice.'),
  vetDisclaimer: t('ეს არ არის ვეტერინარული დიაგნოზი — საჭიროების შემთხვევაში მიმართე ვეტერინარს.', 'This is not a veterinary diagnosis — see a vet when needed.'),
  vetDisclosureBody: t('შესაბამისი ცხოველის ჩანაწერი და შენი შეტყობინებები იგზავნება AI პროვაიდერთან (OpenRouter). ეს არ არის ვეტერინარული დიაგნოზი.', 'The relevant pet’s record and your messages are sent to an AI provider (OpenRouter). This is not a veterinary diagnosis.'),
  vetStarters: t(['მოვლის ისტორიის შეჯამება', 'ვეტერინართან ვიზიტისთვის მომზადება', 'კითხვა ცხოველის მოვლაზე'], ['Summarize the care history', 'Prepare for a vet visit', 'Ask about pet care']),
  vetFailed: t('პასუხი ვერ მოვიდა. სცადე თავიდან.', 'The answer didn’t arrive. Try again.'), vetCancelled: t('მოთხოვნა გაუქმდა.', 'Request cancelled.'), vetPartial: t('პასუხი არ დასრულებულა.', 'The answer didn’t finish.'),
  vetUnavailable: t('MEDIVET ჯერ მზად არ არის ამ სერვერზე.', 'MEDIVET isn’t ready on this server yet.'),
  saveError: t('შენახვა ვერ მოხერხდა. შეავსებული ველები შენარჩუნებულია.', 'Couldn’t save. The fields you filled in are kept.'),
  notReady: t('ცხოველების მოდული ჯერ მზად არ არის.', 'The pets module isn’t ready yet.'),
  futureDate: t('ჩანაწერის თარიღი მომავალში ვერ იქნება.', 'The date can’t be in the future.'),
  saved: t('შენახულია', 'Saved'),
  edit: t('რედაქტირება', 'Edit'),
  del: t('წაშლა', 'Delete'),
  archive: t('არქივში გადატანა', 'Move to archive'),
  note: t('შენიშვნა', 'Note'),
  optional: t('არასავალდებულო', 'Optional'),
  enterName: t('შეიყვანე სახელი', 'Enter a name'),
  pickKind: t('აირჩიე მოვლის ტიპი.', 'Choose the type of care.'),
  dateGiven: t('მიღების თარიღი', 'Date given'),
  conflict: t('გეგმა შეიცვალა. განაახლე სია და სცადე ხელახლა.', 'The plan changed. Refresh the list and try again.'),
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
  if (pet.breedId === 'custom') return pet.customBreed || t('მითითებული ჯიში', 'Custom breed');
  if (pet.breedId === 'mixed') return t('შერეული ჯიში', 'Mixed breed');
  return speciesOf(pet.speciesId)?.breeds?.find((b) => b.id === pet.breedId)?.label || t('ჯიში უცნობია', 'Breed unknown');
}
function ageLabel(age) {
  if (!age || age.kind === 'UNKNOWN' || (age.years == null && age.months == null)) return T.ageUnknown;
  const y = age.years ?? 0, m = age.months ?? 0;
  if (y <= 0 && m <= 0) return T.ageUnknown;
  const approx = age.kind === 'APPROXIMATE' ? '≈ ' : '';
  if (y <= 0) return t(`${approx}${m} თვე`, `${approx}${plural(m, 'month')}`);
  if (m <= 0) return t(`${approx}${y} წელი`, `${approx}${plural(y, 'year')}`);
  return t(`${approx}${y} წ. ${m} თვე`, `${approx}${y} y ${m} mo`);
}
/** English "Every 2 weeks" for EVERY_N_* plans (mobile pets.everyN). */
function everyN(n, kind) {
  const unit = { EVERY_N_DAYS: ['day', 'days'], EVERY_N_WEEKS: ['week', 'weeks'], EVERY_N_MONTHS: ['month', 'months'] }[kind];
  if (!unit) return `Every ${n}`;
  return n === 1 ? `Every ${unit[0]}` : `Every ${n} ${unit[1]}`;
}
const sexLabel = (s) => (s === 'MALE' ? T.sexMale : s === 'FEMALE' ? T.sexFemale : T.sexUnknown);
const weightLabel = (log) => (log.inputUnit === 'g' ? `${fmtNum(log.inputValue)} ${T.unitG}` : log.inputUnit === 'lb' ? `${fmtNum(log.inputValue, 2)} ${T.unitLb}` : `${fmtNum(log.inputValue, 2)} ${T.unitKg}`);

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
  if (e instanceof ApiError && e.status === 503) return T.notReady;
  return e?.message || T.saveError;
}

/* ── Photo: downscale large pictures before upload (the app does the same on device). ── */
async function preparePhoto(file) {
  if (!file) return null;
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) throw new Error(t('ატვირთე JPEG, PNG ან WEBP ფოტო.', 'Upload a JPEG, PNG or WEBP photo.'));
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
  const customWrap = field(t('ჩაწერე ჯიში', 'Type the breed'), input({ name: 'customBreed', maxlength: 80, value: cur.customBreed || '' }));
  const fillBreeds = (sid, value) => {
    const sp = speciesOf(sid);
    const opts = [{ id: 'unknown', label: t('არ ვიცი', 'Unknown') }, ...(sp?.allowsMixed ? [{ id: 'mixed', label: t('შერეული ჯიში', 'Mixed breed') }] : []), { id: 'custom', label: t('თავად ჩავწერ', 'Other — I’ll type it') },
      ...(sp?.breeds || []).filter((b) => !['unknown', 'mixed', 'custom'].includes(b.id))];
    mount(breedSel, opts.map((b) => h('option', { value: b.id, selected: b.id === value }, b.label)));
    if (!opts.some((b) => b.id === value)) breedSel.value = 'unknown';
    customWrap.hidden = breedSel.value !== 'custom';
  };
  fillBreeds(cur.speciesId, cur.breedId);
  speciesSel.addEventListener('change', () => fillBreeds(speciesSel.value, 'unknown'));
  breedSel.addEventListener('change', () => { customWrap.hidden = breedSel.value !== 'custom'; });

  const ageSel = select([{ value: 'EXACT', label: t('ვიცი თარიღი', 'Exact date') }, { value: 'APPROXIMATE', label: t('დაახლოებით', 'Approximate') }, { value: 'UNKNOWN', label: t('არ ვიცი', 'Unknown') }], cur.ageKind, { name: 'ageKind' });
  const exactWrap = field(t('დაბადების თარიღი', 'Date of birth'), input({ type: 'date', name: 'birthDate', max: today(), value: cur.birthDate ? String(cur.birthDate).slice(0, 10) : '' }));
  const approxWrap = h('div', { class: 'stack', style: { gap: '6px' } },
    h('div', { class: 'form-row' },
      field(t('წელი', 'Years'), input({ type: 'number', name: 'approxYears', min: 0, max: 80, step: 1, placeholder: '0', value: cur.approxAgeYears ?? '' })),
      field(t('თვე', 'Months'), input({ type: 'number', name: 'approxMonths', min: 0, max: 11, step: 1, placeholder: '0–11', value: cur.approxAgeMonths ?? '' }))),
    h('span', { class: 'field-hint' }, cur.approxAgeRecordedOn ? t(`ეს შეფასება ჩაიწერა ${String(cur.approxAgeRecordedOn).slice(0, 10)}-ს. შეცვლისას მიუთითე დღევანდელი ასაკი.`, `This estimate was saved on ${fmtDate(cur.approxAgeRecordedOn, { year: true })}. If you change it, enter the age as of today.`) : t('მიუთითე დღევანდელი სავარაუდო ასაკი.', 'Enter the approximate age as of today.')));
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
    title: pet ? t(`${pet.name} — რედაქტირება`, `${pet.name} — edit`) : t('ცხოველის დამატება', 'Add a pet'),
    size: 'lg',
    submit: pet ? t('შენახვა', 'Save') : t('დამატება', 'Add'),
    fields: () => h('div', { class: 'stack', style: { gap: '16px' } },
      h('div', { class: 'pet-form-head' }, preview,
        h('div', { class: 'stack', style: { gap: '6px' } },
          h('b', null, pet ? t('მისი ამბავი, განახლებული.', 'Their story, up to date.') : t('გავიცნოთ შენი მეგობარი', 'Let’s meet your friend')),
          h('span', { class: 'faint', style: { fontSize: '13px' } }, t('ფოტო სურვილისამებრ. შეცვლა ყოველთვის შეგიძლია.', 'A photo is optional. You can always change it.')),
          h('label', { class: 'btn btn-ghost btn-sm pet-file-btn' }, icon('upload', { size: 16 }), h('span', null, t('ფოტოს არჩევა', 'Choose photo')), fileInput),
          pet?.photoUrl ? h('label', { class: 'hstack faint', style: { fontSize: '13px', gap: '6px' } }, removePhoto, t('ფოტოს წაშლა', 'Remove photo')) : null)),
      field(t('რა ჰქვია? *', 'Name *'), input({ name: 'name', required: true, maxlength: 40, placeholder: t('მაგალითად, ლუნა', 'e.g. Max'), value: cur.name || '', autocomplete: 'off' })),
      h('div', { class: 'form-row' }, field(t('სახეობა *', 'Species *'), speciesSel), field(t('ჯიში', 'Breed'), breedSel)),
      customWrap,
      h('div', { class: 'form-row' },
        field(t('სქესი', 'Sex'), select([{ value: 'MALE', label: T.sexMale }, { value: 'FEMALE', label: T.sexFemale }, { value: 'UNKNOWN', label: t('არ ვიცი', 'Unknown') }], cur.sex, { name: 'sex' })),
        field(t('სტერილიზაცია / კასტრაცია', 'Spayed / neutered'), select([{ value: 'true', label: t('კი', 'Yes') }, { value: 'false', label: t('არა', 'No') }, { value: '', label: t('არ ვიცი', 'Unknown') }], cur.neutered == null ? '' : String(cur.neutered), { name: 'neutered' }))),
      field(t('ასაკი', 'Age'), ageSel),
      exactWrap, approxWrap,
      h('details', { class: 'pet-details', open: vetOpen },
        h('summary', null, tile('stethoscope', 'teal', 34), h('span', null, h('b', null, t('ვეტერინარის კონტაქტი', 'Vet contact')), h('small', null, t('სურვილისამებრ · ყველაფერი ერთ ადგილას', 'Optional · everything in one place'))), icon('chevronDown', { size: 16 })),
        h('div', { class: 'stack', style: { gap: '12px', marginTop: '12px' } },
          h('div', { class: 'form-row' },
            field(t('კლინიკა', 'Clinic'), input({ name: 'vetClinicName', maxlength: 160, value: cur.vetClinicName || '' })),
            field(t('ვეტერინარის სახელი', 'Vet’s name'), input({ name: 'vetName', maxlength: 80, value: cur.vetName || '' }))),
          h('div', { class: 'form-row' },
            field(t('ტელეფონი', 'Phone'), input({ name: 'vetPhone', type: 'tel', maxlength: 40, value: cur.vetPhone || '' })),
            field(t('მისამართი', 'Address'), input({ name: 'vetAddress', maxlength: 300, value: cur.vetAddress || '' }))),
          field(T.note, textarea({ name: 'vetNotes', maxlength: 500, rows: 2, value: cur.vetNotes || '' })))),
      h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('* მხოლოდ სახელი და სახეობაა აუცილებელი. ცხოველის ჩანაწერები შენს ჯანმრთელობის მონაცემებს არ ერევა.', '* Only the name and species are required. Pet records never mix with your own health data.'))),
    onSubmit: async (v, close) => {
      const name = v.name.trim();
      if (!name) throw new Error(t('ჯერ შენი ცხოველის სახელი ჩაწერე.', 'Enter your pet’s name first.'));
      if (!speciesOf(v.speciesId) && species.length) throw new Error(t('აირჩიე ცხოველის სახეობა.', 'Choose a species.'));
      if (v.breedId === 'custom' && !String(v.customBreed || '').trim()) throw new Error(t('ჩაწერე ჯიში ან აირჩიე „არ ვიცი“.', 'Type the breed or choose “Unknown”.'));
      const body = {
        name, speciesId: v.speciesId, breedId: v.breedId || 'unknown', customBreed: v.breedId === 'custom' ? v.customBreed.trim() : null,
        sex: v.sex, neutered: v.neutered === '' ? null : v.neutered === 'true',
        ageKind: v.ageKind, birthDate: null, approxAgeYears: null, approxAgeMonths: null, approxAgeRecordedOn: null,
        vetClinicName: nz(v.vetClinicName), vetName: nz(v.vetName), vetPhone: nz(v.vetPhone), vetAddress: nz(v.vetAddress), vetNotes: nz(v.vetNotes),
      };
      if (v.ageKind === 'EXACT') {
        if (!v.birthDate) throw new Error(t('შეიყვანე სრული თარიღი — დღე, თვე, წელი.', 'Enter the full date — day, month and year.'));
        if (v.birthDate > today()) throw new Error(T.futureDate);
        const oldest = new Date(); oldest.setFullYear(oldest.getFullYear() - 80);
        if (v.birthDate < ymd(oldest)) throw new Error(t('შეამოწმე დაბადების წელი — ასაკი 80 წელს არ უნდა აღემატებოდეს.', 'Check the birth year — the age can’t be more than 80 years.'));
        body.birthDate = v.birthDate;
      } else if (v.ageKind === 'APPROXIMATE') {
        const y = v.approxYears === '' ? 0 : Number(v.approxYears), m = v.approxMonths === '' ? 0 : Number(v.approxMonths);
        if (!Number.isInteger(y) || y < 0 || y > 80) throw new Error(t('წლები უნდა იყოს 0–80.', 'Years must be 0–80.'));
        if (!Number.isInteger(m) || m < 0 || m > 11) throw new Error(t('თვეები უნდა იყოს 0–11.', 'Months must be 0–11.'));
        if (y + m === 0) throw new Error(t('მიუთითე ასაკი ან აირჩიე „არ ვიცი“.', 'Enter an age or choose “Unknown”.'));
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
        toast(t(`პროფილი შეინახა, ფოტო — ვერა: ${e?.message || ''}`, `Profile saved, but the photo wasn’t: ${e?.message || ''}`).trim(), 'error');
      }
      invalidate('/api/pets');
      close();
      toast(pet ? T.saved : t(`${saved.name} დაემატა`, `${saved.name} added`));
      onSaved?.(saved);
    },
  });
}

async function archivePet(pet, after) {
  const ok = await confirmDialog({ title: t('არქივში გადავიტანოთ?', 'Move to archive?'), body: t('არქივში გადატანის შემდეგ სიაში აღარ გამოჩნდება. ჩანაწერი არ წაიშლება.', 'Once archived, it won’t appear in the list. The record won’t be deleted.'), confirm: t('არქივში', 'Archive'), danger: true });
  if (!ok) return;
  try {
    await post(`/api/pets/${pet.id}/archive`);
    invalidate('/api/pets');
    toast(t(`${pet.name} არქივშია`, `${pet.name} is archived`));
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
  const addBtn = button(t('ცხოველის დამატება', 'Add a pet'), { icon: 'plus', onClick: () => petForm(null, (p) => ctx.navigate(`/pets/${p.id}`)) });
  mount(root,
    h('header', { class: 'page-head' },
      h('div', { class: 'page-head-text' }, h('h1', null, t('ჩემი ცხოველები', 'My pets')), h('p', null, t('მეტი ზრუნვა, ნაკლები დავიწყება. შენი ცხოველების ამბები და ყოველდღიური მოვლა ერთ სივრცეში.', 'More care, less forgetting. Your pets’ stories and everyday care in one place.'))),
      h('div', { class: 'page-head-actions' }, addBtn)),
    grid,
    h('div', { class: 'grid grid-main pets-lower' },
      section(t('ვეტკლინიკები', 'Vet clinics'), clinicsCard()),
      section(t('როგორ დავიწყო?', 'How do I start?'), h('div', { class: 'card stack pets-steps' }, [
        [t('01 · შექმენი პროფილი', '01 · Create a profile'), t('თითოეულ ცხოველს თავისი ჩანაწერები და ისტორია აქვს.', 'Each pet has its own records and history.')],
        [t('02 · შეინახე და დაგეგმე', '02 · Save and plan'), t('უკვე ჩატარებული პროცედურა ჩაწერე ისტორიაში, მომავალი კი მოვლის გეგმაში.', 'Log what’s already done in the history, and plan what’s next in the care plan.')],
        [t('03 · ჰკითხე MEDIVET-ს', '03 · Ask MEDIVET'), t('შენახულ ჩანაწერებზე დაყრდნობით მოვლის კითხვებს გიპასუხებს. ეს არ არის დიაგნოზი.', 'It answers care questions based on your saved records. This is not a diagnosis.')],
      ].map(([title, b]) => h('div', null, h('b', null, title), h('p', { class: 'muted', style: { fontSize: '13.5px', marginTop: '2px' } }, b)))))));

  const draw = async () => {
    try {
      await loadCatalog();
      const res = await get('/api/pets');
      pets = res?.pets || [];
      addBtn.hidden = pets.length >= 20;
      if (!pets.length) {
        mount(grid, h('div', { class: 'card pad-lg' }, empty(t('პირველი ნაბიჯი — გაცნობა.', 'First step — introductions.'), t('დაიწყე სახელითა და სახეობით. ფოტო, ასაკი და სხვა დეტალები მოგვიანებითაც შეგიძლია დაამატო.', 'Start with a name and species. You can add a photo, age and other details later.'),
          button(t('ცხოველის დამატება', 'Add a pet'), { icon: 'plus', onClick: () => petForm(null, (p) => ctx.navigate(`/pets/${p.id}`)) }))));
        return;
      }
      mount(grid, section(t(`ჩემი ცხოველები · ${pets.length}`, `My pets · ${pets.length}`), h('div', { class: 'grid pets-grid' }, pets.map((p) => petCard(p)))));
    } catch (e) {
      mount(grid, errorBox(e instanceof ApiError && e.status === 503 ? new Error(T.notReady) : e, draw));
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
          iconButton('edit', { title: T.edit, onClick: (e) => { e.preventDefault(); e.stopPropagation(); petForm(p, draw); } }),
          iconButton('archive', { title: T.archive, onClick: (e) => { e.preventDefault(); e.stopPropagation(); archivePet(p, draw); } }))),
      h('div', { class: 'pet-card-links' },
        h('a', { href: `/pets/${p.id}?tab=care`, 'data-link': '', class: 'chip' }, icon('calendarCheck', { size: 14 }), t('მოვლა', 'Care')),
        h('a', { href: `/pets/${p.id}?tab=health`, 'data-link': '', class: 'chip' }, icon('scale', { size: 14 }), t('წონა', 'Weight')),
        featureOn('mediVet') ? h('a', { href: `/pets/${p.id}?tab=vet`, 'data-link': '', class: 'chip' }, icon('stethoscope', { size: 14 }), 'MEDIVET') : null));
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
            h('div', { class: 'row-sub' }, [c.location, c.hoursKnown ? null : t('საათი უცნობია', 'Hours unknown')].filter(Boolean).join(' · ') || '—')),
          h('div', { class: 'row-trail' },
            c.openNow === true ? badge(t('ღიაა', 'Open'), 'ok') : c.openNow === false ? badge(t('დაკეტილია', 'Closed'), 'neutral') : null,
            c.phones?.[0] ? h('a', { class: 'icon-btn', href: `tel:${c.phones[0].tel}`, title: t(`დარეკვა · ${c.phones[0].display}`, `Call · ${c.phones[0].display}`), 'aria-label': t(`დარეკვა ${c.phones[0].display}`, `Call ${c.phones[0].display}`) }, icon('phone', { size: 18 })) : null)))
          : h('p', { class: 'muted', style: { padding: '12px 4px' } }, t('კლინიკები ამ ფილტრში არ ჩანს.', 'No clinics match this filter.')),
        !expanded && rows.length > shown.length ? h('div', { style: { textAlign: 'center', paddingTop: '6px' } },
          button(t(`ყველას ნახვა · ${rows.length}`, `See all · ${rows.length}`), { variant: 'ghost', size: 'sm', onClick: () => { expanded = true; draw(); } })) : null);
      };
      const search = input({ type: 'search', placeholder: t('კლინიკის ძებნა', 'Search clinics'), 'aria-label': t('კლინიკის ძებნა', 'Search clinics') });
      search.addEventListener('input', () => { query = search.value; draw(); });
      draw();
      mount(slot,
        h('div', { class: 'pet-clinic-tools' }, search,
          segmented([{ value: 'all', label: t('ყველა', 'All') }, { value: 'open', label: t('ღია ახლა', 'Open now') }], 'all', (v) => { onlyOpen = v === 'open'; draw(); })),
        dir?.stale ? h('p', { class: 'faint', style: { fontSize: '12.5px', margin: '8px 0' } }, t('ბოლო შენახული სია — დირექტორია ახლა მიუწვდომელია.', 'Last saved list — the directory is unavailable right now.')) : null,
        list,
        h('p', { class: 'faint', style: { fontSize: '12px', marginTop: '8px' } }, dir?.source?.url
          ? h('a', { href: dir.source.url, target: '_blank', rel: 'noopener', class: 'link' }, `${t('წყარო', 'Source')}: ${dir.source.name || 'Dogdog.ge'}`, icon('externalLink', { size: 12 }))
          : t('წყარო: Dogdog.ge', 'Source: Dogdog.ge')));
    } catch (e) {
      mount(slot, h('p', { class: 'muted' }, t('კლინიკების სია ვერ ჩაიტვირთა.', 'We couldn’t load the clinic list.')));
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
  const tabItems = [{ value: 'overview', label: t('მიმოხილვა', 'Overview') }, { value: 'health', label: t('ჯანმრთელობა', 'Health') }, { value: 'care', label: t('მოვლა', 'Care') }];
  if (featureOn('mediVet')) tabItems.push({ value: 'vet', label: 'MEDIVET' });
  const tabs = segmented(tabItems, tab, (v) => { tab = v; syncUrl(); renderTab(); });
  tabs.classList.add('pet-tabs');
  let chatCleanup = null;
  const syncUrl = () => {
    const u = new URL(location.href);
    if (tab === 'overview') u.searchParams.delete('tab'); else u.searchParams.set('tab', tab);
    history.replaceState(history.state, '', u.pathname + u.search);
  };
  const selectTab = (v) => {
    const i = tabItems.findIndex((ti) => ti.value === v);
    tabs.querySelectorAll('button')[i]?.click();
  };

  mount(root, h('a', { class: 'back', href: '/pets', 'data-link': '' }, icon('chevronLeft', { size: 16 }), t('ჩემი ცხოველები', 'My pets')), head, tabs, body);

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
      { label: t('დაამატე ფოტო', 'Add a photo'), done: Boolean(pet.photoUrl) },
      { label: t('მიუთითე ასაკი, თუ იცი', 'Add the age, if you know it'), done: pet.ageKind !== 'UNKNOWN' },
      { label: t('შეინახე ვეტერინარის კონტაქტი', 'Save your vet’s contact'), done: Boolean(pet.vetPhone || pet.vetName || pet.vetClinicName) },
    ];
    mount(head, h('div', { class: 'pet-hero' },
      petPhoto(pet, 88),
      h('div', { class: 'pet-hero-main' },
        h('h1', null, pet.name),
        h('div', { class: 'muted' }, [sp?.labelKa, breedLabel(pet), sexLabel(pet.sex), ageLabel(pet.age)].filter(Boolean).join(' · ')),
        setup.some((s) => !s.done) ? h('div', { class: 'chips', style: { marginTop: '10px' } }, setup.filter((s) => !s.done).map((s) =>
          h('button', { type: 'button', class: 'chip', onClick: () => petForm(pet, (p) => { pet = p; drawHead(); renderTab(); }) }, icon('plus', { size: 14 }), s.label))) : null),
      h('div', { class: 'page-head-actions' },
        featureOn('mediVet') ? button('MEDIVET', { icon: 'stethoscope', variant: 'secondary', onClick: () => selectTab('vet') }) : null,
        button(T.edit, { icon: 'edit', variant: 'ghost', onClick: () => petForm(pet, (p) => { pet = p; drawHead(); renderTab(); }) }),
        iconButton('archive', { title: T.archive, onClick: () => archivePet(pet, () => ctx.navigate('/pets')) }))));
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
      [t('სახეობა', 'Species'), sp?.labelKa || '—'], [t('ჯიში', 'Breed'), breedLabel(pet)], [t('სქესი', 'Sex'), sexLabel(pet.sex)],
      [t('სტერილიზაცია / კასტრაცია', 'Spayed / neutered'), pet.neutered == null ? t('უცნობია', 'Unknown') : pet.neutered ? t('კი', 'Yes') : t('არა', 'No')],
      [t('ასაკი', 'Age'), ageLabel(pet.age)],
      pet.birthDate ? [t('დაბადების თარიღი', 'Date of birth'), fmtDate(pet.birthDate, { year: true })] : null,
    ].filter(Boolean);
    const PHONE = t('ტელეფონი', 'Phone');
    const vet = [[t('კლინიკა', 'Clinic'), pet.vetClinicName], [t('ვეტერინარი', 'Vet'), pet.vetName], [PHONE, pet.vetPhone], [t('მისამართი', 'Address'), pet.vetAddress], [T.note, pet.vetNotes]].filter(([, v]) => v);
    mount(body, h('div', { class: 'grid grid-main pet-grid' },
      h('div', { class: 'stack', style: { gap: '28px' } },
        section(t('წონა', 'Weight'), weightSlot, { action: h('button', { type: 'button', class: 'link text-btn', onClick: () => selectTab('health') }, t('ისტორია', 'History'), icon('chevronRight', { size: 16 })) }),
        section(t('პროფილი', 'Profile'), h('div', { class: 'card' },
          h('dl', { class: 'pet-dl' }, rows.map(([k, v]) => [h('dt', null, k), h('dd', null, v)])),
          h('div', { class: 'pet-vet' },
            h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('ვეტერინარი', 'Vet')),
            vet.length ? h('dl', { class: 'pet-dl' }, vet.map(([k, v]) => [h('dt', null, k), h('dd', null, k === PHONE ? h('a', { class: 'link', href: `tel:${String(v).replace(/[^\d+]/g, '')}` }, v) : v)]))
              : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('ვეტერინარის კონტაქტი ჯერ არ არის შენახული.', 'No vet contact saved yet.')))))),
      h('div', { class: 'stack', style: { gap: '28px' } },
        section(t('მოვლის კალენდარი', 'Care calendar'), careSlot, { action: h('button', { type: 'button', class: 'link text-btn', onClick: () => selectTab('care') }, t('ყველა', 'All'), icon('chevronRight', { size: 16 })) }),
        section(t('ჯანმრთელობა', 'Health'), healthSlot),
        featureOn('mediVet') ? section('MEDIVET', h('div', { class: 'card feature' },
          tile('stethoscope', 'violet', 42),
          h('h3', null, t(`${pet.name} — უკეთ გავიცნოთ.`, `Let’s get to know ${pet.name} better.`)),
          h('p', null, t('მოვლა, შენახული ჩანაწერები და შეკითხვები შენს ცხოველზე. ეს არ არის ვეტერინარული დიაგნოზი.', 'Care, saved records and questions about your pet. This is not a veterinary diagnosis.')),
          h('button', { type: 'button', class: 'cta text-btn', onClick: () => selectTab('vet') }, t('კითხვის დასმა', 'Ask a question'), icon('arrowRight', { size: 16 })))) : null)));

    (async () => {
      try {
        const w = await get(`/api/pets/${id}/weight`, { limit: 60 });
        const items = [...(w.items || [])].sort((a, b) => String(a.recordedOn).localeCompare(String(b.recordedOn)));
        const latest = w.latest || items[items.length - 1];
        if (!latest) {
          mount(weightSlot, h('div', { class: 'card' }, empty(t('წონა ჯერ არ არის დამატებული.', 'No weight added yet.'), t('დაამატე გაზომვა — იდეალური წონა ან დიაგნოზი არ გამოითვლება.', 'Add a measurement — we don’t calculate an ideal weight or a diagnosis.'),
            button(t('წონის დამატება', 'Add weight'), { icon: 'plus', variant: 'secondary', onClick: () => weightForm(null, () => renderOverview()) }))));
          return;
        }
        const first = items[0];
        const diff = items.length > 1 ? latest.weightKg - first.weightKg : 0;
        mount(weightSlot, h('div', { class: 'card pet-weight-card' },
          h('div', { class: 'between' },
            h('div', null, h('div', { class: 'stat-label' }, t('ბოლო ჩანაწერი', 'Latest entry')),
              h('div', { class: 'stat-value' }, weightLabel(latest)),
              h('div', { class: 'faint', style: { fontSize: '12.5px' } }, fmtDate(latest.recordedOn, { year: true }))),
            items.length > 1 ? badge(Math.abs(diff) < 0.05 ? t('სტაბილური', 'Stable') : diff > 0 ? `+${fmtNum(diff, 2)} ${T.unitKg}` : `${fmtNum(diff, 2)} ${T.unitKg}`, 'neutral') : null),
          items.length > 1 ? sparkline(items.map((i) => i.weightKg), { height: 56 }) : h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, t('ერთი გაზომვა — ტრენდი ჯერ არ ჩანს.', 'One measurement — no trend yet.')),
          h('div', { style: { marginTop: '10px' } }, button(t('წონის დამატება', 'Add weight'), { icon: 'plus', variant: 'ghost', size: 'sm', onClick: () => weightForm(null, () => renderOverview()) }))));
      } catch (e) { mount(weightSlot, errorBox(e)); }
    })();
    (async () => {
      try {
        const up = await get(`/api/pets/${id}/care/upcoming`);
        const all = [...(up.overdue || []).map((o) => ({ ...o, _state: 'overdue' })), ...(up.due || []).map((o) => ({ ...o, _state: 'due' })), ...(up.upcoming || []).map((o) => ({ ...o, _state: 'upcoming' }))].slice(0, 4);
        mount(careSlot, h('div', { class: 'card' }, all.length ? h('div', { class: 'list' }, all.map((o) => occurrenceRow(o, null)))
          : empty(t('ახლო დღეებში დაგეგმილი მოვლა არ არის.', 'No care planned for the coming days.'), null, button(t('მოვლის დაგეგმვა', 'Plan care'), { icon: 'plus', variant: 'secondary', onClick: () => planForm(null, () => renderOverview()) }))));
      } catch (e) { mount(careSlot, errorBox(e)); }
    })();
    (async () => {
      try {
        const [a, c] = await Promise.all([get(`/api/pets/${id}/allergies`), get(`/api/pets/${id}/conditions`)]);
        const active = (c.items || []).filter((x) => x.status === 'active').length;
        mount(healthSlot, h('div', { class: 'card' }, h('div', { class: 'list' },
          h('button', { type: 'button', class: 'row row-link', onClick: () => selectTab('health') }, tile('alert', 'rose', 38),
            h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t('ალერგიები', 'Allergies')), h('div', { class: 'row-sub' }, (a.items || []).length ? t(`${a.items.length} ჩანაწერი`, plural(a.items.length, 'entry', 'entries')) : t('ჯერ არ არის დამატებული', 'None added yet'))),
            icon('chevronRight', { size: 18, className: 'row-chev' })),
          h('button', { type: 'button', class: 'row row-link', onClick: () => selectTab('health') }, tile('heart', 'violet', 38),
            h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t('ჯანმრთელობის მდგომარეობები', 'Health conditions')), h('div', { class: 'row-sub' }, active ? t(`${active} აქტიური`, `${active} active`) : t('აქტიური არ არის მითითებული', 'None marked active'))),
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
      section(t('წონა', 'Weight'), wSlot, { action: button(t('დამატება', 'Add'), { icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => weightForm(null, drawWeight) }) }),
      h('div', { class: 'grid grid-2 pet-grid' },
        section(t('ალერგიები', 'Allergies'), aSlot, { action: button(t('დამატება', 'Add'), { icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => allergyForm(null, drawAllergies) }) }),
        section(t('ჯანმრთელობის მდგომარეობები', 'Health conditions'), cSlot, { action: button(t('დამატება', 'Add'), { icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => conditionForm(null, drawConditions) }) }))));

    async function drawWeight() {
      try {
        const w = await get(`/api/pets/${id}/weight`, { limit: 100 });
        const items = [...(w.items || [])].sort((a, b) => String(a.recordedOn).localeCompare(String(b.recordedOn)));
        if (!items.length) {
          mount(wSlot, h('div', { class: 'card' }, empty(t('წონა ჯერ არ არის დამატებული.', 'No weight added yet.'), t('დაამატე გაზომვა — იდეალური წონა ან დიაგნოზი არ გამოითვლება.', 'Add a measurement — we don’t calculate an ideal weight or a diagnosis.'),
            button(t('წონის დამატება', 'Add weight'), { icon: 'plus', onClick: () => weightForm(null, drawWeight) }))));
          return;
        }
        const recent = [...items].reverse();
        mount(wSlot, h('div', { class: 'grid grid-main pet-grid' },
          h('div', { class: 'card' },
            h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('წონის ისტორია', 'Weight history')), h('span', { class: 'faint' }, t(`${items.length} გაზომვა`, plural(items.length, 'measurement')))),
            items.length > 1
              ? lineChart({ labels: items.map((i) => fmtDate(i.recordedOn, { short: true })), tipLabels: items.map((i) => fmtDate(i.recordedOn, { year: true })),
                series: [{ name: t('წონა', 'Weight'), values: items.map((i) => i.weightKg), color: 'var(--c1)' }], unit: T.unitKg, zero: false, height: 230, fmt: (v) => fmtNum(v, 2) })
              : h('p', { class: 'muted' }, t('ერთი გაზომვა — ტრენდი ჯერ არ ჩანს.', 'One measurement — no trend yet.')),
            h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '8px' } }, t('იდეალური წონა ან დიაგნოზი არ გამოითვლება.', 'We don’t calculate an ideal weight or a diagnosis.'))),
          h('div', { class: 'card' }, h('div', { class: 'list pet-scroll' }, recent.map((log) => h('div', { class: 'row' }, tile('scale', 'teal', 36),
            h('div', { class: 'row-main' }, h('div', { class: 'row-title num' }, weightLabel(log)),
              h('div', { class: 'row-sub' }, [fmtDate(log.recordedOn, { year: true }), log.inputUnit !== 'kg' ? `${fmtNum(log.weightKg, 2)} ${T.unitKg}` : null, log.note].filter(Boolean).join(' · '))),
            h('div', { class: 'row-trail' },
              iconButton('edit', { title: T.edit, onClick: () => weightForm(log, drawWeight) }),
              iconButton('trash', { title: T.del, onClick: () => removeChild(`/api/pets/${id}/weight/${log.id}`, drawWeight) }))))))));
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
            iconButton('edit', { title: T.edit, onClick: () => allergyForm(a, drawAllergies) }),
            iconButton('trash', { title: T.del, onClick: () => removeChild(`/api/pets/${id}/allergies/${a.id}`, drawAllergies) })))))
          : empty(t('ალერგიები ჯერ არ არის დამატებული', 'No allergies added yet'), t('ცარიელი სია არ ნიშნავს, რომ ალერგია არ აქვს — უბრალოდ ჯერ არ არის ჩაწერილი.', 'An empty list doesn’t mean there are no allergies — just that none are recorded yet.'))));
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
            h('div', { class: 'row-sub' }, [T.condStatus[c.status], T.condBasis[c.reportedBasis], c.onsetOn ? t(`დაწყება ${fmtDate(c.onsetOn, { year: true })}`, `Started ${fmtDate(c.onsetOn, { year: true })}`) : null, c.resolvedOn ? t(`დასრულება ${fmtDate(c.resolvedOn, { year: true })}`, `Resolved ${fmtDate(c.resolvedOn, { year: true })}`) : null].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' },
            iconButton('edit', { title: T.edit, onClick: () => conditionForm(c, drawConditions) }),
            iconButton('trash', { title: T.del, onClick: () => removeChild(`/api/pets/${id}/conditions/${c.id}`, drawConditions) })));
        mount(cSlot, h('div', { class: 'card' }, items.length ? [
          active.length ? h('div', { class: 'list' }, active.map(rowOf)) : h('p', { class: 'muted' }, t('აქტიური არ არის მითითებული', 'None marked active')),
          resolved.length ? h('div', { class: 'pet-subhead' }, t('დასრულებული / ისტორია', 'Resolved / history')) : null,
          resolved.length ? h('div', { class: 'list' }, resolved.map(rowOf)) : null,
        ] : empty(t('მდგომარეობები ჯერ არ არის დამატებული.', 'No conditions added yet.'), t('ჩაწერე, რაც იცი. ეს არ არის დიაგნოზი.', 'Write down what you know. This is not a diagnosis.'))));
      } catch (e) { mount(cSlot, errorBox(e, drawConditions)); }
    }
    drawWeight(); drawAllergies(); drawConditions();
  }

  async function removeChild(path, after) {
    if (!(await confirmDialog({ title: t('წავშალოთ ჩანაწერი?', 'Delete this record?'), body: t('ეს მოქმედება ვერ გაუქმდება.', 'This can’t be undone.'), confirm: T.del, danger: true }))) return;
    try { await del(path); toast(t('წაიშალა', 'Deleted')); after(); } catch (e) { toast(petErr(e), 'error'); }
  }

  function weightForm(log, after) {
    formModal({
      title: log ? t('წონის რედაქტირება', 'Edit weight') : t('წონის დამატება', 'Add weight'),
      size: 'sm',
      fields: () => h('div', { class: 'stack' },
        h('div', { class: 'form-row' },
          field(t('წონა', 'Weight'), input({ type: 'number', name: 'inputValue', step: 'any', min: 0, required: true, value: log?.inputValue ?? '', inputmode: 'decimal' })),
          field(t('ერთეული', 'Unit'), select([{ value: 'kg', label: T.unitKg }, { value: 'g', label: t('გრამი', 'grams') }, { value: 'lb', label: t('ფუნტი', 'pounds') }], log?.inputUnit || 'kg', { name: 'inputUnit' }))),
        field(t('გაზომვის თარიღი', 'Date measured'), input({ type: 'date', name: 'recordedOn', max: today(), required: true, value: log ? String(log.recordedOn).slice(0, 10) : today() })),
        field(T.note, input({ name: 'note', maxlength: 500, placeholder: T.optional, value: log?.note || '' }))),
      onSubmit: async (v, close) => {
        const value = Number(String(v.inputValue).replace(',', '.'));
        if (!v.inputValue || !Number.isFinite(value) || value <= 0) throw new Error(t('შეიყვანე წონა', 'Enter the weight'));
        if (!v.recordedOn) throw new Error(t('გაზომვის თარიღი', 'Date measured'));
        if (v.recordedOn > today()) throw new Error(T.futureDate);
        const body = { recordedOn: v.recordedOn, inputValue: value, inputUnit: v.inputUnit, note: nz(v.note) };
        try {
          if (log) await patch(`/api/pets/${id}/weight/${log.id}`, body);
          else await post(`/api/pets/${id}/weight`, { ...body, clientRequestId: rid() });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast(T.saved); after?.();
      },
    });
  }

  function allergyForm(a, after) {
    formModal({
      title: a ? t('ალერგიის რედაქტირება', 'Edit allergy') : t('ალერგიის დამატება', 'Add allergy'),
      fields: () => h('div', { class: 'stack' },
        field(t('ალერგენი', 'Allergen'), input({ name: 'name', required: true, maxlength: 120, placeholder: t('მაგ. ქათამი, პენიცილინი', 'e.g. chicken, penicillin'), value: a?.name || '' })),
        h('div', { class: 'form-row' },
          field(t('კატეგორია', 'Category'), select(opt(T.allergyCats), a?.category || 'unknown', { name: 'category' })),
          field(t('წყარო', 'Source'), select(opt(T.allergyStatus), a?.reportedStatus || 'suspected', { name: 'reportedStatus' }))),
        field(t('რეაქცია', 'Reaction'), input({ name: 'reaction', maxlength: 300, placeholder: t('რა დაინახე', 'What you noticed'), value: a?.reaction || '' })),
        field(t('დაფიქსირების თარიღი', 'Date noted'), input({ type: 'date', name: 'notedOn', max: today(), value: a?.notedOn ? String(a.notedOn).slice(0, 10) : '' }), t('თუ არ იცი, დატოვე ცარიელი.', 'If you don’t know, leave it empty.')),
        field(T.note, textarea({ name: 'notes', maxlength: 1000, rows: 2, value: a?.notes || '' }))),
      onSubmit: async (v, close) => {
        if (!v.name.trim()) throw new Error(T.enterName);
        if (v.notedOn && v.notedOn > today()) throw new Error(T.futureDate);
        const body = { name: v.name.trim(), category: v.category, reportedStatus: v.reportedStatus, reaction: nz(v.reaction), notedOn: v.notedOn || null, notes: nz(v.notes) };
        try {
          if (a) await patch(`/api/pets/${id}/allergies/${a.id}`, body);
          else await post(`/api/pets/${id}/allergies`, { ...body, clientRequestId: rid() });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast(T.saved); after?.();
      },
    });
  }

  function conditionForm(c, after) {
    formModal({
      title: c ? t('მდგომარეობის რედაქტირება', 'Edit condition') : t('მდგომარეობის დამატება', 'Add condition'),
      fields: () => {
        const status = select(opt(T.condStatus), c?.status || 'active', { name: 'status' });
        const resolvedWrap = field(t('დასრულების თარიღი', 'Resolved date'), input({ type: 'date', name: 'resolvedOn', max: today(), value: c?.resolvedOn ? String(c.resolvedOn).slice(0, 10) : '' }));
        const sync = () => { resolvedWrap.hidden = status.value !== 'resolved'; };
        status.addEventListener('change', sync); sync();
        return h('div', { class: 'stack' },
          field(t('მდგომარეობა', 'Condition'), input({ name: 'name', required: true, maxlength: 160, placeholder: t('მაგ. ართრიტი', 'e.g. arthritis'), value: c?.name || '' })),
          h('div', { class: 'form-row' }, field(t('სტატუსი', 'Status'), status), field(t('წყარო', 'Source'), select(opt(T.condBasis), c?.reportedBasis || 'owner_reported', { name: 'reportedBasis' }))),
          field(t('დაწყების / დიაგნოზის თარიღი', 'Onset / diagnosis date'), input({ type: 'date', name: 'onsetOn', max: today(), value: c?.onsetOn ? String(c.onsetOn).slice(0, 10) : '' })),
          resolvedWrap,
          field(T.note, textarea({ name: 'notes', maxlength: 1000, rows: 2, value: c?.notes || '' })),
          h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('ჩაწერე, რაც იცი. ეს არ არის დიაგნოზი.', 'Write down what you know. This is not a diagnosis.')));
      },
      onSubmit: async (v, close) => {
        if (!v.name.trim()) throw new Error(T.enterName);
        if ((v.onsetOn && v.onsetOn > today()) || (v.resolvedOn && v.resolvedOn > today())) throw new Error(T.futureDate);
        const body = { name: v.name.trim(), status: v.status, reportedBasis: v.reportedBasis, onsetOn: v.onsetOn || null, resolvedOn: v.status === 'resolved' ? v.resolvedOn || null : null, notes: nz(v.notes) };
        try {
          if (c) await patch(`/api/pets/${id}/conditions/${c.id}`, body);
          else await post(`/api/pets/${id}/conditions`, { ...body, clientRequestId: rid() });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast(T.saved); after?.();
      },
    });
  }

  /* Care: upcoming, plans, products, history */
  function occurrenceRow(o, after) {
    const kind = o.kind || 'OTHER';
    const state = o._state === 'overdue' ? badge(t('ვადაგასული', 'Overdue'), 'danger') : o._state === 'due' ? badge(t('დღეს', 'Today'), 'warn') : null;
    const actions = after ? h('div', { class: 'row-trail' },
      button(kind === 'MEDICATION' ? t('მივეცი', 'Given') : t('გაკეთდა', 'Done'), { size: 'sm', variant: 'secondary', icon: 'check', onClick: () => completeForm(o, after) }),
      iconButton('x', { title: t('გამოტოვება', 'Skip'), onClick: () => skipOccurrence(o, after) })) : h('div', { class: 'row-trail' }, state);
    return h('div', { class: 'row' }, tile(T.kindIcon[kind] || 'heart', T.kindInk[kind] || 'teal', 36),
      h('div', { class: 'row-main' },
        h('div', { class: 'row-title' }, o.title || T.kinds[kind]),
        h('div', { class: 'row-sub' }, [T.kinds[kind], relDay(o.plannedOn), o.plannedTime].filter(Boolean).join(' · '), after && state ? ' ' : null, after ? state : null)),
      actions);
  }

  function completeForm(o, after) {
    formModal({
      title: t('მოვლის დადასტურება', 'Confirm care'),
      size: 'sm',
      submit: t('დადასტურება', 'Confirm'),
      fields: () => h('div', { class: 'stack' },
        h('p', { class: 'muted' }, `${o.title || T.kinds[o.kind] || ''} · ${t('დაგეგმილი', 'planned')} ${fmtDate(o.plannedOn, { year: true })}`),
        field(T.dateGiven, input({ type: 'date', name: 'administeredOn', max: today(), required: true, value: o.plannedOn && o.plannedOn <= today() ? o.plannedOn : today() })),
        field(T.note, input({ name: 'notes', maxlength: 500, placeholder: T.optional }))),
      onSubmit: async (v, close) => {
        if (!v.administeredOn) throw new Error(T.dateGiven);
        try {
          await post(`/api/pets/${id}/schedules/${o.scheduleId}/complete`, {
            occurrenceKey: o.occurrenceKey, revision: o.revision, administeredOn: v.administeredOn, notes: nz(v.notes), timezone: tzName(), clientRequestId: rid(),
          });
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) { close(); toast(T.conflict, 'info'); after?.(); return; }
          throw new Error(petErr(e));
        }
        close(); toast(T.saved); after?.();
      },
    });
  }

  async function skipOccurrence(o, after) {
    if (!(await confirmDialog({ title: t('გამოვტოვოთ?', 'Skip this one?'), body: t('გამოტოვება ხურავს ამ შემთხვევას მიღების ჩანაწერის გარეშე.', 'Skipping closes this occurrence without logging a dose.'), confirm: t('გამოტოვება', 'Skip') }))) return;
    try {
      await post(`/api/pets/${id}/schedules/${o.scheduleId}/skip`, { occurrenceKey: o.occurrenceKey, revision: o.revision, clientRequestId: rid() });
      toast(t('გამოტოვებულია', 'Skipped')); after?.();
    } catch (e) {
      toast(e instanceof ApiError && e.status === 409 ? T.conflict : petErr(e), 'error');
      after?.();
    }
  }

  async function planForm(draft, after) {
    let products = [];
    try { products = (await get(`/api/pets/${id}/products`)).items || []; } catch { products = []; }
    formModal({
      title: t('მოვლის დაგეგმვა', 'Plan care'),
      size: 'lg',
      submit: t('გეგმის შენახვა', 'Save plan'),
      fields: () => {
        const kindSel = select([{ value: '', label: t('აირჩიე…', 'Choose…') }, ...opt(T.kinds)], draft?.kind || '', { name: 'kind' });
        const prodSel = h('select', { class: 'input select', name: 'productId' });
        const fillProducts = () => mount(prodSel, [h('option', { value: '' }, t('პროდუქტის გარეშე', 'No product')),
          ...products.filter((p) => !p.archivedAt && (!kindSel.value || p.kind === kindSel.value)).map((p) => h('option', { value: p.id, selected: p.id === draft?.productId }, p.name))]);
        fillProducts();
        kindSel.addEventListener('change', fillProducts);
        const recSel = select(opt(T.recurrence), draft?.recurrenceKind || 'ONCE', { name: 'recurrenceKind' });
        const intervalWrap = field(t('რამდენი', 'How many'), input({ type: 'number', name: 'intervalCount', min: 1, step: 1, value: draft?.intervalCount || 1 }));
        const basisWrap = field(t('გამეორების საფუძველი', 'Repeat based on'), select([{ value: 'FIXED_CALENDAR', label: t('კალენდარული თარიღებით', 'Calendar dates') }, { value: 'FROM_ADMINISTRATION', label: t('დადასტურებული მიღებიდან', 'Last confirmed dose') }], 'FIXED_CALENDAR', { name: 'recurrenceBasis' }));
        const timeWrap = field(t('საათი (სურვილისამებრ)', 'Time (optional)'), input({ type: 'time', name: 'dueTime', value: draft?.dueTime || '' }));
        const timesWrap = field(t('დროები', 'Times'), input({ name: 'times', value: '08:00,20:00', placeholder: '08:00,20:00' }), t('მძიმით გამოყავი, მაგალითად 08:00,20:00', 'Separate with commas, e.g. 08:00,20:00'));
        const endWrap = field(t('კურსის დასასრული', 'Course ends'), input({ type: 'date', name: 'courseEndsOn' }));
        const limitWrap = field(t('გამეორებების ლიმიტი', 'Repeat limit'), input({ type: 'number', name: 'occurrenceLimit', min: 1, step: 1 }));
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
          draft ? h('div', { class: 'disclaimer', style: { marginTop: 0 } }, icon('info', { size: 16 }), t('MEDIVET-ის წინადადება. ჯერ არ არის შენახული — გადაამოწმე და შეინახე მხოლოდ შენი დადასტურებით.', 'Suggested by MEDIVET. Not saved yet — review it and save only if you confirm.')) : null,
          h('div', { class: 'form-row' }, field(t('რა მოვლაა?', 'What kind of care?'), kindSel), field(t('პროდუქტი', 'Product'), prodSel)),
          field(t('სათაური', 'Title'), input({ name: 'title', maxlength: 120, placeholder: t('მაგ. ცოფის აცრა', 'e.g. Rabies vaccine'), value: draft?.title || '' })),
          h('div', { class: 'form-row' },
            field(t('პირველი თარიღი', 'First date'), input({ type: 'date', name: 'startOn', required: true, value: draft?.startOn || today() })),
            field(t('გამეორება', 'Repeat'), recSel)),
          h('div', { class: 'form-row' }, intervalWrap, basisWrap),
          timeWrap, timesWrap,
          h('div', { class: 'form-row' }, endWrap, limitWrap),
          h('div', { class: 'form-row' },
            field(t('დოზა', 'Dose'), input({ name: 'dose', maxlength: 60, value: draft?.dose || '' })),
            field(t('ერთეული', 'Unit'), input({ name: 'doseUnit', maxlength: 40, placeholder: t('მაგ. ტაბლეტი, მლ', 'e.g. tablet, ml'), value: draft?.doseUnit || '' }))),
          h('div', { class: 'form-row' },
            field(t('მიღების გზა', 'Route'), select([{ value: '', label: '—' }, ...opt(T.routes)], '', { name: 'route' })),
            field(t('წყარო', 'Source'), select(opt(T.sources), 'USER_ENTERED', { name: 'source' }))),
          h('p', { class: 'faint', style: { fontSize: '12.5px' } }, `${T.plannedDisclaimer} ${t('შეხსენებები MEDICARD აპში ირთვება.', 'Reminders are turned on in the MEDICARD app.')}`));
      },
      onSubmit: async (v, close) => {
        if (!v.kind) throw new Error(T.pickKind);
        if (!v.startOn) throw new Error(t('პირველი თარიღი: შეიყვანე სრული თარიღი — დღე, თვე, წელი.', 'First date: enter the full date — day, month and year.'));
        const r = v.recurrenceKind;
        if (r !== 'ONCE' && v.courseEndsOn && v.courseEndsOn < v.startOn) throw new Error(t('დასრულება პირველ თარიღზე ადრე ვერ იქნება.', 'The end can’t be before the first date.'));
        const timeOk = (tm) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(tm).trim());
        let times = null;
        if (r === 'DAILY_COURSE') {
          times = String(v.times || '').split(',').map((tm) => tm.trim()).filter(Boolean);
          if (!times.length || times.some((tm) => !timeOk(tm)) || new Set(times).size !== times.length) throw new Error(t('ჩაწერე განსხვავებული საათები, მაგალითად 08:00,20:00.', 'Enter different times, e.g. 08:00,20:00.'));
          if (!v.courseEndsOn && !v.occurrenceLimit) throw new Error(t('ყოველდღიური კურსისთვის მიუთითე დასრულების თარიღი ან გამეორებების რაოდენობა.', 'For a daily course, set an end date or a number of repeats.'));
        } else if (v.dueTime && !timeOk(v.dueTime)) throw new Error(t('საათი შეიყვანე ფორმატით სს:წწ, მაგალითად 09:00.', 'Enter the time as HH:MM, e.g. 09:00.'));
        if (!['ONCE', 'DAILY_COURSE'].includes(r) && (!Number.isInteger(Number(v.intervalCount)) || Number(v.intervalCount) < 1)) throw new Error(t('ინტერვალი დადებითი მთელი რიცხვი უნდა იყოს.', 'The interval must be a positive whole number.'));
        if (r !== 'ONCE' && v.occurrenceLimit && (!Number.isInteger(Number(v.occurrenceLimit)) || Number(v.occurrenceLimit) < 1)) throw new Error(t('გამეორებების რაოდენობა დადებითი მთელი რიცხვი უნდა იყოს.', 'The number of repeats must be a positive whole number.'));
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
        close(); toast(t('გეგმა შენახულია', 'Plan saved')); after?.();
      },
    });
  }

  async function recordForm(after) {
    let products = [];
    try { products = (await get(`/api/pets/${id}/products`)).items || []; } catch { products = []; }
    formModal({
      title: t('მიღების აღრიცხვა', 'Log a dose'),
      fields: () => h('div', { class: 'stack' },
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('უკვე გაკეთებული აცრა ან მიღება.', 'A vaccination or dose already given.')),
        h('div', { class: 'form-row' },
          field(t('რა მოვლაა?', 'What kind of care?'), select([{ value: '', label: t('აირჩიე…', 'Choose…') }, ...opt(T.kinds)], '', { name: 'kind' })),
          field(t('პროდუქტი', 'Product'), select([{ value: '', label: t('პროდუქტის გარეშე', 'No product') }, ...products.filter((p) => !p.archivedAt).map((p) => ({ value: p.id, label: p.name }))], '', { name: 'productId' }))),
        field(t('სათაური', 'Title'), input({ name: 'title', maxlength: 120 })),
        h('div', { class: 'form-row' },
          field(T.dateGiven, input({ type: 'date', name: 'administeredOn', max: today(), required: true, value: today() })),
          field(t('დრო (თუ იცი)', 'Time (if you know)'), input({ type: 'time', name: 'administeredTime' }))),
        h('div', { class: 'form-row' },
          field(t('დოზა', 'Dose'), input({ name: 'dose', maxlength: 60 })),
          field(t('ერთეული', 'Unit'), input({ name: 'doseUnit', maxlength: 40, placeholder: t('მაგ. ტაბლეტი, მლ', 'e.g. tablet, ml') }))),
        field(t('მიღების გზა', 'Route'), select([{ value: '', label: '—' }, ...opt(T.routes)], '', { name: 'route' })),
        field(T.note, textarea({ name: 'notes', maxlength: 1000, rows: 2 }))),
      onSubmit: async (v, close) => {
        if (!v.kind) throw new Error(T.pickKind);
        if (!v.administeredOn) throw new Error(T.dateGiven);
        if (v.administeredOn > today()) throw new Error(T.futureDate);
        const product = products.find((p) => p.id === v.productId);
        try {
          await post(`/api/pets/${id}/events`, {
            kind: v.kind, title: v.title.trim() || product?.name || T.kinds[v.kind], productId: v.productId || null,
            administeredOn: v.administeredOn, administeredTime: v.administeredTime || null,
            utcOffsetMinutes: v.administeredTime ? utcOffsetMinutes() : null, timezone: v.administeredTime ? tzName() : null,
            dose: nz(v.dose), doseUnit: nz(v.doseUnit), route: v.route || null, notes: nz(v.notes), clientRequestId: rid(),
          });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast(T.saved); after?.();
      },
    });
  }

  function productForm(p, after) {
    formModal({
      title: p ? t('პროდუქტის რედაქტირება', 'Edit product') : t('პროდუქტის დამატება', 'Add product'),
      fields: () => h('div', { class: 'stack' },
        h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('რას იყენებ — მაგ. ბრუვექტო. ვადა არ ცვლის შემდეგ მიღებას.', 'What you use — e.g. Bravecto. The expiry date doesn’t change the next dose.')),
        h('div', { class: 'form-row' },
          field(t('რა მოვლაა?', 'What kind of care?'), select(opt(T.kinds), p?.kind || 'FLEA_TICK', { name: 'kind' })),
          field(t('პროდუქტი', 'Product'), input({ name: 'name', required: true, maxlength: 120, placeholder: t('მაგ. ბრუვექტო', 'e.g. Bravecto'), value: p?.name || '' }))),
        h('div', { class: 'form-row' },
          field(t('ფორმა / სიძლიერე', 'Form / strength'), input({ name: 'formulation', maxlength: 120, value: p?.formulation || '' })),
          field(t('პარტია', 'Batch'), input({ name: 'batchId', maxlength: 80, value: p?.batchId || '' }))),
        field(t('ვადის გასვლის თარიღი', 'Expiry date'), input({ type: 'date', name: 'expiresOn', value: p?.expiresOn ? String(p.expiresOn).slice(0, 10) : '' }), t('ვადა არ განსაზღვრავს შემდეგ მიღებას.', 'The expiry date doesn’t determine the next dose.')),
        field(T.note, textarea({ name: 'notes', maxlength: 1000, rows: 2, value: p?.notes || '' }))),
      onSubmit: async (v, close) => {
        if (!v.name.trim()) throw new Error(T.enterName);
        const body = { kind: v.kind, name: v.name.trim(), formulation: nz(v.formulation), batchId: nz(v.batchId), expiresOn: v.expiresOn || null, notes: nz(v.notes) };
        try {
          if (p) await patch(`/api/pets/${id}/products/${p.id}`, body);
          else await post(`/api/pets/${id}/products`, { ...body, clientRequestId: rid() });
        } catch (e) { throw new Error(petErr(e)); }
        close(); toast(T.saved); after?.();
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
        button(t('მოვლის დაგეგმვა', 'Plan care'), { icon: 'calendar', onClick: () => planForm(null, refresh) }),
        button(t('მიღების აღრიცხვა', 'Log a dose'), { icon: 'check', variant: 'secondary', onClick: () => recordForm(refresh) }),
        button(t('პროდუქტის დამატება', 'Add product'), { icon: 'plus', variant: 'ghost', onClick: () => productForm(null, drawProducts) })),
      h('div', { class: 'grid grid-main pet-grid' },
        h('div', { class: 'stack', style: { gap: '28px' } },
          section(t('დაგეგმილი მოვლა', 'Planned care'), upSlot),
          section(t('მოვლის ისტორია', 'Care history'), histSlot)),
        h('div', { class: 'stack', style: { gap: '28px' } },
          section(t('აქტიური გეგმები', 'Active plans'), planSlot),
          section(t('პროდუქტები', 'Products'), prodSlot)))));

    async function drawUpcoming() {
      try {
        const up = await get(`/api/pets/${id}/care/upcoming`);
        const all = [...(up.overdue || []).map((o) => ({ ...o, _state: 'overdue' })), ...(up.due || []).map((o) => ({ ...o, _state: 'due' })), ...(up.upcoming || []).map((o) => ({ ...o, _state: 'upcoming' }))];
        mount(upSlot, h('div', { class: 'card' },
          all.length ? h('div', { class: 'list' }, all.map((o) => occurrenceRow(o, refresh)))
            : empty(t('მოვლა ჯერ არ არის დამატებული.', 'No care added yet.'), t('დააჭირე მოვლის დამატებას — აცრა, რწყილი/ტკიპა, ჭიები ან სხვა რუტინა. ეს დაგეგმილი მოვლაა, არა გარანტირებული დაცვა.', 'Click Plan care — vaccination, flea/tick, deworming or another routine. This is planned care, not guaranteed protection.')),
          h('p', { class: 'disclaimer' }, icon('info', { size: 14 }), h('span', null, T.plannedDisclaimer, t(' შეხსენებები ტელეფონზე მოდის — ', ' Reminders arrive on your phone — '),
            h('a', { class: 'link', href: APP_URL, target: '_blank', rel: 'noopener' }, t('MEDICARD აპი', 'the MEDICARD app')), '.'))));
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
                : isEn ? everyN(s.intervalCount || 1, s.recurrenceKind)
                  : `ყოველ ${s.intervalCount || 1} ${{ EVERY_N_DAYS: 'დღეში', EVERY_N_WEEKS: 'კვირაში', EVERY_N_MONTHS: 'თვეში' }[s.recurrenceKind] || ''}`,
              s.nextDueOn ? `${t('შემდეგი', 'Next')} ${relDay(s.nextDueOn)}${s.nextDueTime ? `, ${s.nextDueTime}` : ''}` : null,
              [s.dose, s.doseUnit].filter(Boolean).join(' ') || null,
              T.sources[s.source],
            ].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' }, iconButton('x', { title: t('გეგმის გაუქმება', 'Cancel plan'), onClick: async () => {
            if (!(await confirmDialog({ title: t('გეგმის გაუქმება', 'Cancel plan'), body: t('შესრულებული ჩანაწერები დარჩება. მომავალი თარიღები აღარ გამოჩნდება.', 'Completed entries stay. Future dates will no longer appear.'), confirm: t('გაუქმება', 'Cancel plan'), danger: true }))) return;
            try { await post(`/api/pets/${id}/schedules/${s.id}/cancel`); toast(t('გეგმა გაუქმდა', 'Plan cancelled')); refresh(); } catch (e) { toast(petErr(e), 'error'); }
          } })))))
          : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('აქტიური გეგმა ჯერ არ არის.', 'No active plans yet.'))));
      } catch (e) { mount(planSlot, errorBox(e, drawPlans)); }
    }
    async function drawProducts() {
      try {
        const res = await get(`/api/pets/${id}/products`);
        const items = (res.items || []).filter((p) => !p.archivedAt);
        mount(prodSlot, h('div', { class: 'card' }, items.length ? h('div', { class: 'list' }, items.map((p) => h('div', { class: 'row' },
          tile(T.kindIcon[p.kind] || 'heart', 'neutral', 36),
          h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, p.name),
            h('div', { class: 'row-sub' }, [T.kinds[p.kind], p.formulation, p.expiresOn ? t(`ვადა ${fmtDate(p.expiresOn, { year: true })}`, `Expires ${fmtDate(p.expiresOn, { year: true })}`) : null].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' },
            iconButton('edit', { title: T.edit, onClick: () => productForm(p, drawProducts) }),
            iconButton('archive', { title: T.archive, onClick: async () => {
              if (!(await confirmDialog({ title: t('არქივში გადავიტანოთ?', 'Move to archive?'), body: t('პროდუქტი არქივშია. ისტორია და გეგმა რჩება.', 'The product will be archived. History and the plan are kept.'), confirm: t('არქივში', 'Archive') }))) return;
              try { await post(`/api/pets/${id}/products/${p.id}/archive`); toast(t('არქივშია', 'Archived')); drawProducts(); } catch (e) { toast(petErr(e), 'error'); }
            } })))))
          : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('პროდუქტი ჯერ არ არის დამატებული.', 'No products added yet.'))));
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
              ev.productNameSnapshot, ev.status === 'VOIDED' ? t('გაუქმებული ჩანაწერი', 'Voided entry') : null].filter(Boolean).join(' · '))),
          h('div', { class: 'row-trail' }, ev.status === 'VOIDED' ? null : iconButton('x', { title: t('ჩანაწერის გაუქმება', 'Void entry'), onClick: () => voidEvent(ev, refresh) })))))
          : h('p', { class: 'muted', style: { fontSize: '13.5px' } }, t('წარსული მიღება ჯერ არ არის ჩაწერილი.', 'No past doses recorded yet.'))));
      } catch (e) { mount(histSlot, errorBox(e, drawHistory)); }
    }
    refresh(); drawProducts();
  }

  async function voidEvent(ev, after) {
    if (!(await confirmDialog({ title: t('გავაუქმოთ ჩანაწერი?', 'Void this entry?'), body: t('გაუქმება ისტორიაში დარჩება. მომავალი გეგმა ავტომატურად არ გადაითვლება.', 'The voided entry stays in history. The future plan won’t be recalculated automatically.'), confirm: t('ჩანაწერის გაუქმება', 'Void entry'), danger: true }))) return;
    try {
      await post(`/api/pets/${id}/events/${ev.id}/void`, {});
      toast(t('ჩანაწერი გაუქმდა', 'Entry voided')); after?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const ok = await confirmDialog({ title: t('გეგმის განახლება', 'Update plan'), body: t('ეს მიღება გეგმის შემდეგ თარიღს ცვლის. დაადასტურე, თუ გინდა გეგმის განახლება.', 'This dose changes the next date in the plan. Confirm if you want to update the plan.'), confirm: t('გეგმის განახლება', 'Update plan') });
        if (!ok) return;
        try { await post(`/api/pets/${id}/events/${ev.id}/void`, { confirmRecalculate: true }); toast(t('ჩანაწერი გაუქმდა', 'Entry voided')); after?.(); } catch (e2) { toast(petErr(e2), 'error'); }
        return;
      }
      toast(petErr(e), 'error');
    }
  }

  /* MEDIVET — its own endpoint and storage (never the human Medi). */
  function renderVet(slot, p) {
    let sessionId;
    let alive2 = true;
    let sending = false;
    let abort = null;
    const log = h('div', { class: 'chat-log', 'aria-live': 'polite' });
    const ta = h('textarea', { rows: 1, placeholder: t('კითხვა ცხოველზე…', 'Ask about your pet…'), 'aria-label': t('კითხვა MEDIVET-ს', 'Ask MEDIVET'), maxlength: 4000 });
    const sendBtn = h('button', { type: 'button', class: 'btn btn-primary', 'aria-label': t('გაგზავნა', 'Send') }, icon('send', { size: 18 }));
    const cancelBtn = h('button', { type: 'button', class: 'text-btn pet-cancel', hidden: true }, t('გაუქმება', 'Cancel'));
    const errEl = h('div', { class: 'form-error', hidden: true });
    // Declining / closing the AI disclosure is a choice, not an error (App Review 2026-09-22): a calm
    // note with „ხელახლა ცდა“ that opens the disclosure again; the question goes back to the composer.
    const noteEl = h('div', { role: 'status', style: { display: 'none', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 12px', borderRadius: '12px', background: 'var(--bg)', color: 'var(--text2)', fontSize: '14px', marginBottom: '8px' } });
    const showDeclined = (message) => {
      mount(noteEl, h('span', { style: { flex: 1, minWidth: '180px' } }, t('AI-ს არაფერი გაეგზავნა. როცა გინდა, შეგიძლია ხელახლა სცადო.', 'Nothing was sent to the AI. You can try again whenever you like.')),
        h('button', { type: 'button', class: 'text-btn', onClick: () => { noteEl.style.display = 'none'; send(ta.value.trim() || message); } }, t('ხელახლა ცდა', 'Try again')));
      noteEl.style.display = 'flex';
    };
    const intro = h('div', { class: 'stack pet-vet-intro' },
      h('div', { class: 'card hstack', style: { flexWrap: 'nowrap', alignItems: 'flex-start' } }, tile('stethoscope', 'violet', 42),
        h('div', null, h('div', { class: 'faint', style: { fontSize: '12px', letterSpacing: '.06em' } }, 'MEDIVET · AI'),
          h('b', null, t(`${p.name} — უკეთ გავიცნოთ.`, `Let’s get to know ${p.name} better.`)),
          h('p', { class: 'muted', style: { fontSize: '13.5px', marginTop: '4px' } }, t('შემიძლია აგიხსნა ჩაწერილი მოვლა, დაგეხმარო ვეტერინართან მოსამზადებლად და ზოგადი მოვლის კითხვებზე ვუპასუხო.', 'I can explain the care you have recorded, help you prepare for a vet visit and answer general care questions.')),
          h('p', { class: 'faint', style: { fontSize: '12.5px', marginTop: '6px' } }, T.vetDisclaimer))),
      h('div', { class: 'chips' }, T.vetStarters.map((s) => h('button', { type: 'button', class: 'chip', onClick: () => send(s) }, s))));

    const autosize = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(180, ta.scrollHeight)}px`; };
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(ta.value); } });
    sendBtn.addEventListener('click', () => send(ta.value));
    cancelBtn.addEventListener('click', () => abort?.abort());

    mount(slot, h('div', { class: 'card pet-chat' },
      h('div', { class: 'pet-chat-head' }, petPhoto(p, 40),
        h('div', { style: { flex: 1, minWidth: 0 } }, h('b', null, 'MEDIVET'), h('div', { class: 'faint', style: { fontSize: '12.5px' } }, p.name)),
        iconButton('info', { title: t('MEDIVET — როგორ მუშაობს', 'MEDIVET — how it works'), onClick: () => disclosure(true) })),
      h('div', { class: 'chat pet-chat-body' }, log,
        h('div', null, noteEl, errEl, h('div', { style: { textAlign: 'center' } }, cancelBtn),
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
        extra.appendChild(h('div', { class: 'pet-ai-sources' }, h('b', null, t('წყაროები', 'Sources')),
          msg.citations.filter((c) => /^https:\/\//.test(c.url || '')).map((c) => h('a', { href: c.url, target: '_blank', rel: 'noopener', class: 'link' }, `${c.title} — ${c.publisher}`))));
      }
      if (msg.draft) {
        const d = msg.draft;
        extra.appendChild(h('div', { class: 'pet-draft' },
          h('b', null, t('მოვლის გეგმის წინადადება', 'Suggested care plan')),
          h('div', { class: 'muted', style: { fontSize: '13px' } }, [d.kind ? T.kinds[d.kind] : null, d.title, d.dose, d.doseUnit, d.startOn ? fmtDate(d.startOn, { year: true }) : null].filter(Boolean).join(' · ') || '—'),
          d.incomplete ? h('div', { style: { fontSize: '13px', color: 'var(--warn)' } }, t('არასრული — გამოტოვებული ველები არ შეივსო გამოგონებით.', 'Incomplete — missing fields were not made up.')) : null,
          h('div', { class: 'faint', style: { fontSize: '12.5px' } }, t('ჯერ არ არის შენახული. შენახვა მხოლოდ შენი დადასტურების შემდეგ.', 'Not saved yet. It is saved only after you confirm.')),
          button(t('გეგმის ფორმაში გახსნა', 'Open in the plan form'), { variant: 'secondary', size: 'sm', onClick: () => planForm(d, () => toast(t('გეგმა შენახულია', 'Plan saved'))) })));
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
          title: t('MEDIVET-ის გამოყენება', 'Using MEDIVET'),
          size: 'sm',
          body: h('p', { class: 'muted' }, T.vetDisclosureBody),
          footer: (close) => [button(t('გასაგებია', 'Got it'), { onClick: () => { ok = true; try { localStorage.setItem('medicard.web.pets.vetDisclosure.v1', '1'); } catch { /* ignore */ } close(); } })],
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
      noteEl.style.display = 'none';
      if (log.contains(intro)) clear(log);
      const userMsg = { role: 'user', content: message };
      const aiMsg = { role: 'assistant', content: '', streaming: true, status: 'PARTIAL' };
      const userBubble = bubble(userMsg);
      log.appendChild(userBubble);
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
          aiBubble.remove(); userBubble.remove();
          ta.value = message; autosize();
          showDeclined(message);
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

    mount(log, h('div', { class: 'faint', style: { padding: '12px' } }, t('ისტორია იტვირთება…', 'Loading history…')));
    loadHistory();
    return () => { alive2 = false; abort?.abort(); };
  }

  try {
    await loadPet();
    renderTab();
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) {
      mount(head, h('div', { class: 'card' }, empty(t('ცხოველი ვერ მოიძებნა', 'Pet not found'), t('შესაძლოა არქივში გადავიდა.', 'It may have been archived.'), button(t('ჩემი ცხოველები', 'My pets'), { href: '/pets' }))));
      tabs.hidden = true;
    } else {
      mount(head, errorBox(e, () => petDetail(root, ctx)));
    }
  }
  return () => { alive = false; if (typeof chatCleanup === 'function') chatCleanup(); };
}
