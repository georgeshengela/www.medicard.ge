// MEDIBOOK business panel — /start: claim a listed business or register a new one; pending claims.
import { h, mount, icon, button, busy, field, input, textarea, select, segmented, badge, pageHead, card, toast, debounce } from '/app/js/ui.js';
import { get, post } from '/app/js/api.js';
import { t } from '/app/js/i18n.js';
import { loadState, state, switchBusiness } from '../state.js';
import { CATEGORIES, categoryLabel, categoryColor, hoursEditor, loadMapbox, fail, ok } from '../shared.js';

const TBILISI = [44.8271, 41.7151];

export default async function startPage(root, ctx) {
  let intent = 'claim';
  try { intent = sessionStorage.getItem('medicard.business.intent') || 'claim'; sessionStorage.removeItem('medicard.business.intent'); } catch { /* ignore */ }
  if (ctx.query.mode === 'register' || ctx.query.mode === 'claim') intent = ctx.query.mode;
  const wrap = h('div', { class: 'bz-start' });
  mount(root, wrap);

  const pending = state.claims.filter((c) => c.status === 'PENDING');
  const rejected = state.claims.filter((c) => c.status === 'REJECTED').slice(0, 3);
  const body = h('div');
  const seg = segmented([
    { value: 'claim', label: t('ბიზნესის დადასტურება', 'Claim a business') },
    { value: 'register', label: t('ახალი რეგისტრაცია', 'Register a new one') },
  ], intent, (v) => { intent = v; paint(); });

  mount(wrap,
    pageHead(state.memberships.length ? t('სხვა ბიზნესის დამატება', 'Add another business') : t('შენი ბიზნესი MEDICARD-ზე', 'Your business on MEDICARD'),
      t('მოძებნე კატალოგში და დაადასტურე, რომ შენია — ან დაარეგისტრირე ახალი. განაცხადს ვამოწმებთ 1 სამუშაო დღეში.', 'Find it in the catalogue and confirm it is yours — or register a new one. We review every claim within a working day.'),
      state.memberships.length ? button(t('პანელზე დაბრუნება', 'Back to the panel'), { variant: 'ghost', icon: 'chevronLeft', onClick: () => ctx.navigate('/') }) : null),
    pending.length ? card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('შენი განაცხადები', 'Your claims')), h('div', { class: 'card-sub' }, t('დადასტურების შემდეგ ბიზნესი პანელში გამოჩნდება და შეტყობინება მოგივა.', 'Once approved, the business appears in your panel and you get a notification.')))),
      pending.map((c) => h('div', { class: 'bz-pending' }, icon('clock', { size: 20 }), h('div', { style: { flex: 1 } }, h('b', null, c.business.name), h('div', { class: 'bz-sub' }, `${categoryLabel(c.business.category)}${c.business.address ? ` · ${c.business.address}` : ''}`)), badge(t('განიხილება', 'Under review'), 'warn')))) : null,
    rejected.length ? card(h('div', { class: 'card-title' }, t('უარყოფილი განაცხადები', 'Declined claims')),
      rejected.map((c) => h('div', { class: 'bz-pending' }, icon('alert', { size: 20 }), h('div', { style: { flex: 1 } }, h('b', null, c.business.name), h('div', { class: 'bz-sub' }, c.reviewNote || t('მიზეზი არ არის მითითებული. მოგვწერე support@medicard.ge.', 'No reason given. Write to support@medicard.ge.'))), badge(t('უარყოფილი', 'Declined'), 'danger')))) : null,
    h('div', { style: { margin: '10px 0 16px' } }, seg),
    body);

  function paint() {
    if (intent === 'claim') renderClaim(body, ctx, () => { intent = 'register'; seg.querySelectorAll('button')[1].click(); });
    else renderRegister(body, ctx, prefill);
  }
  let prefill = null;
  paint();
  return () => {};

  function renderRegister(container, c2, pre) { return registerForm(container, c2, pre); }
  function renderClaim(container, c2, toRegister) { return claimFlow(container, c2, (place) => { prefill = place; toRegister(); }); }
}

