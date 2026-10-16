// MEDIBOOK business panel — settings: the public page (names, contacts, address, hours, pictures) and booking rules.
import { h, mount, icon, button, pageHead, card, input, textarea, field, busy, toggle, confirmDialog, debounce, openModal } from '/app/js/ui.js';
import { select } from '../fields.js';
import { get, request } from '/app/js/api.js';
import { t } from '/app/js/i18n.js';
import { state, loadState } from '../state.js';
import { biz, CATEGORIES, hoursEditor, loadMapbox, fail, ok, emptyBox } from '../shared.js';

/** The panel modules a business may switch: label, one line, and the page it opens. */
const MODULES = [
  ['products', () => t('პროდუქტები და გაყიდვები', 'Products and sales'), () => t('რასაც დახლთან ყიდი — მარაგი, ჩეკი, დაბრუნება', 'What you sell over the counter — stock, receipts, refunds')],
  ['supplies', () => t('საწყობი', 'Stock room'), () => t('მასალები, ნორმები, ვიზიტის ავტომატური ჩამოწერა', 'Supplies, norms, automatic write-off per visit')],
  ['resources', () => t('ოთახები და აპარატურა', 'Rooms and equipment'), () => t('რესურსები, რომლებსაც სერვისი იკავებს', 'Resources a service occupies')],
  ['loyalty', () => t('ლოიალობა', 'Loyalty'), () => t('ქეშბექი, სასაჩუქრე ბარათები, აბონემენტები', 'Cashback, gift cards, memberships')],
  ['payroll', () => t('ხელფასები', 'Payroll'), () => t('წესები, დარიცხვა, გადახდები', 'Rules, earnings, payouts')],
  ['waitlist', () => t('მოლოდინის სია', 'Waiting list'), () => t('ვინც თავისუფალ დროს ელოდება', 'People waiting for a slot')],
  ['discounts', () => t('ფასდაკლებები', 'Discounts'), () => t('აქციები, happy hours, პრომოკოდები', 'Promotions, happy hours, codes')],
  ['branches', () => t('ფილიალები', 'Branches'), () => t('ერთი ბრენდი, რამდენიმე მისამართი', 'One brand, several locations')],
];
import { qrMatrix } from '/app/js/pages/coachQr.js';

