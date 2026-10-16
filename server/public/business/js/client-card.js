// MEDIBOOK business panel — one client's card: who they are and how to reach them, the numbers at a glance,
// visits, the segment card (anamnesis, tooth chart, hair formulas, injection log…), private photos, dated notes,
// money and loyalty, reviews. Also the add / edit client dialog the list page uses.
import { h, mount, icon, button, pageHead, card, input, textarea, field, busy, openModal, confirmDialog, toggle } from '/app/js/ui.js';
import { dateField, select } from './fields.js';
import { t } from '/app/js/i18n.js';
import { getToken } from '/app/js/api.js';
import { biz, gel, when, dateText, avatar, emptyBox, debounceFn, fail, ok, phoneText, vocab, methodLabel } from './shared.js';
import { appointmentLine, loadContext, newAppointmentDialog, openAppointment } from './appointment.js';
import { saleDialog } from './sale.js';
import { chips, pager, paginate } from './lists.js';
import { state, canManage } from './state.js';

const D = 86_400_000;
const SOURCES = () => [['APP', t('MEDICARD აპი', 'MEDICARD app')], ['WALK_IN', t('შემოვიდა', 'Walk-in')], ['PHONE', t('ტელეფონით', 'By phone')], ['INSTAGRAM', 'Instagram'], ['FACEBOOK', 'Facebook'], ['REFERRAL', t('რეკომენდაციით', 'Referral')], ['OTHER', t('სხვა', 'Other')]];
const GENDERS = () => [['', t('— არ არის —', '— not set —')], ['F', t('ქალი', 'Female')], ['M', t('კაცი', 'Male')], ['OTHER', t('სხვა', 'Other')]];
const sourceLabel = (s) => SOURCES().find(([k]) => k === s)?.[1] || null;
const age = (ymd) => { if (!ymd) return null; const b = new Date(ymd); const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a -= 1; return a; };
const category = () => state.current?.business?.category || 'OTHER';
const MEDICAL = ['DENTAL', 'CLINIC', 'PHYSIO', 'LAB', 'OPTICS', 'MIND'];

/* ── the segment card: fields per business type, stored in client.card ── */
function cardFields(cat) {
  const sel = (opts) => opts.map(([v, l]) => ({ value: v, label: l }));
  const health = [
    { key: 'allergies', label: t('ალერგიები', 'Allergies'), type: 'text', group: t('ჯანმრთელობა', 'Health') },
    { key: 'contraindications', label: t('უკუჩვენებები', 'Contraindications'), type: 'text', group: t('ჯანმრთელობა', 'Health') },
    { key: 'medications', label: t('მედიკამენტები', 'Medications'), type: 'text', group: t('ჯანმრთელობა', 'Health') },
  ];
  const medical = [
    { key: 'anamnesis', label: t('ანამნეზი', 'History'), type: 'textarea', group: t('სამედიცინო', 'Medical') },
    { key: 'chronic', label: t('ქრონიკული დაავადებები', 'Chronic conditions'), type: 'text', group: t('სამედიცინო', 'Medical') },
    { key: 'insurance', label: t('დაზღვევა / პოლისი', 'Insurance / policy'), type: 'text', group: t('სამედიცინო', 'Medical') },
    { key: 'emergency', label: t('საკონტაქტო პირი და ტელეფონი', 'Emergency contact'), type: 'text', group: t('სამედიცინო', 'Medical') },
  ];
  const prefs = { key: 'prefs', label: t('სურვილები და რას ვერ იტანს', 'Preferences and dislikes'), type: 'textarea', group: t('პრეფერენციები', 'Preferences') };
  switch (cat) {
    case 'DENTAL': return [...health, ...medical, { key: 'pregnancy', label: t('ორსულობა / ლაქტაცია', 'Pregnancy / breastfeeding'), type: 'bool', group: t('სამედიცინო', 'Medical') }];
    case 'CLINIC': return [...health, ...medical, { key: 'bloodType', label: t('სისხლის ჯგუფი', 'Blood type'), type: 'select', options: sel([['', '—'], ['O+', 'O+'], ['O-', 'O−'], ['A+', 'A+'], ['A-', 'A−'], ['B+', 'B+'], ['B-', 'B−'], ['AB+', 'AB+'], ['AB-', 'AB−']]), group: t('სამედიცინო', 'Medical') }];
    case 'PHYSIO': return [...health, ...medical, { key: 'diagnosis', label: t('დიაგნოზი / მიმართვა', 'Diagnosis / referral'), type: 'text', group: t('სამედიცინო', 'Medical') }];
    case 'LAB': return [...health, ...medical];
    case 'OPTICS': return [...health, { key: 'rx', label: t('რეცეპტი OD / OS', 'Prescription OD / OS'), type: 'text', group: t('მხედველობა', 'Vision') }, { key: 'lenses', label: t('ლინზები / სათვალე', 'Lenses / glasses'), type: 'text', group: t('მხედველობა', 'Vision') }, ...medical.slice(2)];
    case 'MIND': return [{ key: 'goal', label: t('თერაპიის მიზანი', 'Therapy goal'), type: 'textarea', group: t('თერაპია', 'Therapy') }, { key: 'medications', label: t('მედიკამენტები', 'Medications'), type: 'text', group: t('თერაპია', 'Therapy') }, ...medical.slice(3)];
    case 'BEAUTY': case 'HAIR': return [
      { key: 'hairType', label: t('თმის ტიპი', 'Hair type'), type: 'select', options: sel([['', '—'], ['STRAIGHT', t('სწორი', 'Straight')], ['WAVY', t('ტალღოვანი', 'Wavy')], ['CURLY', t('ხვეული', 'Curly')], ['COILY', t('აფრო', 'Coily')]]), group: t('თმა', 'Hair') },
      { key: 'scalp', label: t('სკალპი', 'Scalp'), type: 'select', options: sel([['', '—'], ['NORMAL', t('ნორმალური', 'Normal')], ['DRY', t('მშრალი', 'Dry')], ['OILY', t('ცხიმიანი', 'Oily')], ['SENSITIVE', t('მგრძნობიარე', 'Sensitive')]]), group: t('თმა', 'Hair') },
      { key: 'currentColour', label: t('მიმდინარე ფერი', 'Current colour'), type: 'text', group: t('თმა', 'Hair') },
      ...health.slice(0, 1), prefs];
    case 'NAILS': return [{ key: 'nailType', label: t('ფრჩხილის ტიპი', 'Nail type'), type: 'text', group: t('ფრჩხილები', 'Nails') }, { key: 'favColours', label: t('საყვარელი ფერები', 'Favourite colours'), type: 'text', group: t('ფრჩხილები', 'Nails') }, ...health.slice(0, 1), prefs];
    case 'AESTHETIC': return [
      { key: 'skinType', label: t('კანის ტიპი', 'Skin type'), type: 'select', options: sel([['', '—'], ['NORMAL', t('ნორმალური', 'Normal')], ['DRY', t('მშრალი', 'Dry')], ['OILY', t('ცხიმიანი', 'Oily')], ['COMBO', t('კომბინირებული', 'Combination')], ['SENSITIVE', t('მგრძნობიარე', 'Sensitive')]]), group: t('კანი', 'Skin') },
      { key: 'pregnancy', label: t('ორსულობა / ლაქტაცია', 'Pregnancy / breastfeeding'), type: 'bool', group: t('კანი', 'Skin') },
      ...health, prefs];
    case 'SPA': return [{ key: 'pressure', label: t('წნევის პრეფერენცია', 'Pressure'), type: 'select', options: sel([['', '—'], ['LIGHT', t('მსუბუქი', 'Light')], ['MEDIUM', t('საშუალო', 'Medium')], ['FIRM', t('ძლიერი', 'Firm')]]), group: t('მასაჟი', 'Massage') }, { key: 'zones', label: t('პრობლემური ზონები', 'Problem areas'), type: 'text', group: t('მასაჟი', 'Massage') }, ...health.slice(0, 2), prefs];
    case 'TATTOO': return [
      { key: 'adult', label: t('18+ დადასტურებულია (დოკუმენტით)', '18+ verified (ID seen)'), type: 'bool', group: t('თანხმობა', 'Consent') },
      { key: 'consent', label: t('თანხმობის ფორმა ხელმოწერილია', 'Consent form signed'), type: 'bool', group: t('თანხმობა', 'Consent') },
      { key: 'aftercare', label: t('მოვლის ინსტრუქცია მიღებული აქვს', 'Aftercare instructions given'), type: 'bool', group: t('თანხმობა', 'Consent') },
      { key: 'style', label: t('სტილი / ესკიზის ბმული', 'Style / sketch link'), type: 'text', group: t('ტატუ', 'Tattoo') },
      ...health.slice(0, 1), prefs];
    case 'FITNESS': return [{ key: 'goal', label: t('მიზანი', 'Goal'), type: 'text', group: t('ვარჯიში', 'Training') }, { key: 'limits', label: t('ჯანმრთელობის შეზღუდვები', 'Health limits'), type: 'text', group: t('ვარჯიში', 'Training') }, { key: 'body', label: t('სიმაღლე / წონა', 'Height / weight'), type: 'text', group: t('ვარჯიში', 'Training') }, prefs];
    default: return [...health.slice(0, 1), prefs];
  }
}