/* ── Claim ─────────────────────────────────────────────── */
function claimFlow(container, ctx, onRegisterFromPlace) {
  const q = input({ type: 'search', placeholder: t('ბიზნესის სახელი ან მისამართი…', 'Business name or address…'), autocomplete: 'off' });
  const results = h('div', { style: { marginTop: '12px' } });
  const external = h('div', { style: { marginTop: '18px' } });
  let coords = null;
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => { coords = { lat: p.coords.latitude, lng: p.coords.longitude }; }, () => {}, { timeout: 4000, maximumAge: 600000 });

  const search = debounce(async () => {
    const term = q.value.trim();
    mount(external);
    if (term.length < 2) { mount(results, h('p', { class: 'bz-sub' }, t('ჩაწერე სახელი — ვაჩვენებ, რაც კატალოგში გვაქვს.', 'Type a name — we show what the catalogue has.'))); return; }
    mount(results, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const { businesses } = await get('/api/business/search', { q: term, lat: coords?.lat, lng: coords?.lng });
      if (!businesses.length) {
        mount(results, h('div', { class: 'bz-empty' }, icon('search', { size: 22 }), h('strong', null, t('კატალოგში ვერ მოიძებნა', 'Not in the catalogue')), h('span', null, t('ვნახოთ რუკის მონაცემებში — თუ იქ არის, ერთი დაჭერით დარეგისტრირდება.', 'Let us look at map data — if it is there, it registers with one click.'))));
      } else {
        mount(results, businesses.map((b) => resultRow(b, {
          right: b.claimed ? badge(t('უკვე დადასტურებულია', 'Already claimed'), 'neutral') : button(t('ეს ჩემია', 'This is mine'), { size: 'sm', onClick: () => claimDialog(b, ctx) }),
        })));
      }
      // Map providers know more places than our catalogue: offer them as a registration shortcut.
      const { places } = await get('/api/business/external', { q: term, lat: coords?.lat, lng: coords?.lng });
      const fresh = places.filter((p) => !businesses.some((b) => b.name.toLowerCase() === String(p.name).toLowerCase() && Math.abs((b.lat ?? 0) - p.lat) < 0.002));
      if (fresh.length) {
        mount(external,
          h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('რუკაზე მოიძებნა', 'Found on the map')),
          h('p', { class: 'bz-sub', style: { marginBottom: '10px' } }, t('ეს ადგილები ჩვენს კატალოგში ჯერ არ არის. აირჩიე შენი — რეგისტრაციის ფორმა შევსებული დაგხვდება.', 'These places are not in our catalogue yet. Pick yours — the registration form comes prefilled.')),
          fresh.map((p) => resultRow({ name: p.name, categoryLabel: categoryLabel(p.category), category: p.category, address: p.address, phone: p.phone }, { right: button(t('რეგისტრაცია', 'Register'), { size: 'sm', variant: 'secondary', onClick: () => onRegisterFromPlace(p) }) })));
      }
    } catch (e) {
      mount(results, h('div', { class: 'form-error' }, e?.message || t('ძებნა ვერ შესრულდა.', 'Search failed.')));
    }
  }, 320);
  q.addEventListener('input', search);

  mount(container,
    card(
      field(t('მოძებნე შენი ბიზნესი', 'Find your business'), q, t('კატალოგში უკვე 1000+ ადგილია — სტომატოლოგიები, სალონები, კლინიკები, სპა.', 'The catalogue already holds 1000+ places — dental clinics, salons, clinics, spas.')),
      results,
      external,
      h('p', { class: 'bz-note', style: { marginTop: '16px' } }, t('ვერ პოულობ? ', 'Cannot find it? '), h('button', { type: 'button', class: 'bz-link', onClick: () => onRegisterFromPlace(null) }, t('დაარეგისტრირე ახალი ბიზნესი', 'Register a new business')))));
  setTimeout(() => q.focus(), 50);
  search();
}

