// MEDIBOOK business panel — the team: people who perform services (with their hours) and panel access.
import { h, mount, icon, button, pageHead, card, input, field, select, busy, openModal, confirmDialog, badge } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, avatar, hoursEditor, emptyBox, fail, ok, roleLabel, ROLES } from '../shared.js';
import { canManage, isOwner, state } from '../state.js';

const PALETTE = ['#A21CAF', '#0EA5E9', '#22C55E', '#F59E0B', '#EC4899', '#6366F1', '#14B8A6', '#EF4444', '#8B5CF6', '#0D9488'];

export default async function teamPage(root) {
  const host = h('div');
  const membersHost = h('div');
  const manage = canManage();

  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const [{ staff }, { services }] = await Promise.all([biz.get('/staff'), biz.get('/services')]);
      const active = staff.filter((s) => s.active);
      if (!active.length) { mount(host, card(emptyBox(t('გუნდი ჯერ ცარიელია', 'No team yet'), t('დაამატე ყველა, ვინც კლიენტებს იღებს — თავისი სამუშაო საათებით. თავისუფალი დროები მათგან ითვლება.', 'Add everyone who sees clients — with their own hours. Free slots are computed from them.'), manage ? button(t('თანამშრომლის დამატება', 'Add a person'), { icon: 'userPlus', onClick: () => staffDialog(null, services, staff, paint) }) : null))); return; }
      mount(host, h('div', { class: 'bz-grid-3' }, active.map((p) => {
        const mine = p.serviceIds.length ? services.filter((s) => p.serviceIds.includes(s.id)) : services.filter((s) => s.active);
        const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => (p.schedule?.[String(d)] || []).length);
        return card(
          h('div', { class: 'bz-inline', style: { justifyContent: 'space-between', alignItems: 'flex-start' } },
            h('div', { class: 'bz-inline' }, avatar(p.name, p.color || '#A21CAF', 44), h('div', null, h('div', { class: 'card-title' }, p.name), h('div', { class: 'card-sub' }, p.title || t('თანამშრომელი', 'Staff')))),
            badge(p.bookable ? t('იწერება', 'Bookable') : t('არ იწერება', 'Not bookable'), p.bookable ? 'ok' : 'neutral')),
          h('div', { style: { marginTop: '12px', fontSize: '13.5px' } },
            h('div', { class: 'bz-sub' }, t('სერვისები: ', 'Services: '), h('span', { style: { color: 'var(--text)' } }, p.serviceIds.length ? mine.map((s) => s.name).join(', ') : t('ყველა', 'All'))),
            h('div', { class: 'bz-sub', style: { marginTop: '4px' } }, t('გრაფიკი: ', 'Hours: '), h('span', { style: { color: 'var(--text)' } }, days.length ? t(`${days.length} დღე კვირაში`, `${days.length} days a week`) : t('ბიზნესის საათები', 'Business hours')))),
          manage ? h('div', { class: 'bz-actions', style: { marginTop: '14px' } },
            button(t('რედაქტირება', 'Edit'), { size: 'sm', variant: 'ghost', icon: 'edit', onClick: () => staffDialog(p, services, staff, paint) }),
            button(t('მოხსნა', 'Remove'), { size: 'sm', variant: 'ghost', icon: 'trash', onClick: async () => { if (await confirmDialog({ title: t(`${p.name} — მოხსნა?`, `Remove ${p.name}?`), body: t('მისი ჯავშნები ისტორიაში რჩება; ახალი ვეღარ დაინიშნება.', 'Their bookings stay in the history; no new ones can be made.'), confirm: t('მოხსნა', 'Remove'), danger: true })) { try { await biz.del(`/staff/${p.id}`); paint(); } catch (e) { fail(e); } } } })) : null);
      })));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  async function paintMembers() {
    if (!manage) { mount(membersHost); return; }
    try {
      const [{ members }, { staff }] = await Promise.all([biz.get('/members'), biz.get('/staff')]);
      mount(membersHost, card(
        h('div', { class: 'card-head' }, h('div', null, h('div', { class: 'card-title' }, t('პანელზე წვდომა', 'Panel access')), h('div', { class: 'card-sub' }, t('მფლობელი — ყველაფერი; მენეჯერი — ყველაფერი გუნდის გარდა; თანამშრომელი — თავისი კალენდარი და კლიენტები.', 'Owner — everything; manager — everything but the team; staff — their own calendar and clients.'))),
          isOwner() ? button(t('მოწვევა', 'Invite'), { size: 'sm', icon: 'userPlus', onClick: () => inviteDialog(staff, paintMembers) }) : null),
        h('div', null, members.map((m) => h('div', { class: 'bz-muted-row' },
          h('div', { class: 'bz-inline' }, avatar(m.name, '#64748B', 32), h('div', null, h('b', null, m.name), h('div', { class: 'faint' }, [m.phone, m.email].filter(Boolean).join(' · ') || t('კონტაქტი არ ჩანს', 'No contact shown')))),
          h('div', { class: 'bz-inline' },
            isOwner() && m.userId !== state.user?.id
              ? select(ROLES.map(([value, label]) => ({ value, label })), m.role, { onChange: async (e) => { try { await biz.patch(`/members/${m.id}`, { role: e.target.value }); ok(t('შენახულია', 'Saved')); } catch (err) { fail(err); paintMembers(); } }, style: { maxWidth: '160px', padding: '6px 10px' } })
              : badge(roleLabel(m.role), m.role === 'OWNER' ? 'brand' : 'neutral'),
            isOwner() && m.role === 'STAFF' ? select([{ value: '', label: t('კალენდრის გარეშე', 'No calendar link') }, ...staff.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))], m.staffId || '', { onChange: async (e) => { try { await biz.patch(`/members/${m.id}`, { staffId: e.target.value || null }); ok(t('შენახულია', 'Saved')); } catch (err) { fail(err); } }, style: { maxWidth: '180px', padding: '6px 10px' } }) : null,
            isOwner() && m.userId !== state.user?.id ? button('', { variant: 'ghost', size: 'sm', icon: 'userMinus', ariaLabel: t('მოხსნა', 'Remove'), onClick: async () => { if (await confirmDialog({ title: t('წვდომის მოხსნა?', 'Remove access?'), body: m.name, confirm: t('მოხსნა', 'Remove'), danger: true })) { try { await biz.del(`/members/${m.id}`); paintMembers(); } catch (err) { fail(err); } } } }) : null))))));
    } catch { mount(membersHost); }
  }

  mount(root,
    pageHead(t('გუნდი', 'Team'), t('ვინ იღებს კლიენტებს და როდის; ვის აქვს პანელზე წვდომა.', 'Who sees clients and when; who can open the panel.'),
      manage ? button(t('თანამშრომლის დამატება', 'Add a person'), { icon: 'userPlus', onClick: async () => { const [{ services }, { staff }] = await Promise.all([biz.get('/services'), biz.get('/staff')]); staffDialog(null, services, staff, paint); } }) : null),
    host, h('div', { style: { height: '16px' } }), membersHost);
  await Promise.all([paint(), paintMembers()]);
}