export default async function settingsPage(root, ctx) {
  const data = await biz.get('');
  const b = data.business;
  const reload = async () => { await loadState(); ctx.refreshShell?.(); settingsPage(root, ctx); };

  // ── public page ──
  const nameKa = input({ value: b.nameKa || b.nameEn || '' });
  const name = input({ value: b.nameEn || '' });
  const category = select(CATEGORIES.map(([value, label]) => ({ value, label })), b.category);
  const phone = input({ type: 'tel', value: b.phone || '' });
  const email = input({ type: 'email', value: b.email || '' });
  const website = input({ value: b.website || '' });
  const instagram = input({ value: b.instagram || '' });
  const facebook = input({ value: b.facebook || '' });
  const address = input({ value: b.addressKa || b.addressEn || '', autocomplete: 'off' });
  const city = input({ value: b.city || '' });
  const district = input({ value: b.district || '' });
  const descriptionKa = textarea({ rows: 4, value: b.descriptionKa || b.descriptionEn || '' });
  const descriptionEn = textarea({ rows: 3, value: b.descriptionEn || '', placeholder: t('ინგლისურად (არასავალდებულო)', 'In English (optional)') });
  const tags = input({ value: (b.tags || []).join(', '), placeholder: t('ბავშვთა, ლაზერი, 24/7… (მძიმით)', 'kids, laser, 24/7… (comma-separated)') });
  const hours = hoursEditor(b.hours || {});
  const mapEl = h('div', { class: 'bz-map' });
  const geoList = h('div', { class: 'bz-geo-list' });
  let coords = b.lat != null ? { lat: b.lat, lng: b.lng } : null;
  loadMapbox().then((mapboxgl) => {
    if (!state.mapboxToken) return;
    mapboxgl.accessToken = state.mapboxToken;
    const map = new mapboxgl.Map({ container: mapEl, style: document.documentElement.dataset.theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11', center: coords ? [coords.lng, coords.lat] : [44.8271, 41.7151], zoom: coords ? 15 : 11, attributionControl: false });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');
    let marker = null;
    const place = (lng, lat, fly) => { coords = { lat, lng }; if (!marker) { marker = new mapboxgl.Marker({ color: '#7A58C9', draggable: true }).setLngLat([lng, lat]).addTo(map); marker.on('dragend', () => { const p = marker.getLngLat(); coords = { lat: p.lat, lng: p.lng }; }); } else marker.setLngLat([lng, lat]); if (fly) map.easeTo({ center: [lng, lat], zoom: 15 }); };
    if (coords) place(coords.lng, coords.lat, false);
    map.on('click', (e) => place(e.lngLat.lng, e.lngLat.lat, false));
    mapEl._place = place;
  }).catch(() => {});
  address.addEventListener('input', debounce(async () => {
    const term = address.value.trim();
    if (term.length < 4) { mount(geoList); return; }
    try { const { results } = await get('/api/business/geocode', { q: term }); mount(geoList, results.slice(0, 5).map((r) => h('button', { type: 'button', onClick: () => { address.value = r.label; if (r.city) city.value = r.city; if (r.district) district.value = r.district; mapEl._place?.(r.lng, r.lat, true); mount(geoList); } }, icon('mapPin', { size: 14 }), ' ', r.label))); } catch { mount(geoList); }
  }, 350));

  const saveProfile = button(t('შენახვა', 'Save'), { onClick: () => busy(saveProfile, async () => {
    try {
      await biz.patch('', {
        nameKa: nameKa.value.trim(), name: name.value.trim() || nameKa.value.trim(), category: category.value, phone: phone.value.trim(), email: email.value.trim(), website: website.value.trim(), instagram: instagram.value.trim(), facebook: facebook.value.trim(),
        addressKa: address.value.trim(), address: address.value.trim(), city: city.value.trim(), district: district.value.trim(), ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
        descriptionKa: descriptionKa.value.trim(), description: descriptionEn.value.trim() || descriptionKa.value.trim(), tags: tags.value.split(',').map((s) => s.trim()).filter(Boolean), hours: hours.value(),
      });
      ok(t('შენახულია — აპში მაშინვე ჩანს', 'Saved — live in the app at once'));
      await loadState();
      ctx.refreshShell?.();
    } catch (e) { fail(e); }
  }) });

  // ── pictures ──
  const photosHost = h('div');
  const paintPhotos = async () => {
    const { images, business: fresh } = await biz.get('');
    const upload = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true, onChange: async () => {
      for (const file of upload.files) {
        const form = new FormData();
        form.append('file', file);
        try { await request(biz.path('/images'), { method: 'POST', body: form }); } catch (e) { fail(e); }
      }
      upload.value = '';
      ok(t('ატვირთულია', 'Uploaded'));
      paintPhotos();
    } });
    const setRole = async (role, id) => { try { await biz.patch('', { [role]: id }); ok(t('შენახულია', 'Saved')); paintPhotos(); await loadState(); ctx.refreshShell?.(); } catch (e) { fail(e); } };
    mount(photosHost,
      h('div', { class: 'bz-photos' },
        images.map((img) => h('div', { class: 'bz-photo' }, h('img', { src: img.url, alt: '', loading: 'lazy' }),
          img.id === fresh.logoImageId ? h('span', { class: 'tag' }, t('ლოგო', 'Logo')) : img.id === fresh.coverImageId ? h('span', { class: 'tag' }, t('ქავერი', 'Cover')) : null,
          h('div', { class: 'bz-photo-actions' },
            img.id !== fresh.coverImageId ? h('button', { type: 'button', onClick: () => setRole('coverImageId', img.id) }, t('ქავერი', 'Cover')) : null,
            img.id !== fresh.logoImageId ? h('button', { type: 'button', onClick: () => setRole('logoImageId', img.id) }, t('ლოგო', 'Logo')) : null,
            h('button', { type: 'button', onClick: async () => { if (await confirmDialog({ title: t('სურათის წაშლა?', 'Delete the picture?'), body: '', confirm: t('წაშლა', 'Delete'), danger: true })) { try { await biz.del(`/images/${img.id}`); paintPhotos(); } catch (e) { fail(e); } } } }, '✕')))),
        images.length < 24 ? h('label', { class: 'bz-upload' }, upload, h('span', null, icon('upload', { size: 20 }), h('br'), t('სურათის დამატება', 'Add a picture'), h('br'), h('small', { class: 'faint' }, t('JPG / PNG, 12 MB-მდე', 'JPG / PNG, up to 12 MB')))) : null),
      h('p', { class: 'bz-note', style: { marginTop: '8px' } }, t('ქავერი — სიაში და გვერდის თავში; ლოგო — კვადრატული, პატარა ბარათებზე. ყველა სურათი გალერეაში ჩანს.', 'Cover — in lists and at the top of the page; logo — square, on small cards. Every picture shows in the gallery.')));
  };

  // ── booking rules ──
  const s = b.settings;
  const slot = select([10, 15, 20, 30, 45, 60].map((v) => ({ value: v, label: t(`${v} წთ`, `${v} min`) })), s.slotMinutes);
  const lead = select([[0, t('შეზღუდვის გარეშე', 'No limit')], [30, t('30 წთ', '30 min')], [60, t('1 სთ', '1 h')], [120, t('2 სთ', '2 h')], [240, t('4 სთ', '4 h')], [720, t('12 სთ', '12 h')], [1440, t('1 დღე', '1 day')]].map(([value, label]) => ({ value, label })), s.leadMinutes);
  const horizon = select([7, 14, 30, 60, 90, 180].map((v) => ({ value: v, label: t(`${v} დღე`, `${v} days`) })), s.horizonDays);
  const cancelHours = select([0, 2, 6, 12, 24, 48].map((v) => ({ value: v, label: v ? t(`${v} სთ`, `${v} h`) : t('ნებისმიერ დროს', 'Any time') })), s.cancelHours);
  const bookingNote = input({ value: s.bookingNote || '', placeholder: t('მაგ. პარკინგი ეზოშია; გვიანი 15 წთ-ზე მეტით — ჩანაწერი იხსნება', 'e.g. parking in the yard; more than 15 min late and the slot is released') });
  const saveSettings = async (patch) => { try { await biz.patch('', { settings: patch }); ok(t('შენახულია', 'Saved')); } catch (e) { fail(e); } };
  const saveRules = button(t('შენახვა', 'Save'), { onClick: () => busy(saveRules, () => saveSettings({ slotMinutes: Number(slot.value), leadMinutes: Number(lead.value), horizonDays: Number(horizon.value), cancelHours: Number(cancelHours.value), bookingNote: bookingNote.value.trim() })) });

  const notifHost = h('div', { id: 'notify' });
  void paintNotifications(notifHost, b);
  const modulesHost = h('div', { id: 'modules' });
  void paintModules(modulesHost, b, ctx);
  // Five sections on one long page: a sticky row of anchors keeps the place.
  const anchors = [['public', t('საჯარო გვერდი', 'Public page')], ['photos', t('სურათები', 'Pictures')], ['booking', t('ონლაინ ჯავშნა', 'Online booking')], ['modules', t('მოდულები', 'Modules')], ['notify', t('შეტყობინებები', 'Notifications')], ['status', t('სტატუსი', 'Status')]];
  const anchorRow = h('div', { class: 'bz-anchors' }, anchors.map(([id, label]) => h('button', { type: 'button', 'data-anchor': id, onClick: () => { document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }, label)));
  setTimeout(() => {
    anchors.forEach(([id], i) => { const el = document.getElementById(id); if (!el && i < 4) return; });
    const io = new IntersectionObserver((entries) => {
      const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!seen) return;
      anchorRow.querySelectorAll('button').forEach((bt) => bt.classList.toggle('on', bt.dataset.anchor === seen.target.id));
    }, { rootMargin: '-120px 0px -60% 0px', threshold: 0.01 });
    anchors.forEach(([id]) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }, 300);

  mount(root,
    pageHead(t('პარამეტრები', 'Settings'), t('რას ხედავს კლიენტი აპში და როგორ იწერება.', 'What the client sees in the app and how booking works.')),
    anchorRow,
    b.status === 'PENDING' ? h('div', { class: 'bz-banner is-warn' }, icon('clock', { size: 20 }), h('p', null, h('b', null, t('ბიზნესი განიხილება', 'Under review')), t('ყველაფერი, რასაც აქ შეავსებ, დადასტურების მომენტში აპში გამოჩნდება.', 'Everything you fill in here goes live in the app the moment it is approved.'))) : null,
    h('div', { class: 'bz-grid' },
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        card({ id: 'public' }, h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('საჯარო გვერდი', 'Public page')), h('div', { class: 'card-sub' }, t('სახელი, კონტაქტი, მისამართი, საათები, აღწერა.', 'Name, contact, address, hours, about.')))),
          h('div', { class: 'form' },
            h('div', { class: 'form-row' }, field(t('სახელი ქართულად', 'Name in Georgian'), nameKa), field(t('სახელი ლათინურად', 'Name in Latin letters'), name)),
            h('div', { class: 'form-row' }, field(t('კატეგორია', 'Category'), category), field(t('ტეგები', 'Tags'), tags)),
            h('div', { class: 'form-row' }, field(t('ტელეფონი', 'Phone'), phone), field(t('ელ-ფოსტა შეტყობინებებისთვის', 'Email for notifications'), email)),
            h('div', { class: 'form-row' }, field(t('ვებსაიტი', 'Website'), website), field('Instagram', instagram)),
            field('Facebook', facebook),
            field(t('მისამართი', 'Address'), address), geoList,
            h('div', { class: 'form-row' }, field(t('ქალაქი', 'City'), city), field(t('უბანი', 'District'), district)),
            mapEl, h('p', { class: 'bz-note' }, t('გადაათრიე პინი ან დააჭირე რუკაზე, თუ ზუსტად არ დგას.', 'Drag the pin or click the map if it is not exact.')),
            field(t('აღწერა ქართულად', 'About in Georgian'), descriptionKa), field(t('აღწერა ინგლისურად', 'About in English'), descriptionEn),
            h('div', { class: 'card-title', style: { marginTop: '6px' } }, t('სამუშაო საათები', 'Opening hours')), hours.el,
            h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, saveProfile))),
        card({ id: 'photos' }, h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('სურათები', 'Pictures')), h('div', { class: 'card-sub' }, t('ფოტოიანი გვერდი 3-ჯერ მეტ ჯავშანს იღებს.', 'A page with pictures gets three times the bookings.')))), photosHost)),
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        card({ id: 'booking' }, h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('ონლაინ ჯავშნა', 'Online booking')), h('div', { class: 'card-sub' }, t('როგორ ეწერებიან აპიდან.', 'How people book from the app.')))),
          h('div', { style: { display: 'grid', gap: '12px' } },
            h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, t('ონლაინ ჯავშნა ჩართულია', 'Online booking on')), h('div', { class: 'faint' }, t('გამორთვისას გვერდი რჩება, ღილაკი „ჩაწერა“ ქრება.', 'Off: the page stays, the Book button disappears.'))), toggle(s.onlineBooking, (on) => saveSettings({ onlineBooking: on }))),
            h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, t('ავტომატური დადასტურება', 'Automatic confirmation')), h('div', { class: 'faint' }, t('გამორთვისას ყოველი ჯავშანი „დასადასტურებელი“ მოდის.', 'Off: every booking arrives as "to confirm".'))), toggle(s.autoConfirm, (on) => saveSettings({ autoConfirm: on }))),
            h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, t('კლიენტი ირჩევს თანამშრომელს', 'The client picks the person')), h('div', { class: 'faint' }, t('გამორთვისას — „ნებისმიერი“, ყველაზე თავისუფალს ვანაწილებთ.', 'Off: "anyone", the least busy person gets it.'))), toggle(s.allowStaffChoice, (on) => saveSettings({ allowStaffChoice: on }))),
            h('div', { class: 'form' },
              h('div', { class: 'form-row' }, field(t('დროის ბადე', 'Time grid'), slot), field(t('ყველაზე ადრე', 'Earliest booking'), lead)),
              h('div', { class: 'form-row' }, field(t('რამდენი დღით ადრე', 'How far ahead'), horizon), field(t('უფასო გაუქმება', 'Free cancellation'), cancelHours)),
              field(t('შენიშვნა ჯავშნის წინ', 'Note before booking'), bookingNote),
              h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, saveRules)))),
        modulesHost,
        notifHost,
        card({ id: 'status' }, h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('სტატუსი', 'Status')),
          h('dl', { class: 'bz-kv' },
            h('dt', null, t('აპში', 'In the app')), h('dd', null, b.status === 'CLAIMED' ? h('span', { class: 'badge badge-ok' }, t('ჩართულია', 'Live')) : b.status === 'PENDING' ? h('span', { class: 'badge badge-warn' }, t('განიხილება', 'Under review')) : h('span', { class: 'badge badge-neutral' }, b.status)),
            h('dt', null, t('ბმული', 'Link')), h('dd', null, h('code', { style: { fontSize: '12px' } }, `medicard.ge/app/book/${b.slug}`),
              h('div', { class: 'bz-inline', style: { marginTop: '6px' } },
                button(t('კოპირება', 'Copy'), { size: 'sm', variant: 'ghost', icon: 'copy', onClick: async () => { try { await navigator.clipboard.writeText(`https://medicard.ge/app/book/${b.slug}`); ok(t('ბმული დაკოპირდა', 'Link copied')); } catch { fail(new Error(t('ვერ დაკოპირდა', 'Could not copy'))); } } }),
                button(t('QR კოდი', 'QR code'), { size: 'sm', variant: 'ghost', icon: 'qr', onClick: () => qrDialog(b) }))),
            h('dt', null, t('შეფასება', 'Rating')), h('dd', null, b.rating != null ? `${b.rating.toFixed(1)} · ${b.ratingCount}` : t('ჯერ არ არის', 'None yet'))),
          h('p', { class: 'bz-note', style: { marginTop: '10px' } }, t('ბიზნესის დახურვა ან კატალოგიდან მოხსნა — support@medicard.ge.', 'To close the business or remove it from the catalogue, write to support@medicard.ge.'))))));
  await paintPhotos();
  void reload;
}

