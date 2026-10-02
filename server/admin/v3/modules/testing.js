/**
 * MediCard Admin V3 — #/testing ტესტირება (QA lab, /api/admin/qa/*).
 * Test runs with their checks, results, methods and screenshot evidence. Forms open in the shared
 * AdminV3 dialog; screenshots load through the authenticated endpoint as blob URLs.
 */
(function adminV3Testing(global) {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (n) => (typeof global.icon === 'function' ? global.icon(n) : '');
  const V = () => global.AdminV3 || {};
  const STATUS = { PENDING: 'შესამოწმებელი', PASS: 'გაიარა', FAIL: 'ხარვეზი', BLOCKED: 'დაბლოკილი', SKIPPED: 'გამოტოვებული' };
  const STATUS_TONE = { PENDING: 'is-info', PASS: 'is-ok', FAIL: 'is-bad', BLOCKED: 'is-warn', SKIPPED: 'is-plain' };
  const RUN_STATUS = { OPEN: ['მიმდინარე', 'is-info'], COMPLETE: ['დასრულებული', 'is-ok'], ARCHIVED: ['არქივში', 'is-plain'] };
  const METHODS = { MANUAL: 'ხელით შემოწმება', HTTP: 'სერვერი / ბაზა', UNIT: 'ავტომატური ტესტი', EXPO_WEB: 'Expo Web', DEVICE: 'რეალური მოწყობილობა' };
  // Values are the server's module enum (qaRunCreate); only the labels are Georgian.
  const MODULES = { cycle: 'ციკლი', analysis: 'ანალიზები', chat: 'Medi · საუბარი', pets: 'ცხოველები · Medi Vet', medirun: 'MEDIRUN', quest: 'Medi Quest', other: 'სხვა' };
  const request = (p, o) => api('/qa' + p, o);
  const can = (cap) => state.admin?.capabilities == null || state.admin.capabilities.includes(cap);
  const when = (iso, mode = 'datetime') => (V().formatDate ? V().formatDate(iso, mode) : String(iso || '—'));
  const btn = (id, label, cls = 'ghost') => `<button type="button" class="btn compact ${cls}" data-qa="${id}">${label}</button>`;
  const field = (name, label, value = '', extra = '', hint = '') => `<label class="s-field"><span>${label}</span><input name="${name}" value="${esc(value)}" ${extra}>${hint ? `<small>${hint}</small>` : ''}</label>`;
  const area = (name, label, value = '', max = 5000, rows = 4) => `<label class="s-field"><span>${label}</span><textarea name="${name}" maxlength="${max}" rows="${rows}">${esc(value)}</textarea></label>`;
  const select = (name, label, options, selected) => `<label class="s-field"><span>${label}</span><select name="${name}">${options.map(([v, l]) => `<option value="${esc(v)}"${v === selected ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`;
  let runId = null;
  let filter = '';
  let offset = 0;
  let ticket = 0;
  let urls = [];

  if (typeof ICONS === 'object' && !ICONS.plus) ICONS.plus = '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';

  function release() {
    urls.forEach((u) => URL.revokeObjectURL(u));
    urls = [];
  }

  /**
   * A form in the shared dialog. Native validation (required, pattern, maxlength) runs on submit and the
   * request body is the form's own fields, so the payloads stay exactly what the server's strict schemas expect.
   */
  function formDialog({ title, description, body, saveLabel, onSave }) {
    const formId = `qa-form-${Date.now()}`;
    const dialog = V().openDialog?.({
      title,
      description,
      body: `<form id="${formId}" class="s-stack qa-form">${body}</form>`,
      footer: `<p class="s-form-msg qa-form-msg" role="alert"></p><button type="button" class="btn" data-cancel>გაუქმება</button><button type="submit" class="btn primary" form="${formId}">${esc(saveLabel)}</button>`,
    });
    const form = document.getElementById(formId);
    const panel = form?.closest('.v3-dialog-panel');
    if (!form || !panel) return;
    panel.querySelector('[data-cancel]').onclick = () => void dialog.close();
    form.querySelector('input:not([type=file]), select, textarea')?.focus();
    form.onsubmit = async (e) => {
      e.preventDefault();
      const submit = panel.querySelector('[type=submit]');
      const msg = panel.querySelector('[role=alert]');
      submit.disabled = true;
      submit.classList.add('is-loading');
      msg.textContent = '';
      try {
        await onSave(Object.fromEntries(new FormData(form)));
        V().setDirty?.(false);
        await dialog.close();
        await render();
      } catch (err) {
        msg.textContent = err.message || 'შენახვა ვერ მოხერხდა.';
        submit.disabled = false;
        submit.classList.remove('is-loading');
      }
    };
  }

  function newRun() {
    formDialog({
      title: 'ახალი ტესტირება',
      description: 'ჩაიწერება, რა შემოწმდა, რა დარჩა და როგორ გამოიყურებოდა შედეგი.',
      body: field('title', 'სათაური', 'ციკლის სრული შემოწმება', 'required maxlength="160"')
        + `<div class="s-form-grid">${field('version', 'აპის ვერსია', '', 'required maxlength="50" placeholder="მაგ. 1.0.0.18.15"')}
          ${field('environment', 'გარემო / სერვერი', 'ადგილობრივი სატესტო', 'required maxlength="100"')}
          ${field('device', 'მოწყობილობა / ბრაუზერი', '', 'required maxlength="150" placeholder="მაგ. iPhone 15 · iOS 26"')}
          ${select('module', 'მოდული', Object.entries(MODULES), 'cycle')}</div>`
        + select('template', 'საწყისი გეგმა', [['cycle', 'ციკლი · 33 ეტაპი'], ['empty', 'ცარიელი გეგმა']], 'cycle')
        + area('notes', 'შენიშვნა / ტესტირების ფარგლები'),
      saveLabel: 'შექმნა',
      onSave: async (data) => {
        const r = await request('/runs', { method: 'POST', body: data });
        runId = r.id;
      },
    });
  }

  function addCheck() {
    formDialog({
      title: 'ეტაპის დამატება',
      // "\-": browsers compile pattern attributes with the v flag, where an unescaped trailing "-" is a syntax error.
      body: field('caseKey', 'უნიკალური კოდი', '', 'required pattern="[a-zA-Z0-9_\\-]+" maxlength="80"', 'ლათინური ასოები, ციფრები, _ და - (მაგ. dark_theme).')
        + field('title', 'ეტაპის სახელი', '', 'required maxlength="180"')
        + field('stage', 'ჯგუფი', '', 'required maxlength="100"')
        + area('steps', 'როგორ ვამოწმებთ')
        + area('expected', 'მოსალოდნელი შედეგი'),
      saveLabel: 'დამატება',
      onSave: (data) => request('/runs/' + runId + '/checks', { method: 'POST', body: data }),
    });
  }

  function updateRun(run, status) {
    const copy = {
      OPEN: ['ტესტირების ხელახლა გახსნა', 'გახსნა'],
      ARCHIVED: ['არქივში გადატანა', 'არქივში გადატანა'],
      COMPLETE: ['ტესტირების დასრულება', 'დასრულება'],
    }[status] || ['ტესტირების დასრულება', 'შენახვა'];
    formDialog({
      title: copy[0],
      description: 'შედეგები და სქრინები ისტორიაში შენარჩუნდება.',
      body: area('notes', 'შეჯამება / დარჩენილი შეზღუდვები', run.notes),
      saveLabel: copy[1],
      onSave: (data) => request('/runs/' + run.id, { method: 'PATCH', body: { ...data, status, revision: run.revision } }),
    });
  }

  function editCheck(check) {
    formDialog({
      title: check.title,
      description: check.expected ? `მოსალოდნელი: ${check.expected}` : '',
      body: `<div class="s-form-grid">${select('status', 'შედეგი', Object.entries(STATUS), check.status)}${select('method', 'შემოწმების მეთოდი', Object.entries(METHODS), check.method)}</div>`
        + area('actual', 'ფაქტობრივი შედეგი / ხარვეზი / შეზღუდვა', check.actual, 10000, 5),
      saveLabel: 'შენახვა',
      onSave: (data) => request('/checks/' + check.id, { method: 'PATCH', body: { ...data, revision: check.revision } }),
    });
  }

  function attach(check) {
    formDialog({
      title: 'სქრინის დამატება',
      description: 'გამოიყენე სინთეზური სატესტო მონაცემები. სქრინს ხედავენ მხოლოდ ადმინები.',
      body: field('caption', 'რას აჩვენებს სქრინი', '', 'required maxlength="240"')
        + '<label class="s-field"><span>სურათი</span><input type="file" name="file" required accept="image/png,image/jpeg,image/webp"><small>PNG, JPEG ან WebP · მაქსიმუმ 1 MB</small></label>',
      saveLabel: 'ატვირთვა',
      onSave: async (data) => {
        const file = data.file;
        if (!file?.size || file.size > 1024 * 1024) throw new Error('სქრინი უნდა იყოს მაქსიმუმ 1 MB.');
        const base64 = await new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result).split(',')[1]);
          r.onerror = () => reject(new Error('ფაილი ვერ წავიკითხეთ.'));
          r.readAsDataURL(file);
        });
        await request('/checks/' + check.id + '/evidence', { method: 'POST', body: { caption: data.caption, mimeType: file.type, base64 } });
      },
    });
  }

  function openShot(img, check) {
    if (!img?.src) return;
    V().openDialog?.({
      title: check?.title || 'სქრინი',
      description: img.alt || '',
      wide: true,
      watchDirty: false,
      body: `<figure class="qa-shot"><img src="${esc(img.src)}" alt="${esc(img.alt)}"></figure>`,
    });
  }

  async function loadImage(id, node, revision) {
    try {
      const response = await fetch(API + '/api/admin/qa/evidence/' + id, { headers: { Authorization: 'Bearer ' + state.token } });
      if (!response.ok) throw new Error('სქრინი ვერ ჩაიტვირთა.');
      const blob = await response.blob();
      if (revision !== ticket || !node.isConnected) return;
      const url = URL.createObjectURL(blob);
      urls.push(url);
      node.src = url;
    } catch {
      if (node.isConnected) {
        node.alt = 'სქრინი ვერ ჩაიტვირთა — განაახლე გვერდი';
        node.parentElement.classList.add('is-error');
      }
    }
  }

  function runCard(run) {
    const s = run.summary || {};
    const total = Number(s.total) || 0;
    const pass = Number(s.PASS) || 0;
    const fail = Number(s.FAIL) || 0;
    const [label, tone] = RUN_STATUS[run.status] || [run.status, 'is-plain'];
    return `<button type="button" class="qa-run" data-run="${esc(run.id)}">
      <span class="qa-run-top"><span class="s-badge ${tone}">${esc(label)}</span><span class="qa-run-module">${esc(MODULES[run.module] || run.module)}</span></span>
      <span class="qa-run-title">${esc(run.title)}</span>
      <span class="qa-run-meta">${esc(run.version)} · ${esc(run.device)}</span>
      <span class="qa-run-meta">${esc(run.environment)} · ${esc(when(run.createdAt, 'date'))}</span>
      <span class="s-meter" aria-hidden="true"><i style="width:${total ? Math.round((pass / total) * 100) : 0}%"></i></span>
      <span class="qa-run-foot"><span>${pass} / ${total} გაიარა</span><span class="${fail ? 'qa-fail' : ''}">${fail ? `${fail} ხარვეზი` : 'ხარვეზი არ არის'}</span></span>
    </button>`;
  }

  function checkCard(c, editing) {
    return `<article class="qa-check" data-status="${esc(c.status)}">
      <header class="qa-check-top"><span class="qa-stage">${esc(c.stage)}</span><span class="s-badge ${STATUS_TONE[c.status] || 'is-plain'}">${esc(STATUS[c.status] || c.status)}</span></header>
      <h4 class="qa-check-title">${esc(c.title)}</h4>
      <p class="qa-actual${c.actual ? '' : ' is-empty'}">${esc(c.actual || 'ჯერ არ შემოწმებულა.')}</p>
      <details class="qa-steps"><summary>როგორ ვამოწმებთ და რას ველით</summary>
        <div><p>${esc(c.steps)}</p><b>მოსალოდნელი</b><p>${esc(c.expected)}</p><p class="qa-key">კოდი: <code>${esc(c.caseKey)}</code></p></div></details>
      <p class="qa-check-meta">${esc(METHODS[c.method] || c.method)} · ${esc(when(c.updatedAt))}</p>
      ${c.evidence.length ? `<div class="qa-evidence">${c.evidence.map((e) => `<button type="button" class="qa-thumb" data-evidence="${esc(e.id)}" aria-label="${esc(e.caption)}"><img loading="lazy" alt="${esc(e.caption)}" data-image="${esc(e.id)}"><span>${esc(e.caption)}</span></button>`).join('')}</div>` : ''}
      ${editing ? `<div class="qa-check-actions"><button type="button" class="btn compact" data-edit="${esc(c.id)}">შედეგის ჩაწერა</button><button type="button" class="btn compact ghost" data-attach="${esc(c.id)}">${ico('plus')} სქრინი</button></div>` : ''}
    </article>`;
  }

  function stateCard(icon, title, text, raw, actions = '') {
    return `<div class="s-stack v3-tab-shell"><div class="s-card"><div class="s-empty">${ico(icon)}<strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ''}${raw ? `<small class="p3-raw" role="alert">${esc(raw)}</small>` : ''}${actions ? `<div class="p3-actions">${actions}</div>` : ''}</div></div></div>`;
  }

  async function render() {
    const root = document.getElementById('tab-testing');
    if (!root) return;
    const revision = ++ticket;
    release();
    global.AdminV3Shell?.mountHeader?.({ tab: 'testing', kicker: 'Production', title: 'ტესტირება', purpose: 'ტესტირების სესიები, ეტაპები, შედეგები და ხარვეზები.' });
    root.classList.add('v3-workspace-wide');
    root.innerHTML = `<div class="s-stack v3-tab-shell" role="status" aria-label="იტვირთება"><div class="v3-skel" aria-hidden="true">${'<i></i>'.repeat(6)}</div></div>`;
    if (!can('QA_VIEW')) {
      root.innerHTML = stateCard('lock', 'ტესტირების სანახავად უფლება გჭირდება', 'ამ გვერდს ხედავს მხოლოდ ადმინი, რომელსაც ტესტირების ნახვის უფლება აქვს.');
      return;
    }
    try {
      if (!runId) {
        const data = await request('/runs?offset=' + offset);
        if (revision !== ticket) return;
        const manage = can('QA_MANAGE');
        root.innerHTML = `<div class="s-stack v3-tab-shell">
          <div class="s-toolbar">
            <span class="p3-meta">${data.total} ტესტირება · ახალი პირველი</span>
            ${manage ? `<button type="button" class="btn primary compact" data-qa="new">${ico('plus')} ახალი ტესტირება</button>` : ''}
          </div>
          ${data.rows.length ? `<div class="qa-run-grid">${data.rows.map(runCard).join('')}</div>` : ''}
          ${!data.total ? `<div class="s-card"><div class="s-empty">${ico('check')}<strong>ტესტირება ჯერ არ შექმნილა</strong><span>${manage ? 'დააჭირე „ახალი ტესტირება“ — დაიწყე მზა ციკლის გეგმით ან შენი ეტაპებით.' : 'აქ გამოჩნდება ტესტირების სესიები და მათი შედეგები.'}</span></div></div>` : ''}
          ${offset || offset + 30 < data.total ? `<div class="qa-pager"><span>${offset + 1}–${Math.min(offset + 30, data.total)} / ${data.total}</span><div>${offset ? btn('prev', 'წინა') : ''}${offset + 30 < data.total ? btn('next', 'შემდეგი') : ''}</div></div>` : ''}
        </div>`;
        root.querySelectorAll('[data-run]').forEach((b) => {
          b.onclick = () => {
            runId = b.dataset.run;
            filter = '';
            void render();
          };
        });
        root.querySelector('[data-qa=new]')?.addEventListener('click', newRun);
        root.querySelector('[data-qa=prev]')?.addEventListener('click', () => {
          offset = Math.max(0, offset - 30);
          void render();
        });
        root.querySelector('[data-qa=next]')?.addEventListener('click', () => {
          offset += 30;
          void render();
        });
        return;
      }
      const run = await request('/runs/' + runId);
      if (revision !== ticket) return;
      const manage = can('QA_MANAGE');
      const editing = run.status === 'OPEN' && manage;
      const checks = run.checks.filter((c) => !filter || c.status === filter);
      const s = run.summary || {};
      const [statusLabel, statusTone] = RUN_STATUS[run.status] || [run.status, 'is-plain'];
      const metric = (label, value, tone = '') => `<div class="s-metric ${tone}"><span>${label}</span><strong>${Number(value) || 0}</strong></div>`;
      root.innerHTML = `<div class="s-stack v3-tab-shell">
        <div class="s-toolbar">
          ${btn('back', `${ico('chevronLeft')} ყველა ტესტირება`)}
          <div class="p3-tools">${btn('refresh', `${ico('refresh')} განახლება`)}${btn('export', `${ico('download')} ანგარიშის ჩამოტვირთვა (JSON)`)}</div>
        </div>
        <section class="s-card qa-head">
          <header class="s-card-head">
            <div>
              <p class="qa-eyebrow">${esc(MODULES[run.module] || run.module)} · ${esc(run.version)}</p>
              <h3 class="qa-head-title">${esc(run.title)}</h3>
              <p>${esc(run.environment)} · ${esc(run.device)} · შეიქმნა ${esc(when(run.createdAt, 'date'))}</p>
            </div>
            <div class="p3-tools">
              <span class="s-badge ${statusTone}">${esc(statusLabel)}</span>
              ${manage ? `${editing ? `${btn('add', `${ico('plus')} ეტაპი`)}${btn('complete', 'დასრულება', 'primary')}` : btn('reopen', 'ხელახლა გახსნა')}${run.status !== 'ARCHIVED' ? btn('archive', 'არქივი') : ''}` : ''}
            </div>
          </header>
          <div class="s-card-body"><p class="qa-notes${run.notes ? '' : ' is-empty'}">${esc(run.notes || 'აქ ინახება ტესტირების ფაქტობრივი შედეგები. „გაიარა“ აღნიშნავს მხოლოდ მითითებული მეთოდით შემოწმებულ სცენარს.')}</p></div>
        </section>
        <div class="s-metrics">
          ${metric('ეტაპი', s.total)}
          ${metric('გაიარა', s.PASS)}
          ${metric('ხარვეზი', s.FAIL, s.FAIL ? 'is-bad' : '')}
          ${metric('შესამოწმებელი', s.PENDING)}
          ${metric('დაბლოკილი', s.BLOCKED, s.BLOCKED ? 'is-warn' : '')}
        </div>
        <div class="s-segment s-segment-wrap qa-filter" role="tablist" aria-label="შედეგით ფილტრი">${[['', 'ყველა', s.total], ...Object.entries(STATUS).map(([v, n]) => [v, n, s[v]])].map(([v, n, count]) => `<button type="button" role="tab" aria-selected="${filter === v}" data-filter="${v}">${n}<i${v === 'FAIL' && count ? ' class="is-hot"' : ''}>${Number(count) || 0}</i></button>`).join('')}</div>
        ${checks.length ? `<div class="qa-checks">${checks.map((c) => checkCard(c, editing)).join('')}</div>` : `<div class="s-card"><div class="s-empty">${ico('search')}<strong>ამ ფილტრში ეტაპი არ არის</strong><span>აირჩიე სხვა შედეგი ან „ყველა“.</span></div></div>`}
      </div>`;
      root.querySelector('[data-qa=back]').onclick = () => {
        runId = null;
        void render();
      };
      root.querySelector('[data-qa=refresh]').onclick = () => void render();
      root.querySelector('[data-qa=add]')?.addEventListener('click', addCheck);
      for (const [action, status] of [['complete', 'COMPLETE'], ['reopen', 'OPEN'], ['archive', 'ARCHIVED']]) {
        root.querySelector('[data-qa=' + action + ']')?.addEventListener('click', () => updateRun(run, status));
      }
      root.querySelectorAll('[data-filter]').forEach((b) => {
        b.onclick = () => {
          filter = b.dataset.filter;
          void render();
        };
      });
      root.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => editCheck(run.checks.find((c) => c.id === b.dataset.edit)); });
      root.querySelectorAll('[data-attach]').forEach((b) => { b.onclick = () => attach(run.checks.find((c) => c.id === b.dataset.attach)); });
      root.querySelectorAll('[data-image]').forEach((img) => void loadImage(img.dataset.image, img, revision));
      root.querySelectorAll('[data-evidence]').forEach((b) => {
        b.onclick = () => openShot(b.querySelector('img'), run.checks.find((c) => c.evidence.some((e) => e.id === b.dataset.evidence)));
      });
      root.querySelector('[data-qa=export]').onclick = () => {
        const url = URL.createObjectURL(new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'medicard-qa-' + run.id + '.json';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
    } catch (err) {
      if (revision !== ticket) return;
      root.innerHTML = stateCard('alert', 'ტესტირება ვერ ჩაიტვირთა', 'შეამოწმე კავშირი და სცადე ხელახლა.', err.message,
        `${runId ? btn('back', `${ico('chevronLeft')} ყველა ტესტირება`) : ''}${btn('retry', 'ხელახლა ცდა', '')}`);
      root.querySelector('[data-qa=retry]').onclick = () => void render();
      root.querySelector('[data-qa=back]')?.addEventListener('click', () => {
        runId = null;
        void render();
      });
    }
  }

  global.renderTesting = render;
})(window);
