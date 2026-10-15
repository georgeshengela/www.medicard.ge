// MEDIBOOK business panel — reviews from the app, with a public reply.
import { h, mount, icon, button, pageHead, card, textarea, busy } from '/app/js/ui.js';
import { t } from '/app/js/i18n.js';
import { biz, dateText, emptyBox, fail, ok } from '../shared.js';
import { canManage } from '../state.js';

export default async function reviewsPage(root) {
  const host = h('div');
  async function paint() {
    mount(host, h('div', { class: 'skeleton-card' }, h('div', { class: 'sk' }), h('div', { class: 'sk' })));
    try {
      const { reviews } = await biz.get('/reviews');
      if (!reviews.length) { mount(host, card(emptyBox(t('შეფასებები ჯერ არ არის', 'No reviews yet'), t('ვიზიტის დასრულებიდან რამდენიმე საათში აპი კლიენტს თავად ეკითხება „როგორ იყო?“. შეფასება აქ და აპის გვერდზე ჩნდება.', 'A few hours after a completed visit the app asks the client "how was it?". Reviews show here and on your page in the app.')))); return; }
      const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
      mount(host,
        h('div', { class: 'bz-kpis', style: { marginBottom: '16px' } },
          h('div', { class: 'bz-kpi is-accent' }, h('div', { class: 'stat-label' }, t('საშუალო', 'Average')), h('div', { class: 'stat-value' }, avg.toFixed(1)), h('div', { class: 'stat-delta' }, t(`${reviews.length} შეფასება`, `${reviews.length} reviews`))),
          h('div', { class: 'bz-kpi' }, h('div', { class: 'stat-label' }, t('პასუხის გარეშე', 'Without a reply')), h('div', { class: 'stat-value' }, String(reviews.filter((r) => !r.reply).length))),
          h('div', { class: 'bz-kpi' }, h('div', { class: 'stat-label' }, t('5 ვარსკვლავი', 'Five stars')), h('div', { class: 'stat-value' }, String(reviews.filter((r) => r.rating === 5).length))),
          h('div', { class: 'bz-kpi' }, h('div', { class: 'stat-label' }, t('1–2 ვარსკვლავი', 'One or two stars')), h('div', { class: 'stat-value' }, String(reviews.filter((r) => r.rating <= 2).length)))),
        card(reviews.map((r) => {
          const box = textarea({ rows: 2, value: r.reply || '', placeholder: t('საჯარო პასუხი — აპში ყველა ხედავს', 'Public reply — everyone in the app sees it') });
          const save = button(r.reply ? t('პასუხის შეცვლა', 'Update reply') : t('პასუხი', 'Reply'), { size: 'sm', variant: 'secondary', onClick: () => busy(save, async () => { try { await biz.post(`/reviews/${r.id}/reply`, { reply: box.value.trim() || null }); ok(t('შენახულია', 'Saved')); paint(); } catch (e) { fail(e); } }) });
          return h('div', { class: 'bz-review' },
            h('div', { class: 'meta' }, h('span', { class: 'bz-stars' }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= r.rating ? '' : 'off' }, icon('star', { size: 14 })))), h('span', null, dateText(r.createdAt)), h('span', null, `${r.serviceName}${r.staffName ? ` · ${r.staffName}` : ''}`), h('span', { class: 'faint' }, r.clientName)),
            r.text ? h('div', { style: { fontSize: '14.5px' } }, r.text) : h('div', { class: 'faint' }, t('ტექსტის გარეშე', 'No text')),
            r.reply && !canManage() ? h('div', { class: 'bz-reply' }, h('b', null, t('თქვენი პასუხი: ', 'Your reply: ')), r.reply) : null,
            canManage() ? h('div', { style: { display: 'grid', gap: '6px', marginTop: '4px' } }, box, h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, save)) : null);
        })));
    } catch (e) { mount(host, card(emptyBox(t('ვერ ჩაიტვირთა', 'Could not load'), e?.message))); }
  }
  mount(root, pageHead(t('შეფასებები', 'Reviews'), t('აპის მომხმარებლების შეფასებები დასრულებული ვიზიტების შემდეგ. პასუხი საჯაროა.', 'Ratings from app users after completed visits. Replies are public.')), host);
  await paint();
}
