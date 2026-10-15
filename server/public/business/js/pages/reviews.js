// MEDIBOOK business panel — reviews from the app, with a public reply.
import { h, mount, icon, button, pageHead, card, textarea, busy } from '/app/js/ui.js';
import { meters } from '/app/js/charts.js';
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
      const dist = [5, 4, 3, 2, 1].map((n) => ({ n, count: reviews.filter((r) => r.rating === n).length }));
      const unanswered = reviews.filter((r) => !r.reply).length;
      mount(host,
        h('div', { class: 'bz-grid-2', style: { marginTop: 0, marginBottom: '16px' } },
          card(h('div', { class: 'bz-review-avg' },
            h('div', null, h('b', { class: 'big' }, avg.toFixed(1)), h('div', { class: 'bz-stars', style: { marginTop: '4px' } }, [1, 2, 3, 4, 5].map((i) => h('span', { class: i <= Math.round(avg) ? '' : 'off' }, icon('star', { size: 16 }))))),
            h('div', { class: 'bz-review-avg-text' },
              h('div', null, t(`${reviews.length} შეფასება აპის მომხმარებლებისგან`, `${reviews.length} reviews from app users`)),
              h('div', { class: unanswered ? 'bz-warn' : 'bz-ok' }, unanswered ? t(`${unanswered} პასუხის გარეშე — პასუხი საჯაროა და ნდობას მატებს`, `${unanswered} without a reply — replies are public and build trust`) : t('ყველას უპასუხე', 'Every review answered')),
              h('div', { class: 'bz-note' }, t(`${Math.round((dist[0].count / reviews.length) * 100)}% ხუთვარსკვლავიანი`, `${Math.round((dist[0].count / reviews.length) * 100)}% five-star`))))),
          card(h('div', { class: 'card-title', style: { marginBottom: '10px' } }, t('ვარსკვლავებით', 'By stars')),
            meters(dist.map((d) => ({ name: `${d.n} ★`, value: d.count, max: Math.max(1, ...dist.map((x) => x.count)), right: String(d.count), color: d.n >= 4 ? 'var(--c1)' : d.n === 3 ? 'var(--warn)' : 'var(--danger)' }))))),
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