/* ── tooth chart (dental): FDI numbering, a status and a note per tooth, kept in card.teeth ── */
const TOOTH_STATUS = () => [['OK', t('ჯანმრთელი', 'Healthy')], ['CARIES', t('კარიესი', 'Caries')], ['FILLED', t('ბჟენი', 'Filling')], ['ROOT', t('არხი ნამკურნალები', 'Root canal')], ['CROWN', t('გვირგვინი', 'Crown')], ['IMPLANT', t('იმპლანტი', 'Implant')], ['MISSING', t('აკლია', 'Missing')], ['PLAN', t('სამკურნალო', 'To treat')]];
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

function toothChart(client, save) {
  const teeth = { ...(client.card.teeth || {}) };
  const host = h('div', { class: 'bz-teeth' });
  const paint = () => {
    const row = (nums) => h('div', { class: 'row' }, nums.map((n, i) => {
      const s = teeth[n]?.s || 'OK';
      return h('button', { type: 'button', class: `bz-tooth is-${s.toLowerCase()}${i === 8 ? ' is-mid' : ''}`, title: `${n} · ${TOOTH_STATUS().find(([k]) => k === s)?.[1]}${teeth[n]?.n ? ` · ${teeth[n].n}` : ''}`, onClick: () => edit(n) }, h('i'), h('span', null, String(n)));
    }));
    const counts = TOOTH_STATUS().filter(([k]) => k !== 'OK').map(([k, l]) => [k, l, Object.values(teeth).filter((x) => x?.s === k).length]).filter(([, , n]) => n);
    mount(host, row(UPPER), row(LOWER),
      h('div', { class: 'bz-teeth-legend' }, counts.length ? counts.map(([k, l, n]) => h('span', null, h('i', { class: `is-${k.toLowerCase()}` }), `${l} · ${n}`)) : h('span', { class: 'faint' }, t('დააჭირე კბილს და მიუთითე მდგომარეობა.', 'Click a tooth to set its state.'))));
  };
  const edit = (n) => {
    let s = teeth[n]?.s || 'OK';
    const note = input({ value: teeth[n]?.n || '', placeholder: t('შენიშვნა — მაგ. 2 ზედაპირი, დისტალური', 'Note — e.g. two surfaces, distal') });
    const picks = h('div', { class: 'bz-chips' }, TOOTH_STATUS().map(([k, l]) => h('button', { type: 'button', class: `bz-chip${k === s ? ' on' : ''}`, onClick: (e) => { s = k; picks.querySelectorAll('.bz-chip').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, h('i', { class: `bz-tooth-dot is-${k.toLowerCase()}` }), l)));
    const saveBtn = button(t('შენახვა', 'Save'));
    const m = openModal({ title: t(`კბილი ${n}`, `Tooth ${n}`), size: 'sm', body: h('div', { class: 'form' }, picks, field(t('შენიშვნა', 'Note'), note)), footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), saveBtn] });
    saveBtn.addEventListener('click', () => busy(saveBtn, async () => {
      if (s === 'OK' && !note.value.trim()) delete teeth[n]; else teeth[n] = { s, n: note.value.trim() || undefined };
      try { await save({ teeth }); m.close(); paint(); } catch (e) { fail(e); }
    }));
  };
  paint();
  return host;
}