/** The booking link as a QR: on the counter, the door or the Instagram bio — a scan lands on the business page in the app. */
function qrDialog(b) {
  const url = `https://medicard.ge/app/book/${b.slug}`;
  const svg = qrSvg(url, 240);
  if (!svg) { fail(new Error(t('QR ვერ შეიქმნა.', 'Could not make the QR.'))); return; }
  openModal({
    title: t('QR კოდი ჯავშნისთვის', 'QR code for booking'),
    size: 'sm',
    body: h('div', { style: { display: 'grid', gap: '12px', justifyItems: 'center', textAlign: 'center' } },
      h('div', { class: 'bz-qr' }, svg),
      h('code', { style: { fontSize: '12px' } }, url.replace('https://', '')),
      h('p', { class: 'bz-note' }, t('დაბეჭდე დახლზე ან კარზე, ჩასვი Instagram-ის ბიოში — სკანი პირდაპირ შენს გვერდზე მიდის და კლიენტი იქვე იწერება.', 'Print it for the counter or the door, put it in the Instagram bio — a scan lands on your page and the client books right there.'))),
    footer: (close) => [button(t('ჩამოტვირთვა (SVG)', 'Download (SVG)'), { variant: 'secondary', icon: 'download', onClick: () => downloadSvg(qrSvg(url, 1024, true), `medibook-${b.slug}.svg`) }), button(t('დახურვა', 'Close'), { onClick: () => close() })],
  });
}

