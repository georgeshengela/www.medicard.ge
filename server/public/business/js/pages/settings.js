// MEDIBOOK business panel — settings: the public page (names, contacts, address, hours, pictures) and booking rules.
import { h, mount, icon, button, pageHead, card, input, textarea, field, select, busy, toggle, confirmDialog, debounce } from '/app/js/ui.js';
import { get, request } from '/app/js/api.js';
import { t } from '/app/js/i18n.js';
import { state, loadState } from '../state.js';
import { biz, CATEGORIES, hoursEditor, loadMapbox, fail, ok } from '../shared.js';

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
    const place = (lng, lat, fly) => { coords = { lat, lng }; if (!marker) { marker = new mapboxgl.Marker({ color: '#B45309', draggable: true }).setLngLat([lng, lat]).addTo(map); marker.on('dragend', () => { const p = marker.getLngLat(); coords = { lat: p.lat, lng: p.lng }; }); } else marker.setLngLat([lng, lat]); if (fly) map.easeTo({ center: [lng, lat], zoom: 15 }); };
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

  mount(root,
    pageHead(t('პარამეტრები', 'Settings'), t('რას ხედავს კლიენტი აპში და როგორ იწერება.', 'What the client sees in the app and how booking works.')),
    b.status === 'PENDING' ? h('div', { class: 'bz-banner is-warn' }, icon('clock', { size: 20 }), h('p', null, h('b', null, t('ბიზნესი განიხილება', 'Under review')), t('ყველაფერი, რასაც აქ შეავსებ, დადასტურების მომენტში აპში გამოჩნდება.', 'Everything you fill in here goes live in the app the moment it is approved.'))) : null,
    h('div', { class: 'bz-grid' },
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('საჯარო გვერდი', 'Public page')), h('div', { class: 'card-sub' }, t('სახელი, კონტაქტი, მისამართი, საათები, აღწერა.', 'Name, contact, address, hours, about.')))),
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
        card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('სურათები', 'Pictures')), h('div', { class: 'card-sub' }, t('ფოტოიანი გვერდი 3-ჯერ მეტ ჯავშანს იღებს.', 'A page with pictures gets three times the bookings.')))), photosHost)),
      h('div', { style: { display: 'grid', gap: '16px', alignContent: 'start' } },
        card(h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('ონლაინ ჯავშნა', 'Online booking')), h('div', { class: 'card-sub' }, t('როგორ ეწერებიან აპიდან.', 'How people book from the app.')))),
          h('div', { style: { display: 'grid', gap: '12px' } },
            h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, t('ონლაინ ჯავშნა ჩართულია', 'Online booking on')), h('div', { class: 'faint' }, t('გამორთვისას გვერდი რჩება, ღილაკი „ჩაწერა“ ქრება.', 'Off: the page stays, the Book button disappears.'))), toggle(s.onlineBooking, (on) => saveSettings({ onlineBooking: on }))),
            h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, t('ავტომატური დადასტურება', 'Automatic confirmation')), h('div', { class: 'faint' }, t('გამორთვისას ყოველი ჯავშანი „დასადასტურებელი“ მოდის.', 'Off: every booking arrives as "to confirm".'))), toggle(s.autoConfirm, (on) => saveSettings({ autoConfirm: on }))),
            h('div', { class: 'bz-muted-row' }, h('div', null, h('b', null, t('კლიენტი ირჩევს თანამშრომელს', 'The client picks the person')), h('div', { class: 'faint' }, t('გამორთვისას — „ნებისმიერი“, ყველაზე თავისუფალს ვანაწილებთ.', 'Off: "anyone", the least busy person gets it.'))), toggle(s.allowStaffChoice, (on) => saveSettings({ allowStaffChoice: on }))),
            h('div', { class: 'form' },
              h('div', { class: 'form-row' }, field(t('დროის ბადე', 'Time grid'), slot), field(t('ყველაზე ადრე', 'Earliest booking'), lead)),
              h('div', { class: 'form-row' }, field(t('რამდენი დღით ადრე', 'How far ahead'), horizon), field(t('უფასო გაუქმება', 'Free cancellation'), cancelHours)),
              field(t('შენიშვნა ჯავშნის წინ', 'Note before booking'), bookingNote),
              h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, saveRules)))),
        card(h('div', { class: 'card-title', style: { marginBottom: '8px' } }, t('სტატუსი', 'Status')),
          h('dl', { class: 'bz-kv' },
            h('dt', null, t('აპში', 'In the app')), h('dd', null, b.status === 'CLAIMED' ? h('span', { class: 'badge badge-ok' }, t('ჩართულია', 'Live')) : b.status === 'PENDING' ? h('span', { class: 'badge badge-warn' }, t('განიხილება', 'Under review')) : h('span', { class: 'badge badge-neutral' }, b.status)),
            h('dt', null, t('ბმული', 'Link')), h('dd', null, h('code', { style: { fontSize: '12px' } }, `medicard.ge/app/book/${b.slug}`)),
            h('dt', null, t('შეფასება', 'Rating')), h('dd', null, b.rating != null ? `${b.rating.toFixed(1)} · ${b.ratingCount}` : t('ჯერ არ არის', 'None yet'))),
          h('p', { class: 'bz-note', style: { marginTop: '10px' } }, t('ბიზნესის დახურვა ან კატალოგიდან მოხსნა — support@medicard.ge.', 'To close the business or remove it from the catalogue, write to support@medicard.ge.'))))));
  await paintPhotos();
  void reload;
}