function resultRow(b, { right }) {
  return h('div', { class: 'bz-result' },
    h('span', { class: 'bz-avatar', style: { width: '40px', height: '40px', background: categoryColor(b.category) } }, icon('mapPin', { size: 18 })),
    h('div', { class: 'main' }, h('b', null, b.name), h('span', null, [b.categoryLabel, b.address, b.phone].filter(Boolean).join(' · '))),
    right);
}

function claimDialog(b, ctx) {
  const err = h('div', { class: 'form-error', hidden: true });
  const position = select([
    { value: 'owner', label: t('მფლობელი', 'Owner') }, { value: 'director', label: t('დირექტორი / მენეჯერი', 'Director / manager') },
    { value: 'admin', label: t('ადმინისტრატორი', 'Administrator') }, { value: 'other', label: t('სხვა', 'Other') },
  ], 'owner');
  const phone = input({ type: 'tel', placeholder: t('ბიზნესის ტელეფონი (არასავალდებულო)', 'Business phone (optional)'), value: b.phone || '' });
  const web = input({ placeholder: t('ვებსაიტი ან Instagram (არასავალდებულო)', 'Website or Instagram (optional)') });
  const note = textarea({ rows: 3, placeholder: t('როგორ დავადასტუროთ, რომ შენია? მაგ. „დარეკეთ ბიზნესის ნომერზე“, „ჩვენი Facebook-იდან მოგწერთ“…', 'How can we check it is yours? e.g. "call the business number", "we will message you from our Facebook page"…') });
  const submit = button(t('განაცხადის გაგზავნა', 'Send the claim'), { type: 'submit' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    await busy(submit, async () => {
      try {
        await post('/api/business/claims', { businessId: b.id, proof: { position: position.value, phone: phone.value.trim(), website: web.value.trim() }, note: note.value.trim() });
        close();
        ok(t('განაცხადი გაიგზავნა. შემოწმების შემდეგ შეტყობინება მოგივა.', 'Claim sent. You will hear from us once it is checked.'));
        await loadState();
        ctx.navigate('/start', { replace: true });
      } catch (e2) { err.textContent = e2?.message || t('ვერ გაიგზავნა.', 'Could not send.'); err.hidden = false; }
    });
  } },
  h('div', { class: 'bz-result', style: { border: 0, background: 'var(--bg)' } }, h('div', { class: 'main' }, h('b', null, b.name), h('span', null, [b.categoryLabel, b.address].filter(Boolean).join(' · ')))),
  field(t('შენი როლი ბიზნესში', 'Your role at the business'), position),
  field(t('საკონტაქტო ტელეფონი', 'Contact phone'), phone),
  field(t('ვებსაიტი / Instagram', 'Website / Instagram'), web),
  field(t('შენიშვნა', 'Note'), note),
  err, h('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } }, button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), submit));
  let close = () => {};
  import('/app/js/ui.js').then(({ openModal }) => { const m = openModal({ title: t('ბიზნესის დადასტურება', 'Claim the business'), body: form }); close = m.close; });
}

/* ── Register ──────────────────────────────────────────── */
function registerForm(container, ctx, pre) {
  const err = h('div', { class: 'form-error', hidden: true });
  const nameKa = input({ placeholder: t('მაგ. სტომატოლოგიური კლინიკა „დენტა“', 'e.g. Denta Dental Clinic'), required: true, value: pre?.name || '' });
  const name = input({ placeholder: t('ლათინურად (აპის ინგლისური ვერსიისთვის)', 'In Latin letters (for the English app)'), value: pre?.name || '' });
  const category = select(CATEGORIES.filter(([k]) => k !== 'OTHER').map(([value, label]) => ({ value, label })), pre?.category && pre.category !== 'OTHER' ? pre.category : 'DENTAL');
  const phone = input({ type: 'tel', placeholder: '5XX XXX XXX / 032 2 XX XX XX', value: pre?.phone || '' });
  const email = input({ type: 'email', placeholder: t('ჯავშნების შეტყობინებებისთვის', 'For booking notifications') });
  const website = input({ placeholder: 'https://…', value: pre?.website || '' });
  const instagram = input({ placeholder: '@salon' });
  const address = input({ placeholder: t('ქუჭა, ნომერი, ქალაქი', 'Street, number, city'), value: pre?.address || '', autocomplete: 'off' });
  const city = input({ placeholder: t('თბილისი', 'Tbilisi'), value: pre?.city || '' });
  const description = textarea({ rows: 4, placeholder: t('რას აკეთებთ, რით გამოირჩევით, რა უნდა იცოდეს კლიენტმა მოსვლამდე.', 'What you do, what sets you apart, what a client should know before coming.') });
  const geoList = h('div', { class: 'bz-geo-list' });
  const mapEl = h('div', { class: 'bz-map' });
  const hours = hoursEditor(pre?.hours && Object.keys(pre.hours).length ? pre.hours : { 1: [{ from: '10:00', to: '19:00' }], 2: [{ from: '10:00', to: '19:00' }], 3: [{ from: '10:00', to: '19:00' }], 4: [{ from: '10:00', to: '19:00' }], 5: [{ from: '10:00', to: '19:00' }], 6: [{ from: '11:00', to: '17:00' }], 0: [] });
  let coords = pre?.lat != null ? { lat: pre.lat, lng: pre.lng } : null;
  let marker = null;
  let map = null;
  const coordsLine = h('p', { class: 'bz-note' });
  const paintCoords = () => { coordsLine.textContent = coords ? t(`მონიშნულია: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — გადაათრიე პინი, თუ ზუსტად არ დგას.`, `Pinned: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} — drag the pin if it is not exact.`) : t('ჩაწერე მისამართი და აირჩიე ვარიანტი, ან დააჭირე რუკაზე.', 'Type the address and pick a suggestion, or click the map.'); };
  paintCoords();

  loadMapbox().then((mapboxgl) => {
    if (!state.mapboxToken) return;
    mapboxgl.accessToken = state.mapboxToken;
    map = new mapboxgl.Map({ container: mapEl, style: document.documentElement.dataset.theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11', center: coords ? [coords.lng, coords.lat] : TBILISI, zoom: coords ? 15 : 11, attributionControl: false });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    const place = (lng, lat, fly) => {
      coords = { lat, lng };
      if (!marker) { marker = new mapboxgl.Marker({ color: '#7A58C9', draggable: true }).setLngLat([lng, lat]).addTo(map); marker.on('dragend', () => { const p = marker.getLngLat(); coords = { lat: p.lat, lng: p.lng }; paintCoords(); }); }
      else marker.setLngLat([lng, lat]);
      if (fly) map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 15) });
      paintCoords();
    };
    if (coords) place(coords.lng, coords.lat, false);
    map.on('click', (e) => place(e.lngLat.lng, e.lngLat.lat, false));
    mapEl._place = place;
  }).catch(() => mount(mapEl, h('div', { class: 'bz-empty' }, h('span', null, t('რუკა ვერ ჩაიტვირთა — მისამართი მაინც ჩაწერე.', 'The map could not load — type the address anyway.')))));

  const geocode = debounce(async () => {
    const term = address.value.trim();
    if (term.length < 4) { mount(geoList); return; }
    try {
      const { results } = await get('/api/business/geocode', { q: term });
      mount(geoList, results.slice(0, 5).map((r) => h('button', { type: 'button', onClick: () => {
        address.value = r.label;
        if (r.city && !city.value) city.value = r.city;
        if (mapEl._place) mapEl._place(r.lng, r.lat, true); else { coords = { lat: r.lat, lng: r.lng }; paintCoords(); }
        mount(geoList);
      } }, icon('mapPin', { size: 14 }), ' ', r.label)));
    } catch { mount(geoList); }
  }, 350);
  address.addEventListener('input', geocode);

  const submit = button(t('რეგისტრაცია', 'Register'), { type: 'submit', size: 'lg' });
  const form = h('form', { class: 'form', onSubmit: async (e) => {
    e.preventDefault();
    err.hidden = true;
    if (!coords) { err.textContent = t('მონიშნე მდებარეობა რუკაზე — კლიენტები ასე გპოულობენ.', 'Mark the location on the map — this is how clients find you.'); err.hidden = false; return; }
    await busy(submit, async () => {
      try {
        const similar = await get('/api/business/similar', { name: nameKa.value.trim(), lat: coords.lat, lng: coords.lng }).catch(() => ({ businesses: [] }));
        if (similar.businesses?.length && !form.dataset.confirmed) {
          const { confirmDialog } = await import('/app/js/ui.js');
          const go = await confirmDialog({ title: t('მსგავსი ადგილი უკვე არის კატალოგში', 'A similar place is already in the catalogue'), body: t(`„${similar.businesses[0].name}“ იმავე მისამართზეა. თუ ეს შენი ბიზნესია, ჯობს დაადასტურო, რომ ორი ჩანაწერი არ გაჩნდეს. მაინც დავარეგისტრირო ახალი?`, `"${similar.businesses[0].name}" sits at the same address. If that is your business, claiming it avoids a duplicate. Register a new one anyway?`), confirm: t('მაინც რეგისტრაცია', 'Register anyway') });
          if (!go) return;
          form.dataset.confirmed = '1';
        }
        const res = await post('/api/business/register', {
          business: {
            nameKa: nameKa.value.trim(), name: (name.value.trim() || nameKa.value.trim()), category: category.value,
            phone: phone.value.trim(), email: email.value.trim(), website: website.value.trim(), instagram: instagram.value.trim(),
            addressKa: address.value.trim(), address: address.value.trim(), city: city.value.trim(), lat: coords.lat, lng: coords.lng,
            hours: hours.value(), descriptionKa: description.value.trim(), description: description.value.trim(),
          },
          externalRef: pre?.ref || undefined,
        });
        ok(t('ბიზნესი დარეგისტრირდა. პანელი უკვე მუშაობს; კატალოგში დადასტურების შემდეგ გამოჩნდება.', 'Registered. The panel works right away; the listing goes live once approved.'));
        await loadState();
        switchBusiness(res.business.id);
        ctx.navigate('/', { replace: true });
      } catch (e2) { err.textContent = e2?.message || t('რეგისტრაცია ვერ შესრულდა.', 'Registration failed.'); err.hidden = false; }
    });
  } },
  h('div', { class: 'card-title' }, t('ძირითადი', 'Basics')),
  h('div', { class: 'form-row' }, field(t('სახელი ქართულად', 'Name in Georgian'), nameKa), field(t('სახელი ლათინურად', 'Name in Latin letters'), name)),
  h('div', { class: 'form-row' }, field(t('კატეგორია', 'Category'), category), field(t('ქალაქი', 'City'), city)),
  h('div', { class: 'card-title', style: { marginTop: '8px' } }, t('კონტაქტი', 'Contact')),
  h('div', { class: 'form-row' }, field(t('ტელეფონი', 'Phone'), phone), field(t('ელ-ფოსტა', 'Email'), email, t('აქ მოგივა ახალი ჯავშნის და გაუქმების წერილი.', 'New-booking and cancellation emails land here.'))),
  h('div', { class: 'form-row' }, field(t('ვებსაიტი', 'Website'), website), field('Instagram', instagram)),
  h('div', { class: 'card-title', style: { marginTop: '8px' } }, t('მისამართი და რუკა', 'Address and map')),
  field(t('მისამართი', 'Address'), address), geoList, mapEl, coordsLine,
  h('div', { class: 'card-title', style: { marginTop: '8px' } }, t('სამუშაო საათები', 'Opening hours')),
  hours.el,
  h('div', { class: 'card-title', style: { marginTop: '8px' } }, t('აღწერა', 'About')),
  field(t('რამდენიმე წინადადება', 'A few sentences'), description),
  err,
  h('p', { class: 'bz-note' }, t('რეგისტრაციით ადასტურებ, რომ ამ ბიზნესის წარმომადგენელი ხარ. განაცხადს ვამოწმებთ 1 სამუშაო დღეში; პანელი მანამდეც მუშაობს.', 'By registering you confirm that you represent this business. We review within a working day; the panel works meanwhile.')),
  h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, submit));
  mount(container, card(form));
  setTimeout(() => nameKa.focus(), 50);
}

export { toast, fail };