/** Square-module QR, quiet zone 4, lilac finder eyes. */
function qrSvg(text, size, forFile = false) {
  const m = qrMatrix(text);
  if (!m) return null;
  const n = m.length;
  const quiet = 4;
  const total = n + quiet * 2;
  const NS = 'http://www.w3.org/2000/svg';
  const el = (tag, attrs) => { const x = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => x.setAttribute(k, String(v))); return x; };
  const svg = el('svg', { viewBox: `0 0 ${total} ${total}`, width: size, height: size, role: 'img', 'aria-label': t('QR კოდი', 'QR code'), 'shape-rendering': 'crispEdges' });
  if (forFile) svg.setAttribute('xmlns', NS);
  svg.appendChild(el('rect', { x: 0, y: 0, width: total, height: total, fill: '#ffffff', rx: forFile ? 0 : 2 }));
  const inFinder = (r, c) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c] && !inFinder(r, c)) d += `M${c + quiet},${r + quiet}h1v1h-1z`;
  svg.appendChild(el('path', { d, fill: '#16141a' }));
  for (const [r, c] of [[0, 0], [0, n - 7], [n - 7, 0]]) {
    svg.appendChild(el('path', { d: `M${c + quiet},${r + quiet}h7v7h-7zM${c + quiet + 1},${r + quiet + 1}v5h5v-5z`, fill: '#16141a', 'fill-rule': 'evenodd' }));
    svg.appendChild(el('rect', { x: c + quiet + 2, y: r + quiet + 2, width: 3, height: 3, fill: '#7a58c9' }));
  }
  return svg;
}