function staffDialog(person, services, staff, onSaved) {
  const name = input({ value: person?.name || '', required: true, placeholder: t('სახელი', 'Name') });
  const title = input({ value: person?.title || '', placeholder: t('მაგ. სტომატოლოგი-თერაპევტი, სტილისტი', 'e.g. Dentist, Stylist') });
  const used = new Set(staff.filter((s) => s.id !== person?.id).map((s) => s.color));
  let color = person?.color || PALETTE.find((c) => !used.has(c)) || PALETTE[staff.length % PALETTE.length];
  const swatches = h('div', { class: 'bz-chips' }, PALETTE.map((c) => h('button', { type: 'button', class: `bz-chip${c === color ? ' on' : ''}`, style: { padding: '6px' }, onClick: (e) => { color = c; swatches.querySelectorAll('button').forEach((b) => b.classList.remove('on')); e.currentTarget.classList.add('on'); } }, h('span', { class: 'bz-color-dot', style: { background: c, width: '16px', height: '16px' } }))));
  const all = h('input', { type: 'checkbox', checked: !person || !person.serviceIds.length });
  const checks = services.filter((s) => s.active).map((s) => h('label', { class: 'bz-chip' + (person?.serviceIds.includes(s.id) ? ' on' : ''), style: { cursor: 'pointer' } }, h('input', { type: 'checkbox', value: s.id, checked: Boolean(person?.serviceIds.includes(s.id)), onChange: (e) => e.target.parentElement.classList.toggle('on', e.target.checked) }), s.name));
  const chipWrap = h('div', { class: 'bz-chips', style: { marginTop: '6px', opacity: all.checked ? .45 : 1 } }, checks);
  all.addEventListener('change', () => { chipWrap.style.opacity = all.checked ? .45 : 1; });
  const hours = hoursEditor(person?.schedule || {});
  const own = h('input', { type: 'checkbox', checked: Boolean(person && Object.values(person.schedule || {}).some((l) => l.length)) });
  hours.el.style.display = own.checked ? '' : 'none';
  own.addEventListener('change', () => { hours.el.style.display = own.checked ? '' : 'none'; });
  const bookable = h('input', { type: 'checkbox', checked: person ? person.bookable : true });
  const save = button(t('შენახვა', 'Save'));
  const m = openModal({
    title: person ? t('თანამშრომლის რედაქტირება', 'Edit person') : t('ახალი თანამშრომელი', 'New person'),
    size: 'lg',
    body: h('div', { class: 'form' },
      h('div', { class: 'form-row' }, field(t('სახელი', 'Name'), name), field(t('პოზიცია', 'Title'), title)),
      field(t('ფერი კალენდარში', 'Calendar colour'), swatches),
      h('div', null, h('label', { class: 'bz-inline', style: { fontSize: '14px', fontWeight: 600 } }, all, t('ასრულებს ყველა სერვისს', 'Performs every service')), chipWrap),
      h('div', null, h('label', { class: 'bz-inline', style: { fontSize: '14px', fontWeight: 600 } }, own, t('საკუთარი სამუშაო საათები (სხვაგვარად — ბიზნესის საათები)', 'Own working hours (otherwise the business hours)')), h('div', { style: { marginTop: '8px' } }, hours.el)),
      h('label', { class: 'bz-inline', style: { fontSize: '14px' } }, bookable, t('კლიენტებს შეუძლიათ მასთან ჩაწერა აპიდან', 'Clients can book this person from the app'))),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
  });
  save.addEventListener('click', () => busy(save, async () => {
    try {
      const serviceIds = all.checked ? [] : checks.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
      const body = { name: name.value.trim(), title: title.value.trim() || null, color, serviceIds, schedule: own.checked ? hours.value() : {}, bookable: bookable.checked };
      if (person) await biz.patch(`/staff/${person.id}`, body); else await biz.post('/staff', body);
      m.close();
      ok(t('შენახულია', 'Saved'));
      onSaved?.();
    } catch (e) { fail(e); }
  }));
}