/* ── dated structured notes: hair colour formulas, injections ── */
const FORMULA_FIELDS = () => [['brand', t('ბრენდი', 'Brand')], ['shade', t('ტონი / ფერი', 'Shade')], ['developer', t('ოქსიდი %', 'Developer %')], ['minutes', t('დრო, წთ', 'Minutes')], ['zones', t('ზონები', 'Zones')]];
const INJECTION_FIELDS = () => [['product', t('პრეპარატი', 'Product')], ['units', t('ერთეული / მლ', 'Units / ml')], ['lot', t('სერია (lot)', 'Lot')], ['zone', t('ზონა', 'Zone')]];

function structuredNotes(kind, client, notes, reload) {
  const fields = kind === 'FORMULA' ? FORMULA_FIELDS() : INJECTION_FIELDS();
  const title = kind === 'FORMULA' ? t('ფერის ფორმულები', 'Colour formulas') : t('ინექციების ჟურნალი', 'Injection log');
  const list = notes.filter((n) => n.kind === kind);
  const add = () => {
    const inputs = fields.map(([k, l]) => [k, input({ placeholder: l })]);
    const text = textarea({ rows: 2, placeholder: t('შენიშვნა', 'Note') });
    const save = button(t('ჩაწერა', 'Add'), { icon: 'check' });
    const m = openModal({ title, size: 'sm', body: h('div', { class: 'form' }, h('div', { class: 'form-row' }, inputs.slice(0, 2).map(([k, el]) => field(fields.find(([f]) => f === k)[1], el))), h('div', { class: 'form-row' }, inputs.slice(2).map(([k, el]) => field(fields.find(([f]) => f === k)[1], el))), field(t('შენიშვნა', 'Note'), text)), footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save] });
    save.addEventListener('click', () => busy(save, async () => {
      const data = Object.fromEntries(inputs.map(([k, el]) => [k, el.value.trim()]).filter(([, v]) => v));
      try { await biz.post(`/clients/${client.id}/notes`, { kind, text: text.value.trim() || undefined, data }); m.close(); ok(t('ჩაიწერა', 'Added')); reload(); } catch (e) { fail(e); }
    }));
  };
  return card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, title), h('div', { class: 'card-sub' }, kind === 'FORMULA' ? t('რა, რამდენი და რამდენ ხანს — შემდეგ ვიზიტზე ზუსტად იგივე შედეგი.', 'What, how much and how long — the same result next time.') : t('პრეპარატი, ერთეულები, სერია, ზონა — ყოველი ინექცია აღრიცხულია.', 'Product, units, lot, zone — every injection on record.'))),
      button(t('ახალი', 'New'), { size: 'sm', icon: 'plus', onClick: add })),
    list.length ? h('div', { class: 'bz-notes' }, list.map((n) => noteRow(n, client, reload, fields))) : h('p', { class: 'bz-sub' }, t('ჯერ არ არის.', 'None yet.')));
}

function noteRow(n, client, reload, fields = null) {
  const data = fields ? fields.map(([k, l]) => (n.data[k] ? h('span', { class: 'bz-tag' }, `${l}: ${n.data[k]}`) : null)) : null;
  const mine = n.createdBy === state.user?.id;
  return h('div', { class: `bz-note-row is-${n.kind.toLowerCase()}` },
    h('div', { class: 'meta' }, h('b', null, n.byName || t('გუნდი', 'Team')), h('span', null, when(n.createdAt)),
      canManage() || mine ? h('button', { type: 'button', class: 'bz-link x', onClick: async () => { if (await confirmDialog({ title: t('ჩანაწერის წაშლა?', 'Delete the entry?'), body: '', confirm: t('წაშლა', 'Delete'), danger: true })) { try { await biz.del(`/clients/${client.id}/notes/${n.id}`); reload(); } catch (e) { fail(e); } } } }, icon('x', { size: 14 })) : null),
    data ? h('div', { class: 'bz-tags' }, data) : null,
    n.text ? h('p', null, n.text) : null);
}

/* ── private photos ── */
export async function blobUrl(path) {
  const res = await fetch(path, { headers: { Authorization: `Bearer ${getToken()}` } });
  if (!res.ok) throw new Error('image');
  return URL.createObjectURL(await res.blob());
}
const FILE_KINDS = () => [['PHOTO', t('ფოტო', 'Photo')], ['BEFORE', t('მანამდე', 'Before')], ['AFTER', t('შემდეგ', 'After')], ['DOC', t('დოკუმენტი', 'Document')]];

