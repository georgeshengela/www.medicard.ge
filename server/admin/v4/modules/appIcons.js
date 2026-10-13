/**
 * MediCard Admin V4 — #/app-icons „აპის აიქონები“ (/api/admin/usage/icons/overview, owner 2026-10-13:
 * „რამდენი ხმარობს და რომელს ხმარობენ“). The iPhone app reports the home-screen icon it shows (after sign-in / start
 * and right after a pick in Profile → „აპის აიქონი“); this page counts them: what the numbers say, key numbers, the
 * icon wall (every icon with its real picture and how many phones show it — the page's bold element) and who
 * switched, newest first. Phones report from app 1.0.0.21.50 on, so the count grows as people get the update.
 */
(function adminV4AppIcons(global) {
  const K = global.AdminUsage;
  if (!K) return;
  const { esc, fmt, pct, when, metric, metrics, card, insights, teamInsight, empty, userHref, initials } = K;

  // A phone home screen: four rounded tiles.
  K.glyphs({ appIcons: '<rect x="3.5" y="3.5" width="7" height="7" rx="2"/><rect x="13.5" y="3.5" width="7" height="7" rx="2"/><rect x="3.5" y="13.5" width="7" height="7" rx="2"/><rect x="13.5" y="13.5" width="7" height="7" rx="2"/>' });

  const img = (id) => `./v4/img/app-icons/${encodeURIComponent(id)}.webp`;
  const thumb = (icon, size = 'm') => `<img class="ai-thumb is-${size}" src="${esc(img(icon.id))}" alt="" loading="lazy" width="${size === 's' ? 28 : 64}" height="${size === 's' ? 28 : 64}">`;

  function wall(d) {
    const max = Math.max(1, ...d.icons.filter((i) => i.id !== 'classic').map((i) => i.count));
    const topId = d.kpis.top?.id;
    const tile = (i) => {
      const fill = i.id === 'classic' ? 0 : Math.round((i.count / max) * 100);
      return `<figure class="ai-tile${i.count ? '' : ' is-zero'}${i.id === topId ? ' is-top' : ''}" title="${esc(`${i.name}: ${fmt(i.count)}`)}">
        ${thumb(i)}
        <figcaption><b>${esc(i.name)}</b><span><strong>${fmt(i.count)}</strong>${i.share != null && i.count ? ` · ${pct(i.share)}` : ''}</span></figcaption>
        ${i.id === 'classic' ? '<em>ნაგულისხმევი</em>' : `<i class="ai-bar" style="--fill:${fill}%" aria-hidden="true"></i>`}
      </figure>`;
    };
    const groups = Object.keys(d.groupLabels).map((g) => {
      const list = d.icons.filter((i) => i.group === g).sort((a, b) => (a.id === 'classic' ? -1 : b.id === 'classic' ? 1 : b.count - a.count));
      return `<section class="ai-group">
        <h4 class="p2-h">${esc(d.groupLabels[g])}<span>${fmt(d.groups[g])} შეცვლილი</span></h4>
        <div class="ai-grid">${list.map(tile).join('')}</div>
      </section>`;
    }).join('');
    return card('ყველა აიქონი', 'რამდენ ტელეფონზეა ახლა თითოეული. ზოლი — ყველაზე პოპულარულთან შედარებით.', `<div class="ai-wall">${groups}</div>`, { cls: 'ai-card' });
  }

  function people(d) {
    const byId = Object.fromEntries(d.icons.map((i) => [i.id, i]));
    const rows = d.people.map((r) => {
      const p = r.person;
      const icon = byId[r.icon] || { id: r.icon, name: r.icon };
      return `<tr>
        <td><a class="s-uw-person" href="${esc(userHref(p.id))}" title="პროფილის გახსნა">
          <span class="s-uw-ava" aria-hidden="true">${esc(initials(p.name))}</span>
          <span><b>${esc(p.name || 'უსახელო')}${p.team ? ' · გუნდი' : ''}</b><small>${esc(p.contact || '')}</small></span>
        </a></td>
        <td><span class="ai-pick">${thumb(icon, 's')}<b>${esc(icon.name)}</b></span></td>
        <td class="num">${esc(when(r.changedAt))}</td>
        <td class="num">${esc(when(r.seenAt))}</td>
      </tr>`;
    }).join('');
    const body = d.people.length
      ? `<div class="s-table-wrap"><table class="s-table ai-people">
          <thead><tr><th>ადამიანი</th><th>აიქონი</th><th class="num">აირჩია</th><th class="num">ბოლოს გვაცნობა</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>`
      : empty('ჯერ არავის შეუცვლია აიქონი — ან მათ ტელეფონებს განახლება ჯერ არ მიუღიათ.');
    return card('ვინ შეცვალა', 'ბოლო ცვლილება ზემოთ. „აირჩია“ — როცა ეს აიქონი პირველად ვნახეთ.', body, { flush: true });
  }

  function paint(d) {
    const k = d.kpis;
    const reach = k.iphones ? Math.round((k.reporting / k.iphones) * 1000) / 10 : null;
    const g = d.groups;
    const read = [
      ['info', k.reporting
        ? `<b>${fmt(k.reporting)}</b> iPhone-მა უკვე გვაცნობა, რომელი აიქონი აქვს${reach != null ? ` — ბოლო 30 დღის ${fmt(k.iphones)} აქტიური iPhone-ის ${pct(reach)}` : ''}. დანარჩენები აპის განახლების (1.0.0.21.50) შემდეგ, შემდეგ გახსნაზე გამოჩნდებიან.`
        : 'ჯერ არცერთ ტელეფონს არ გვიცნობებია აიქონი. ითვლება აპის 1.0.0.21.50 ვერსიიდან — ტელეფონები განახლებას თავისით იღებენ და შემდეგ გახსნაზე გვაცნობებენ.'],
      k.reporting ? ['ok', k.changed
        ? `<b>${fmt(k.changed)}</b> ადამიანმა (${pct(k.changedShare)}) შეცვალა კლასიკური აიქონი. ${k.top ? `ყველაზე პოპულარულია „${esc(k.top.name)}“ — ${fmt(k.top.count)}.` : ''}`
        : 'ვინც გვაცნობა, ყველას კლასიკური აიქონი აქვს.'] : null,
      k.changed ? ['muted', `ჯგუფებით: ქალური — ${fmt(g.women)}, სტილები — ${fmt(g.styles)}, კლასიკური ფერები — ${fmt(g.core)}.`] : null,
      teamInsight(d),
    ];
    return `
      ${insights(read)}
      ${metrics([
        metric('გვაცნობა', fmt(k.reporting), reach != null ? `აქტიური iPhone-ების ${pct(reach)}` : 'iPhone'),
        metric('შეცვალა', fmt(k.changed), k.changedShare != null ? `${pct(k.changedShare)} მათგან` : ''),
        metric('კლასიკური', fmt(k.classic), 'ნაგულისხმევი აიქონი'),
        metric('ყველაზე პოპულარული', k.top ? esc(k.top.name) : '—', k.top ? `${fmt(k.top.count)} ტელეფონი` : ''),
      ])}
      ${wall(d)}
      ${people(d)}
      ${K.definitions([
        '<b>როგორ ვიგებთ</b> — iPhone-ის აპი სერვერს უგზავნის მხოლოდ აიქონის სახელს: შესვლისას ან აპის გახსნისას (თუ შეიცვალა, ან კვირაში ერთხელ) და მაშინვე, როცა პროფილში „აპის აიქონი“-დან აირჩევენ. ერთ ანგარიშს ერთი ჩანაწერი აქვს — ბოლო აიქონი.',
        '<b>გვაცნობა</b> — ანგარიშები, რომელთა ტელეფონმაც აიქონი ერთხელ მაინც გამოგზავნა (აპი 1.0.0.21.50 და ახალი). <b>აქტიური iPhone</b> — ანგარიშები, რომლებიც ბოლო 30 დღეში iPhone-ით შემოვიდნენ. Android-ზე და ვებში აიქონის შეცვლა არ არის.',
        '<b>აირჩია</b> — როცა სერვერმა ეს აიქონი პირველად ნახა. ვინც განახლებამდე შეცვალა, მისი თარიღი პირველი შეტყობინების დღეა. <b>გუნდი</b> — ზუსტად @medicard.ge ანგარიშები, ჩვეულებრივ არ ითვლება.',
      ])}`;
  }

  global.renderAppIcons = K.page({ tab: 'app-icons', path: '/usage/icons/overview', capability: 'PRODUCT_USAGE_VIEW', paint });
})(window);
