// MEDIBOOK business panel — reviews from the app: the average with its distribution, filters, a public reply, pages.
import { h, mount, icon, button, pageHead, card, textarea, busy } from '/app/js/ui.js';
import { select } from '../fields.js';
import { meters } from '/app/js/charts.js';
import { t } from '/app/js/i18n.js';
import { biz, dateText, emptyBox, fail, ok, avatar } from '../shared.js';
import { canManage } from '../state.js';
import { chips, filterBar, listState, pager, paginate } from '../lists.js';

export default async function reviewsPage(root) {
  const ls = listState('reviews', { filter: '', staff: '', size: 25 });
  const st = ls.state;
  let page = 1;
  let reviews = [];
  const top = h('div');
  const host = h('div');
  const chipsHost = h('div');
  const staffHost = h('span');
  const count = h('span', { class: 'bz-filters-count' });

  async function load() {
    mount(top, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      reviews = (await biz.get('/reviews')).reviews;
      paintTop();
      page = 1;
      paint();
    } catch (e) { mount(top, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }

  function paintTop() {
    if (!reviews.length) { mount(top, card(emptyBox(t('შეფასებები ჯერ არ არის', 'No reviews yet'), t('ვიზიტის დასრულებიდან რამდენიმე საათში აპი კლიენტს თავად ეკითხება „როგორ იყო?“. შეფასება აქ და აპის გვერდზე ჩნდება.', 'A few hours after a completed visit the app asks the client "how was it?". Reviews show here and on your page in the app.')))); mount(host); return; }
    const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
    const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));
    const unanswered = reviews.filter((r) => !r.reply).length;
    mount(top, h('div', { class: 'bz-grid-2', style: { marginTop: 0, marginBottom: '16px' } },
      card(h('div', { class: 'bz-review-avg' },
        h('div', null, h('b', { class: 'big' }, avg.toFixed(1)), h('div', { class: 'bz-stars', style: { marginTop: '4px' } }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= Math.round(avg) ? '' : 'off' }, icon('star', { size: 16 }))))),
        h('div', { class: 'bz-review-avg-text' },
          h('div', null, t(`${reviews.length} შეფასება აპის მომხმარებლებისგან`, `${reviews.length} reviews from app users`)),
          h('div', { class: unanswered ? 'bz-warn' : 'bz-ok' }, unanswered ? t(`${unanswered} პასუხის გარეშე — პასუხი საჯაროა და ნდობას მატებს`, `${unanswered} without a reply — replies are public and build trust`) : t('ყველას უპასუხე', 'Every review answered')),
          h('div', { class: 'bz-note' }, t(`${Math.round((dist[0].count / reviews.length) * 100)}% ხუთვარსკვლავიანი`, `${Math.round((dist[0].count / reviews.length) * 100)}% five-star`))))),
      card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('ვარსკვლავებით', 'By stars')),
        meters(dist.map((d) => ({ name: `${d.n} ★`, value: d.count, max: Math.max(1, ...dist.map((x) => x.count)), right: String(d.count), color: d.n >= 4 ? 'var(--c1)' : d.n === 3 ? 'var(--warn)' : 'var(--danger)' }))))));
  }

  function paint() {
    if (!reviews.length) return;
    const staffNames = [...new Set(reviews.map((r) => r.staffName).filter(Boolean))];
    mount(staffHost, staffNames.length > 1 ? select([{ value: '', label: t('ყველა თანამშრომელი', 'Everyone') }, ...staffNames.map((n) => ({ value: n, label: n }))], st.staff, { onChange: (e) => { ls.set({ staff: e.target.value }); page = 1; paint(); }, style: { maxWidth: '190px' } }) : null);
    mount(chipsHost, chips([
      ['', t('ყველა', 'All'), reviews.length],
      ['unanswered', t('პასუხის გარეშე', 'Without a reply'), reviews.filter((r) => !r.reply).length],
      ['5', '5 ★', reviews.filter((r) => r.rating === 5).length],
      ['4', '4 ★', reviews.filter((r) => r.rating === 4).length],
      ['low', t('3 ★ და ქვემოთ', '3 ★ and below'), reviews.filter((r) => r.rating <= 3).length],
      ['text', t('ტექსტით', 'With text'), reviews.filter((r) => r.text).length],
    ], st.filter, (v) => { ls.set({ filter: v }); page = 1; paint(); }));
    const rows = reviews.filter((r) => {
      if (st.filter === 'unanswered' && r.reply) return false;
      if (st.filter === '5' && r.rating !== 5) return false;
      if (st.filter === '4' && r.rating !== 4) return false;
      if (st.filter === 'low' && r.rating > 3) return false;
      if (st.filter === 'text' && !r.text) return false;
      if (st.staff && r.staffName !== st.staff) return false;
      return true;
    });
    count.textContent = t(`${rows.length} შეფასება`, `${rows.length} ${rows.length === 1 ? 'review' : 'reviews'}`);
    if (!rows.length) { mount(host, card(emptyBox(t('ამ ფილტრით არაფერია', 'Nothing with this filter'), ''))); return; }
    const pg = paginate(rows, page, st.size);
    mount(host,
      card(pg.rows.map((r) => reviewRow(r))),
      pager({ ...pg, size: st.size, onPage: (p) => { page = p; paint(); host.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, onSize: (n) => { ls.set({ size: n }); page = 1; paint(); } }));
  }

  function reviewRow(r) {
    const manage = canManage();
    const box = textarea({ rows: 2, value: r.reply || '', placeholder: t('საჯარო პასუხი — აპში ყველა ხედავს', 'Public reply — everyone in the app sees it') });
    const save = button(r.reply ? t('პასუხის შეცვლა', 'Update reply') : t('პასუხის გაგზავნა', 'Send reply'), { size: 'sm', variant: 'secondary', icon: 'send', onClick: () => busy(save, async () => { try { await biz.post(`/reviews/${r.id}/reply`, { reply: box.value.trim() || null }); ok(t('შენახულია', 'Saved')); load(); } catch (e) { fail(e); } }) });
    const editing = h('div', { class: 'bz-review-edit', hidden: Boolean(r.reply) }, box,
      h('div', { class: 'bz-inline', style: { justifyContent: 'flex-end' } }, r.reply ? button(t('გაუქმება', 'Cancel'), { size: 'sm', variant: 'ghost', onClick: () => { editing.hidden = true; } }) : null, save));
    return h('div', { class: `bz-review${r.rating <= 2 ? ' is-low' : ''}${r.reply ? '' : ' is-open'}` },
      avatar(r.clientName, '#64748B', 40),
      h('div', { class: 'bz-review-body' },
        h('div', { class: 'meta' },
          h('b', null, r.clientName),
          h('span', { class: 'bz-stars' }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= r.rating ? '' : 'off' }, icon('star', { size: 13 })))),
          h('span', null, dateText(r.createdAt)),
          h('span', { class: 'svc' }, `${r.serviceName}${r.staffName ? ` · ${r.staffName}` : ''}`),
          !r.reply ? h('span', { class: 'bz-tag bz-tag-warn' }, t('პასუხის გარეშე', 'No reply')) : null),
        r.text ? h('p', { class: 'text' }, r.text) : h('p', { class: 'text faint' }, t('ტექსტის გარეშე', 'No text')),
        r.reply ? h('div', { class: 'bz-reply' }, h('span', { class: 'lbl' }, t('თქვენი პასუხი', 'Your reply')), h('span', { class: 'what' }, r.reply), manage ? h('button', { type: 'button', class: 'bz-link', onClick: () => { editing.hidden = false; box.focus(); } }, t('შეცვლა', 'Edit')) : null) : null,
        manage ? editing : null));
  }

  mount(root,
    pageHead(t('შეფასებები', 'Reviews'), t('აპის მომხმარებლების შეფასებები დასრულებული ვიზიტების შემდეგ. პასუხი საჯაროა.', 'Ratings from app users after completed visits. Replies are public.')),
    top,
    filterBar(h('div', { class: 'bz-filters-row' }, chipsHost, staffHost, h('span', { class: 'spacer' }), count)),
    host);
  await load();
}