function photosTab(client, files, reload) {
  const upload = () => {
    const fileInput = h('input', { type: 'file', accept: 'image/*', multiple: true });
    const kind = select(FILE_KINDS().map(([v, l]) => ({ value: v, label: l })), 'PHOTO');
    const caption = input({ placeholder: t('წარწერა — მაგ. ზედა ყბა, 2 თვის შემდეგ', 'Caption — e.g. upper jaw, two months later') });
    const save = button(t('ატვირთვა', 'Upload'), { icon: 'upload' });
    const m = openModal({ title: t('ფოტო ან დოკუმენტი', 'Photo or document'), size: 'sm', body: h('div', { class: 'form' }, h('p', { class: 'muted' }, t('ფაილები მხოლოდ გუნდს უჩანს — საჯარო გვერდზე არასდროს.', 'Only the team sees these — never the public page.')), field(t('ფაილი', 'File'), fileInput), h('div', { class: 'form-row' }, field(t('ტიპი', 'Kind'), kind), field(t('წარწერა', 'Caption'), caption))), footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save] });
    save.addEventListener('click', () => busy(save, async () => {
      if (!fileInput.files.length) { fail(new Error(t('აირჩიე ფაილი.', 'Choose a file.'))); return; }
      try {
        for (const f of fileInput.files) {
          const form = new FormData(); form.append('file', f); form.append('kind', kind.value); if (caption.value.trim()) form.append('caption', caption.value.trim());
          const res = await fetch(biz.path(`/clients/${client.id}/files`), { method: 'POST', headers: { Authorization: `Bearer ${getToken()}` }, body: form });
          if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || j.message || 'upload'); }
        }
        m.close(); ok(t('აიტვირთა', 'Uploaded')); reload();
      } catch (e) { fail(e); }
    }));
  };
  const grid = h('div', { class: 'bz-cfiles' }, files.map((f) => {
    const img = h('img', { alt: f.caption || '' });
    blobUrl(biz.path(`/clients/${client.id}/files/${f.id}/image`)).then((u) => { img.src = u; }).catch(() => {});
    const kindLabel = FILE_KINDS().find(([k]) => k === f.kind)?.[1] || f.kind;
    return h('figure', { class: `bz-cfile is-${f.kind.toLowerCase()}` },
      h('a', { href: '#', onClick: (e) => { e.preventDefault(); openModal({ title: f.caption || kindLabel, size: 'lg', body: h('div', { class: 'bz-cfile-full' }, h('img', { src: img.src, alt: f.caption || '' })), footer: (close) => [button(t('დახურვა', 'Close'), { onClick: () => close() })] }); } }, img),
      h('figcaption', null, h('span', { class: 'bz-tag' }, kindLabel), h('b', null, f.caption || ''), h('span', { class: 'faint' }, `${dateText(f.createdAt)}${f.byName ? ` · ${f.byName}` : ''}`),
        canManage() || f.createdBy === state.user?.id ? h('button', { type: 'button', class: 'bz-link x', onClick: async () => { if (await confirmDialog({ title: t('ფაილის წაშლა?', 'Delete the file?'), body: f.caption || '', confirm: t('წაშლა', 'Delete'), danger: true })) { try { await biz.del(`/clients/${client.id}/files/${f.id}`); reload(); } catch (e) { fail(e); } } } }, icon('trash', { size: 14 })) : null));
  }));
  return card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('ფოტოები და დოკუმენტები', 'Photos and documents')), h('div', { class: 'card-sub' }, t('მანამდე / შემდეგ, რენტგენი, თანხმობის ფორმა — მხოლოდ გუნდისთვის.', 'Before / after, X-rays, consent forms — team only.'))), button(t('ატვირთვა', 'Upload'), { size: 'sm', icon: 'upload', onClick: upload })),
    files.length ? grid : emptyBox(t('ფოტო ჯერ არ არის', 'No photos yet'), t('პირველი „მანამდე“ ფოტო ყველაზე ძვირფასია — ერთ თვეში შედარება იქნება.', 'The first “before” photo is the most valuable one — in a month you will have a comparison.'), null, 'camera'));
}