function downloadSvg(svg, filename) {
  if (!svg) return;
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/**
 * What the clients get: reminders in the app (hours ahead, on/off), SMS for people without the app (off until the
 * business turns it on; a monthly cap and this month's count), emails to the business. Every switch saves at once.
 */
/** Which modules this business runs (defaults from its segment) and the ready-made kit for its type. */
async function paintModules(host, b, ctx) {
  mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' })));
  let p;
  try { p = await biz.get('/profile'); } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); return; }
  const catLabel = CATEGORIES.find(([k]) => k === b.category)?.[1] || b.category;
  const modules = { ...p.modules };
  const rows = MODULES.map(([key, label, sub]) => h('div', { class: 'bz-muted-row' },
    h('div', null, h('b', null, label()), h('div', { class: 'faint' }, sub())),
    toggle(modules[key] !== false, async (v) => {
      try { await biz.patch('', { settings: { modules: { [key]: v } } }); modules[key] = v; ok(v ? t('ჩაირთო', 'On') : t('გამოირთო', 'Off')); await loadState(); ctx.refreshShell?.(); } catch (e) { fail(e); paintModules(host, b, ctx); }
    })));
  const kitLine = t(`${p.kit.services.length} სერვისი ${p.profile.kit.groups} ჯგუფში · ${p.kit.supplies.length} მასალა · ${p.kit.resources.length} ოთახი/აპარატი`, `${p.kit.services.length} services in ${p.profile.kit.groups} groups · ${p.kit.supplies.length} supplies · ${p.kit.resources.length} rooms/equipment`);
  const haveLine = t(`ახლა გაქვს: ${p.have.services} სერვისი · ${p.have.supplies} მასალა · ${p.have.resources} რესურსი`, `You have: ${p.have.services} services · ${p.have.supplies} supplies · ${p.have.resources} resources`);
  const groups = [...new Set(p.kit.services.map((s) => s.group))];
  const load = button(t('ნაკრების ჩატვირთვა', 'Load the kit'), { icon: 'sparkles', onClick: () => busy(load, async () => {
    try {
      const { added } = await biz.post('/starter-kit', {});
      const total = added.services + added.supplies + added.resources;
      ok(total ? t(`დაემატა: ${added.services} სერვისი, ${added.supplies} მასალა, ${added.resources} რესურსი, ${added.norms} ნორმა`, `Added: ${added.services} services, ${added.supplies} supplies, ${added.resources} resources, ${added.norms} norms`) : t('ყველაფერი უკვე გაქვს.', 'You already have everything.'));
      paintModules(host, b, ctx);
    } catch (e) { fail(e); }
  }) });
  mount(host, h('div', { class: 'bz-stack' },
    card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('მოდულები', 'Modules')), h('div', { class: 'card-sub' }, t(`ნაგულისხმევი — „${catLabel}“ სეგმენტიდან; ჩართე ან გამორთე, რაც გჭირდება. გამორთული გვერდი მენიუდან ქრება, მონაცემები რჩება.`, `Defaults from the “${catLabel}” segment; switch on what you need. A page switched off leaves the menu, its data stays.`)))),
      h('div', null, rows)),
    card({ id: 'kit' }, h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('მზა სტარტი', 'Ready-made start')), h('div', { class: 'card-sub' }, t(`${catLabel} — სერვისები ფასით და ხანგრძლივობით, მასალები ნორმებით, ოთახები და აპარატურა. ემატება მხოლოდ ის, რაც ჯერ არ გაქვს; სახელებს და ფასებს მერე შეცვლი.`, `${catLabel} — services with prices and durations, supplies with norms, rooms and equipment. Only what you do not have yet is added; rename and reprice afterwards.`)))),
      h('div', { class: 'bz-kit' },
        h('div', { class: 'bz-kit-line' }, h('b', null, kitLine), h('span', { class: 'faint' }, haveLine)),
        h('div', { class: 'bz-tags' }, groups.map((g) => h('span', { class: 'bz-tag' }, g))),
        h('div', { class: 'bz-kit-foot' }, load)))));
}