function inviteDialog(staff, onSaved) {
  const contact = input({ placeholder: t('ტელეფონი (5XX XXX XXX) ან ელ-ფოსტა', 'Phone (5XX XXX XXX) or email'), required: true });
  const role = select(ROLES.map(([value, label]) => ({ value, label })), 'STAFF');
  const link = select([{ value: '', label: t('კალენდრის გარეშე', 'No calendar link') }, ...staff.filter((s) => s.active).map((s) => ({ value: s.id, label: s.name }))], '');
  const save = button(t('მოწვევა', 'Invite'));
  const m = openModal({
    title: t('პანელზე წვდომის მიცემა', 'Give panel access'),
    size: 'sm',
    body: h('div', { class: 'form' }, h('p', { class: 'muted' }, t('ადამიანს MEDICARD ანგარიში უნდა ჰქონდეს (აპი ან medicard.ge/app). წვდომა მაშინვე ჩაირთვება.', 'The person needs a MEDICARD account (the app or medicard.ge/app). Access starts at once.')), field(t('ტელეფონი ან ელ-ფოსტა', 'Phone or email'), contact), field(t('როლი', 'Role'), role), field(t('ვისი კალენდარია (თანამშრომლისთვის)', 'Whose calendar (for staff)'), link)),
    footer: (close) => [button(t('გაუქმება', 'Cancel'), { variant: 'ghost', onClick: () => close() }), save],
  });
  save.addEventListener('click', () => busy(save, async () => {
    try {
      const v = contact.value.trim();
      await biz.post('/members', { ...(v.includes('@') ? { email: v } : { phone: v }), role: role.value, staffId: link.value || null });
      m.close();
      ok(t('წვდომა მიცემულია', 'Access given'));
      onSaved?.();
    } catch (e) { fail(e); }
  }));
}

export { icon };