/* ── the page ── */
export async function clientCard(root, ctx, id) {
  const context = await loadContext();
  let data;
  try { data = await biz.get(`/clients/${id}`); } catch (e) { mount(root, card(emptyBox(t('კლიენტი ვერ მოიძებნა', 'Client not found'), e?.message))); return; }
  const reload = () => clientCard(root, ctx, id);
  const c = data.client;
  const s = data.stats;
  let tab = clientCard.tab || 'visits';
  const saveCard = async (patch) => { await biz.patch(`/clients/${id}`, { card: patch }); Object.assign(c.card, patch); };

  // header
  const contact = h('div', { class: 'bz-client-contact' },
    c.phone ? h('a', { href: `tel:${c.phone}` }, icon('phone', { size: 15 }), phoneText(c.phone)) : h('span', { class: 'faint' }, icon('phone', { size: 15 }), t('ტელეფონი არ არის', 'No phone')),
    c.email ? h('a', { href: `mailto:${c.email}` }, icon('mail', { size: 15 }), c.email) : null,
    c.birthday ? h('span', null, icon('gift', { size: 15 }), `${dateText(c.birthday)} · ${age(c.birthday)} ${t('წლის', 'y.o.')}`) : null,
    c.address ? h('span', null, icon('mapPin', { size: 15 }), c.address) : null);
  const facts = h('div', { class: 'bz-client-facts' },
    h('span', null, t(`ჩვენთან ${dateText(c.firstVisitAt || c.createdAt)}-დან`, `With us since ${dateText(c.firstVisitAt || c.createdAt)}`)),
    s.favouriteStaff ? h('span', null, t(`ჩვეულებრივ: ${s.favouriteStaff.name}`, `Usually with ${s.favouriteStaff.name}`)) : c.preferredStaffName ? h('span', null, t(`ურჩევნია: ${c.preferredStaffName}`, `Prefers ${c.preferredStaffName}`)) : null,
    s.favouriteService ? h('span', null, t(`ყველაზე ხშირად: ${s.favouriteService.name}`, `Most often: ${s.favouriteService.name}`)) : null);
  const badges = h('div', { class: 'bz-tags' },
    c.inApp ? h('span', { class: 'bz-tag bz-tag-app' }, t('აპის მომხმარებელი', 'App user')) : null,
    sourceLabel(c.source) && !c.inApp ? h('span', { class: 'bz-tag' }, sourceLabel(c.source)) : null,
    ...c.tags.map((tag) => h('span', { class: 'bz-tag' }, tag)));
  const head = card({ class: 'bz-client-head' },
    avatar(c.name, '#64748B', 64),
    h('div', { class: 'who' }, h('h2', null, c.name), badges, contact, facts),
    h('div', { class: 'acts' },
      button(t('ჩაწერა', 'Book'), { icon: 'calendarPlus', onClick: () => newAppointmentDialog(context, { clientId: c.id, clientName: c.name, clientPhone: c.phone || '' }, { onCreated: reload }) }),
      state.current?.business?.modules?.products !== false ? button(t('გაყიდვა', 'Sell'), { variant: 'secondary', icon: 'archive', onClick: () => saleDialog({ clientId: c.id, clientName: c.name }, { onCreated: reload }) }) : null,
      c.phone ? button('SMS', { variant: 'ghost', icon: 'messageText', href: `sms:${c.phone}`, external: true }) : null,
      button(t('რედაქტირება', 'Edit'), { variant: 'ghost', icon: 'edit', onClick: () => clientDialog(c, reload) })));

  // numbers
  const bonusKpi = kpi(t('ბონუსი', 'Bonus'), '…', '');
  biz.get(`/clients/${id}/loyalty`).then((L) => { bonusKpi.replaceWith(kpi(t('ბონუსი', 'Bonus'), gel(L.bonusBalance), L.memberships.filter((m) => m.status === 'ACTIVE').length ? t(`${L.memberships.filter((m) => m.status === 'ACTIVE').length} აბონემენტი`, `${L.memberships.filter((m) => m.status === 'ACTIVE').length} memberships`) : '')); }).catch(() => {});
  const kpis = h('div', { class: 'bz-kpis is-6' },
    kpi(t('ვიზიტები', 'Visits'), String(s.visits), s.cadenceDays ? t(`ყოველ ~${s.cadenceDays} დღეში`, `every ~${s.cadenceDays} days`) : '', true),
    kpi(t('დახარჯული', 'Spent'), gel(s.totalSpent), s.visits ? t(`საშ. ${gel(s.avgCheck)}`, `avg ${gel(s.avgCheck)}`) : ''),
    kpi(t('ბოლო ვიზიტი', 'Last visit'), s.lastVisitAt ? dateText(s.lastVisitAt) : '—', s.daysSinceLast != null ? t(`${s.daysSinceLast} დღის წინ`, `${s.daysSinceLast} days ago`) : ''),
    kpi(t('შემდეგი', 'Next'), s.nextAt ? dateText(s.nextAt) : '—', s.nextAt ? t(`${s.upcomingCount} ჯავშანი`, `${s.upcomingCount} booked`) : s.overdue ? t('დროა ისევ — ჩაწერე', 'Due again — book') : '', false, s.overdue ? 'warn' : ''),
    kpi(t('გაცდენები', 'No-shows'), String(s.noShows), t(`${s.noShowRate}% · ${s.cancelled} გაუქმება`, `${s.noShowRate}% · ${s.cancelled} cancelled`)),
    bonusKpi);

  // tabs
  const counts = { visits: data.appointments.length, card: Object.keys(c.card).filter((k) => k !== 'teeth').length, photos: data.files.length, notes: data.notes.filter((n) => n.kind === 'NOTE').length + (c.notes ? 1 : 0), money: data.payments.length + data.sales.length, comms: data.reviews.length };
  const body = h('div');
  const tabs = () => chips([['visits', t('ვიზიტები', 'Visits'), counts.visits || undefined], ['card', t('ბარათი', 'Card'), counts.card || undefined], ['photos', t('ფოტოები', 'Photos'), counts.photos || undefined], ['notes', t('შენიშვნები', 'Notes'), counts.notes || undefined], ['money', t('ფინანსები', 'Money'), counts.money || undefined], ['comms', t('შეფასებები', 'Reviews'), counts.comms || undefined]], tab, (v) => { tab = v; clientCard.tab = v; mount(tabsHost, tabs()); paintTab(); });
  const tabsHost = h('div', { class: 'bz-toolbar' }, tabs());

  function paintTab() {
    if (tab === 'visits') mount(body, visitsTab());
    else if (tab === 'card') mount(body, cardTab());
    else if (tab === 'photos') mount(body, photosTab(c, data.files, reload));
    else if (tab === 'notes') mount(body, notesTab());
    else if (tab === 'money') mount(body, moneyTab());
    else mount(body, commsTab());
  }

  function visitsTab() {
    const now = new Date();
    const upcoming = data.appointments.filter((a) => ['PENDING', 'CONFIRMED'].includes(a.status) && new Date(a.endsAt) > now).sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
    const history = data.appointments.filter((a) => !upcoming.includes(a));
    let page = visitsTab.page || 1;
    const host = h('div');
    const paintHistory = () => {
      const pg = paginate(history, page, 25);
      mount(host, card({ class: 'flush' }, h('div', { class: 'card-head', style: { padding: '14px 18px 4px' } }, h('div', { class: 'card-title' }, t('ისტორია', 'History')), h('span', { class: 'bz-sub' }, t(`${history.length} ჩანაწერი`, `${history.length} entries`))),
        history.length ? h('div', { class: 'bz-timeline', style: { padding: '0 18px 8px' } }, pg.rows.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: reload }) }))) : h('p', { class: 'bz-sub', style: { padding: '0 18px 14px' } }, t('ჯერ ვიზიტი არ ყოფილა.', 'No visits yet.')),
        history.length > 25 ? pager({ ...pg, size: 25, onPage: (p) => { page = p; visitsTab.page = p; paintHistory(); } }) : null));
    };
    paintHistory();
    return h('div', { class: 'bz-stack' },
      upcoming.length ? card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('მომავალი', 'Upcoming')), h('div', { class: 'bz-timeline' }, upcoming.map((a) => appointmentLine(a, context, { onOpen: (x) => openAppointment(x, context, { onChange: reload }) })))) : null,
      s.overdue && !upcoming.length ? h('div', { class: 'bz-banner is-info', style: { margin: 0 } }, icon('repeat', { size: 20 }), h('p', null, h('b', null, t('დროა ისევ', 'Due again')), t(`ჩვეულებრივ ყოველ ${s.cadenceDays} დღეში მოდის; ბოლო ვიზიტიდან ${s.daysSinceLast} დღე გავიდა.`, `Usually comes every ${s.cadenceDays} days; ${s.daysSinceLast} days since the last visit.`)), button(t('ჩაწერა', 'Book'), { size: 'sm', onClick: () => newAppointmentDialog(context, { clientId: c.id, clientName: c.name, clientPhone: c.phone || '' }, { onCreated: reload }) })) : null,
      host);
  }

  function cardTab() {
    const cat = category();
    const fields = cardFields(cat);
    const groups = [...new Set(fields.map((f) => f.group))];
    const saveField = debounceFn(async (key, value) => { try { await saveCard({ [key]: value }); ok(t('შენახულია', 'Saved')); } catch (e) { fail(e); } }, 500);
    const control = (f) => {
      const v = c.card[f.key];
      if (f.type === 'bool') return h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, f.label)), toggle(Boolean(v), (on) => saveField(f.key, on)));
      if (f.type === 'select') return field(f.label, select(f.options, v ?? '', { onChange: (e) => saveField(f.key, e.target.value || null) }));
      if (f.type === 'textarea') return field(f.label, textarea({ rows: 3, value: v ?? '', onInput: (e) => saveField(f.key, e.target.value.trim() || null) }));
      return field(f.label, input({ value: v ?? '', onInput: (e) => saveField(f.key, e.target.value.trim() || null) }));
    };
    const personal = card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('პირადი', 'Personal')), h('div', { class: 'card-sub' }, t('დაბადების დღე, სქესი, წყარო, მისამართი, საყვარელი ოსტატი — რედაქტირებით.', 'Birthday, gender, source, address, preferred person — in Edit.'))), button(t('რედაქტირება', 'Edit'), { size: 'sm', variant: 'ghost', icon: 'edit', onClick: () => clientDialog(c, reload) })),
      h('dl', { class: 'bz-kv' },
        h('dt', null, t('დაბადების დღე', 'Birthday')), h('dd', null, c.birthday ? `${dateText(c.birthday)} · ${age(c.birthday)}` : h('span', { class: 'bz-dim' }, '—')),
        h('dt', null, t('სქესი', 'Gender')), h('dd', null, GENDERS().find(([k]) => k === c.gender)?.[1] || h('span', { class: 'bz-dim' }, '—')),
        h('dt', null, t('წყარო', 'Source')), h('dd', null, sourceLabel(c.source) || h('span', { class: 'bz-dim' }, '—')),
        h('dt', null, t('მისამართი', 'Address')), h('dd', null, c.address || h('span', { class: 'bz-dim' }, '—')),
        h('dt', null, t('ოსტატი', 'Preferred')), h('dd', null, c.preferredStaffName || h('span', { class: 'bz-dim' }, '—'))));
    const segment = card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('ბარათი', 'Card')), h('div', { class: 'card-sub' }, t('ინახება თავისით. მხოლოდ გუნდი ხედავს.', 'Saves by itself. Team only.')))),
      h('div', { class: 'bz-card-form' }, groups.map((g) => h('div', { class: 'bz-card-group' }, h('div', { class: 'bz-section-label' }, g), fields.filter((f) => f.group === g).map(control)))));
    const extras = [];
    if (cat === 'DENTAL') extras.push(card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('კბილების რუკა', 'Tooth chart')), h('div', { class: 'card-sub' }, t('FDI ნუმერაცია · დააჭირე კბილს.', 'FDI numbering · click a tooth.')))), toothChart(c, saveCard)));
    if (cat === 'BEAUTY' || cat === 'HAIR') extras.push(structuredNotes('FORMULA', c, data.notes, reload));
    if (cat === 'AESTHETIC') extras.push(structuredNotes('INJECTION', c, data.notes, reload));
    return h('div', { class: 'bz-grid' }, h('div', { class: 'bz-stack' }, ...extras, segment), h('div', { class: 'bz-stack' }, personal));
  }

  function notesTab() {
    const pinned = textarea({ rows: 3, value: c.notes || '', placeholder: t('მთავარი შენიშვნა — ყოველთვის თავზე (ალერგია, რა არ უყვარს, როგორ მივმართოთ)', 'The pinned note — always on top (allergy, dislikes, how to address them)') });
    const saved = h('span', { class: 'bz-note' }, t('ინახება თავისით.', 'Saves by itself.'));
    pinned.addEventListener('input', debounceFn(async () => { try { await biz.patch(`/clients/${id}`, { notes: pinned.value }); c.notes = pinned.value; saved.textContent = t('შენახულია ✓', 'Saved ✓'); } catch (e) { fail(e); } }, 600));
    const composer = textarea({ rows: 2, placeholder: t('ახალი ჩანაწერი — რა მოხდა, რა შევთანხმდით…', 'New entry — what happened, what was agreed…') });
    const add = button(t('ჩაწერა', 'Add'), { size: 'sm', icon: 'plus', onClick: () => busy(add, async () => { if (!composer.value.trim()) return; try { await biz.post(`/clients/${id}/notes`, { kind: 'NOTE', text: composer.value.trim() }); ok(t('ჩაიწერა', 'Added')); reload(); } catch (e) { fail(e); } }) });
    const list = data.notes.filter((n) => n.kind === 'NOTE');
    return h('div', { class: 'bz-grid' },
      h('div', { class: 'bz-stack' },
        card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('ჩანაწერები', 'Entries')), h('div', { class: 'bz-composer' }, composer, h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, add)),
          list.length ? h('div', { class: 'bz-notes' }, list.map((n) => noteRow(n, c, reload))) : h('p', { class: 'bz-sub', style: { marginTop: '10px' } }, t('ჯერ ჩანაწერი არ არის — ყოველი ვიზიტის შემდეგ ერთი წინადადება საკმარისია.', 'No entries yet — one sentence after each visit is enough.')))),
      h('div', { class: 'bz-stack' }, card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('მთავარი შენიშვნა', 'Pinned note')), pinned, h('p', { style: { marginTop: '6px' } }, saved))));
  }

  function moneyTab() {
    const pay = data.payments;
    const totals = pay.reduce((sum, p) => sum + (p.amount || 0), 0);
    const payments = card({ class: 'flush' }, h('div', { class: 'card-head', style: { padding: '14px 18px 4px' } }, h('div', { class: 'card-title' }, t('გადახდები ვიზიტებზე', 'Visit payments')), h('span', { class: 'bz-sub' }, gel(totals))),
      pay.length ? h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' }, h('thead', null, h('tr', null, h('th', null, t('როდის', 'When')), h('th', null, t('სერვისი', 'Service')), h('th', null, t('ვინ', 'Who')), h('th', null, t('მეთოდი', 'Method')), h('th', { class: 'num' }, t('თანხა', 'Amount')))),
        h('tbody', null, pay.slice(0, 50).map((p) => h('tr', null, h('td', { class: 'faint' }, dateText(p.at)), h('td', null, p.serviceName), h('td', null, p.staffName || '—'), h('td', null, p.parts && (p.parts.giftAmount || p.parts.bonusAmount || p.parts.membershipAmount) ? t('შერეული', 'Mixed') : methodLabel(p.method)), h('td', { class: 'num' }, h('b', null, gel(p.amount)))))))) : h('p', { class: 'bz-sub', style: { padding: '0 18px 14px' } }, t('ჯერ გადახდა არ ყოფილა.', 'No payments yet.')));
    const sales = card({ class: 'flush' }, h('div', { class: 'card-head', style: { padding: '14px 18px 4px' } }, h('div', { class: 'card-title' }, t('ნაყიდი პროდუქტები', 'Products bought')), h('span', { class: 'bz-sub' }, gel(data.sales.filter((x) => x.status === 'DONE').reduce((sum, x) => sum + x.total, 0)))),
      data.sales.length ? h('div', { class: 'bz-table-wrap' }, h('table', { class: 'bz-table' }, h('thead', null, h('tr', null, h('th', null, t('როდის', 'When')), h('th', null, t('რა', 'What')), h('th', { class: 'num' }, t('სულ', 'Total')))),
        h('tbody', null, data.sales.map((x) => h('tr', { class: x.status === 'REFUNDED' ? 'is-muted' : '' }, h('td', { class: 'faint' }, dateText(x.at)), h('td', null, x.items.map((i) => `${i.name}${i.qty !== 1 ? ` ×${i.qty}` : ''}`).join(', ')), h('td', { class: 'num' }, h('b', null, gel(x.total)))))))) : h('p', { class: 'bz-sub', style: { padding: '0 18px 14px' } }, t('ჯერ არაფერი უყიდია.', 'Nothing bought yet.')));
    return h('div', { class: 'bz-grid' }, h('div', { class: 'bz-stack' }, payments, sales), h('div', { class: 'bz-stack' }, loyaltyCard(c, reload)));
  }

  function commsTab() {
    return card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('შეფასებები', 'Reviews')),
      data.reviews.length ? data.reviews.map((r) => h('div', { class: 'bz-review' }, avatar(c.name, '#64748B', 40), h('div', { class: 'bz-review-body' }, h('div', { class: 'meta' }, h('span', { class: 'bz-stars' }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= r.rating ? '' : 'off' }, icon('star', { size: 13 })))), h('span', null, dateText(r.createdAt)), h('span', { class: 'svc' }, r.serviceName || '')), r.text ? h('p', { class: 'text' }, r.text) : null, r.reply ? h('div', { class: 'bz-reply' }, h('span', { class: 'lbl' }, t('თქვენი პასუხი', 'Your reply')), h('span', { class: 'what' }, r.reply)) : null))) : h('p', { class: 'bz-sub' }, t('ჯერ შეფასება არ დაუტოვებია.', 'No reviews yet.')));
  }

  mount(root,
    h('a', { class: 'back', href: '/business/clients', 'data-link': '' }, icon('chevronLeft', { size: 16 }), vocab('clients')),
    h('div', { class: 'bz-stack' }, head, kpis, tabsHost, body));
  paintTab();
}