async function paintNotifications(host, b) {
  mount(host, card(h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' }))));
  let data;
  try { data = await biz.get('/notifications'); } catch (e) { mount(host, card(emptyBox(t('შეტყობინებები ვერ ჩაიტვირთა', 'Notifications could not load'), e?.message))); return; }
  let notify = data.notify;
  const save = async (mutate) => {
    mutate(notify);
    try { const res = await biz.patch('', { settings: { notify } }); notify = res.business.settings.notify; ok(t('შენახულია', 'Saved')); } catch (e) { fail(e); }
    render();
  };
  const row = (title, sub, control) => h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, title), sub ? h('div', { class: 'faint' }, sub) : null), control);
  const sel = (options, value, onChange) => select(options.map(([v, l]) => ({ value: v, label: l })), value, { class: 'input select', style: { width: 'auto' }, onChange: (e) => onChange(Number(e.target.value)) });
  const label = (text) => h('div', { class: 'bz-section-label' }, text);
  function render() {
    const { push, sms, email } = notify;
    const u = data.usage;
    mount(host, card(
      h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('შეტყობინებები კლიენტებს', 'Client notifications')), h('div', { class: 'card-sub' }, t('აპის მომხმარებლებს push მიდის; ვისაც აპი არ აქვს — SMS, როცა ჩართავ.', 'App users get pushes; people without the app get SMS once you turn it on.')))),
      h('div', { style: { display: 'grid', gap: '10px' } },
        label(t('შეხსენებები აპში', 'Reminders in the app')),
        row(t('წინა დღით', 'The day before'), t('რამდენი საათით ადრე', 'How many hours ahead'), h('div', { class: 'bz-inline' }, sel([[12, t('12 სთ', '12 h')], [24, t('24 სთ', '24 h')], [48, t('48 სთ', '48 h')]], notify.reminderHours, (v) => save((n) => { n.reminderHours = v; })), toggle(push.reminderDay, (on) => save((n) => { n.push.reminderDay = on; })))),
        row(t('ვიზიტის წინ', 'Shortly before the visit'), t('რამდენი საათით ადრე', 'How many hours ahead'), h('div', { class: 'bz-inline' }, sel([[1, t('1 სთ', '1 h')], [2, t('2 სთ', '2 h')], [3, t('3 სთ', '3 h')]], notify.soonHours, (v) => save((n) => { n.soonHours = v; })), toggle(push.reminderSoon, (on) => save((n) => { n.push.reminderSoon = on; })))),
        row(t('შეფასების თხოვნა ვიზიტის შემდეგ', 'Ask for a review after the visit'), null, toggle(push.reviewAsk, (on) => save((n) => { n.push.reviewAsk = on; }))),
        label('SMS'),
        row(t('SMS შეტყობინებები', 'SMS notifications'), data.smsAvailable
          ? t(`MEDICARD-ის სახელით, თვეში ${sms.monthlyCap}-მდე. ამ თვეში გაგზავნილია ${u.sent}${u.failed ? `, ვერ გაიგზავნა ${u.failed}` : ''}.`, `Sent as MEDICARD, up to ${sms.monthlyCap} a month. This month: ${u.sent} sent${u.failed ? `, ${u.failed} failed` : ''}.`)
          : t('SMS არხი დროებით გამორთულია.', 'The SMS channel is off for now.'), toggle(sms.enabled, (on) => save((n) => { n.sms.enabled = on; }))),
        sms.enabled ? [
          row(t('მხოლოდ მათ, ვისაც აპი არ აქვს', 'Only to people without the app'), t('აპის მომხმარებელს push საკმარისია; გამორთე და ყველას SMS-იც მივა.', 'A push is enough for app users; turn this off and everyone gets SMS too.'), toggle(sms.onlyWithoutApp, (on) => save((n) => { n.sms.onlyWithoutApp = on; }))),
          row(t('ჯავშნის დადასტურება', 'Booking confirmed'), null, toggle(sms.confirm, (on) => save((n) => { n.sms.confirm = on; }))),
          row(t('შეხსენება წინა დღით', 'Reminder the day before'), null, toggle(sms.reminderDay, (on) => save((n) => { n.sms.reminderDay = on; }))),
          row(t('შეხსენება ვიზიტის წინ', 'Reminder shortly before'), null, toggle(sms.reminderSoon, (on) => save((n) => { n.sms.reminderSoon = on; }))),
          row(t('გაუქმება და გადატანა', 'Cancellations and moves'), null, toggle(sms.changes, (on) => save((n) => { n.sms.changes = on; }))),
          row(t('მოლოდინის სია — გათავისუფლებული დრო', 'Waiting list — a time opened up'), null, toggle(sms.waitlist, (on) => save((n) => { n.sms.waitlist = on; }))),
          row(t('თვიური ლიმიტი', 'Monthly limit'), t('ლიმიტის შემდეგ SMS ჩერდება, push და ელფოსტა — არა.', 'Past the limit SMS stops; pushes and emails do not.'), sel([[50, '50'], [100, '100'], [200, '200'], [500, '500'], [1000, '1000']], sms.monthlyCap, (v) => save((n) => { n.sms.monthlyCap = v; }))),
          h('div', { class: 'bz-sms-preview' }, h('div', { class: 'faint' }, t('როგორ გამოიყურება:', 'What it looks like:')), ['confirm', 'day', 'cancelled'].map((k) => h('div', { class: 'bz-sms-bubble' }, data.samples[k]))),
        ] : null,
        label(t('ელფოსტა ბიზნესს', 'Email to the business')),
        row(t('ახალი ჯავშანი', 'New booking'), b.email || t('ელფოსტა საჯარო გვერდზე მიუთითე', 'Set an email on the public page'), toggle(email.newBooking, (on) => save((n) => { n.email.newBooking = on; }))),
        row(t('გაუქმება კლიენტის მხრიდან', 'Cancellation by the client'), null, toggle(email.cancelled, (on) => save((n) => { n.email.cancelled = on; }))))));
  }
  render();
}