/** Bonus balance with a correction, the passes the client holds, gift cards they bought. Loads by itself. */
function loyaltyCard(c, reload) {
  const host = card(h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' })));
  biz.get(`/clients/${c.id}/loyalty`).then((L) => {
    const live = L.memberships.filter((m) => m.status === 'ACTIVE');
    mount(host,
      h('div', { class: 'card-head' }, h('div', { class: 'card-title' }, t('ლოიალობა', 'Loyalty')),
        canManage() ? button(t('კორექცია', 'Adjust'), { size: 'sm', variant: 'ghost', icon: 'edit', onClick: () => {
          const amount = input({ type: 'number', step: '0.5', placeholder: t('+10 ან −5', '+10 or −5') });
          const note = input({ placeholder: t('მიზეზი', 'Reason') });
          const save = button(t('შენახვა', 'Save'));
          const m = openModal({ title: t('ბონუსის კორექცია', 'Adjust bonus'), size: 'sm', body: h('div', { class: 'form' }, h('p', { class: 'muted' }, t(`ახლა: ${gel(L.bonusBalance)}`, `Now: ${gel(L.bonusBalance)}`)), field(t('თანხა, ₾ (მინუსით — ჩამოჭრა)', 'Amount, ₾ (minus to deduct)'), amount), field(t('მიზეზი', 'Reason'), note)), footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save] });
          save.addEventListener('click', () => busy(save, async () => { try { await biz.post(`/clients/${c.id}/bonus`, { amount: Number(amount.value), note: note.value.trim() || undefined }); m.close(); ok(t('შენახულია', 'Saved')); reload(); } catch (e) { fail(e); } }));
        } }) : null),
      h('dl', { class: 'bz-kv', style: { gridTemplateColumns: '1fr auto' } },
        h('dt', null, t('ბონუსი', 'Bonus')), h('dd', null, h('b', null, gel(L.bonusBalance))),
        h('dt', null, t('აბონემენტები', 'Memberships')), h('dd', null, live.length ? live.map((m) => h('div', null, `${m.title} · ${m.kind === 'VISITS' ? t(`დარჩა ${m.visitsLeft}`, `${m.visitsLeft} left`) : gel(m.amountLeft)} · ${dateText(m.endsOn)}`)) : h('span', { class: 'bz-dim' }, '—')),
        L.giftCards.length ? [h('dt', null, t('ბარათები', 'Gift cards')), h('dd', null, L.giftCards.slice(0, 5).map((g) => h('div', null, h('code', { class: 'bz-code' }, g.code), ` · ${gel(g.balance)} / ${gel(g.amount)}`)))] : null),
      L.ledger.length ? h('div', { class: 'bz-note', style: { marginTop: '8px' } }, t(`ბოლო: ${L.ledger[0].kind === 'BONUS_EARN' ? 'დაერიცხა' : L.ledger[0].kind === 'BONUS_REDEEM' ? 'დახარჯა' : 'მოძრაობა'} ${gel(Math.abs(L.ledger[0].amount))} · ${dateText(L.ledger[0].createdAt)}`, `Last: ${L.ledger[0].kind === 'BONUS_EARN' ? 'earned' : L.ledger[0].kind === 'BONUS_REDEEM' ? 'spent' : 'moved'} ${gel(Math.abs(L.ledger[0].amount))} · ${dateText(L.ledger[0].createdAt)}`)) : null);
  }).catch((e) => mount(host, h('div', { class: 'card-title' }, t('ლოიალობა', 'Loyalty')), h('p', { class: 'bz-sub' }, e?.message || '')));
  return host;
}

/** Add or edit a client: the basics plus birthday, gender, source, address and the preferred person. */
export function clientDialog(client, onSaved) {
  const name = input({ value: client?.name || '', required: true, placeholder: t('სახელი გვარი', 'Full name') });
  const phone = input({ type: 'tel', value: client?.phone || '', placeholder: '5XX XXX XXX' });
  const email = input({ type: 'email', value: client?.email || '' });
  const birthday = dateField({ value: client?.birthday || '' });
  const gender = select(GENDERS().map(([v, l]) => ({ value: v, label: l })), client?.gender || '');
  const source = select([{ value: '', label: t('— არ არის —', '— not set —') }, ...SOURCES().map(([v, l]) => ({ value: v, label: l }))], client?.source || '');
  const address = input({ value: client?.address || '', placeholder: t('ქუჩა, უბანი', 'Street, district') });
  const staffSel = select([{ value: '', label: t('— ნებისმიერი —', '— anyone —') }], client?.preferredStaffId || '');
  biz.get('/staff').then(({ staff }) => staffSel.setOptions([{ value: '', label: t('— ნებისმიერი —', '— anyone —') }, ...staff.filter((x) => x.active).map((x) => ({ value: x.id, label: x.name }))])).catch(() => {});
  const notes = textarea({ rows: 2, value: client?.notes || '', placeholder: t('მთავარი შენიშვნა — ალერგია, სურვილები…', 'Pinned note — allergy, preferences…') });
  const tags = input({ value: (client?.tags || []).join(', '), placeholder: t('VIP, ახალი, მეგობრის რეკომენდაცია… (მძიმით)', 'VIP, new, referred… (comma-separated)') });
  const save = button(t('შენახვა', 'Save'));
  const m = openModal({
    title: client ? t(`${vocab('client')} — რედაქტირება`, `Edit ${vocab('client').toLowerCase()}`) : vocab('newClient'),
    body: h('div', { class: 'form' },
      field(t('სახელი', 'Name'), name),
      h('div', { class: 'form-row' }, field(t('ტელეფონი', 'Phone'), phone), field(t('ელ-ფოსტა', 'Email'), email)),
      h('div', { class: 'form-row' }, field(t('დაბადების დღე', 'Birthday'), birthday.el), field(t('სქესი', 'Gender'), gender)),
      h('div', { class: 'form-row' }, field(t('საიდან მოვიდა', 'Source'), source), field(t('საყვარელი ოსტატი', 'Preferred person'), staffSel)),
      field(t('მისამართი', 'Address'), address),
      field(t('მთავარი შენიშვნა', 'Pinned note'), notes), field(t('ტეგები', 'Tags'), tags)),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
  });
  save.addEventListener('click', () => busy(save, async () => {
    try {
      const body = { name: name.value.trim(), phone: phone.value.trim() || null, email: email.value.trim() || null, notes: notes.value.trim() || null, tags: tags.value.split(',').map((x) => x.trim()).filter(Boolean), birthday: birthday.get() || null, gender: gender.value || null, source: source.value || null, address: address.value.trim() || null, preferredStaffId: staffSel.value || null };
      const res = client ? await biz.patch(`/clients/${client.id}`, body) : await biz.post('/clients', body);
      m.close();
      ok(t('შენახულია', 'Saved'));
      onSaved?.(res.client);
    } catch (e) { fail(e); }
  }));
}

function kpi(label, value, delta, accent = false, tone = '') {
  return h('div', { class: `bz-kpi${accent ? ' is-accent' : ''}${tone ? ` is-${tone}` : ''}` }, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value' }, value), delta ? h('div', { class: 'stat-delta' }, delta) : null);
}

export { pageHead, D };
