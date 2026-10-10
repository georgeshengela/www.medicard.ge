/**
 * MediCard Admin V3 — App mode (full override of renderSettings).
 * Production controls: maintenance, force update, registration, QA OTP, support.
 * URL range/grain are unused by settings APIs.
 */
(function adminV3Settings(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

  /** Mirrors the PATCH /settings validation, so a bad value is caught at its field before the request. */
  const FIELD_RULES = {
    'set-msg': (v) => (v.length >= 3 && v.length <= 500 ? '' : 'შეტყობინება უნდა იყოს 3-დან 500 სიმბოლომდე.'),
    'set-minver': (v) => (/^\d+\.\d+\.\d+(?:\.\d+){0,2}$/.test(v) ? '' : 'ჩაწერე ვერსია ციფრებითა და წერტილებით, მაგ. 1.0.0.13.0.'),
    'set-email': (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'ჩაწერე სწორი ელფოსტა, მაგ. support@medicard.ge.'),
  };

  function esc(v) {
    return typeof escapeHtml === 'function'
      ? escapeHtml(v)
      : String(v ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;');
  }
  function escA(v) {
    return typeof escapeAttr === 'function' ? escapeAttr(v) : esc(v).replaceAll("'", '&#39;');
  }
  function onOff(on) {
    return on ? 'ჩართულია' : 'გამორთულია';
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
  }
  function when(iso) {
    if (!iso) return '—';
    return V().formatDate ? V().formatDate(iso, 'datetime') : String(iso);
  }
  function toastMsg(msg, tone) {
    if (typeof toast === 'function') toast(msg, tone);
  }

  function metric(label, value, hint, tone) {
    return `<div class="s-metric${tone ? ` is-${tone}` : ''}"><span>${esc(label)}</span><strong>${esc(value)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</div>`;
  }

  function switchRow({ id, title, body }) {
    return `<div class="s-switch-row">
        <div><b>${esc(title)}</b>${body ? `<small>${esc(body)}</small>` : ''}</div>
        <input id="${escA(id)}" class="s-switch" type="checkbox" role="switch" aria-label="${escA(title)}" />
      </div>`;
  }

  function fieldBlock({ id, label, control, hint }) {
    return `<label class="s-field" for="${escA(id)}">
      <span>${esc(label)}</span>
      ${control}
      ${hint ? `<small>${esc(hint)}</small>` : ''}
      <em class="p2-field-err" id="${escA(id)}-err" role="alert"></em>
    </label>`;
  }

  function textInput({ id, value, placeholder, disabled, type }) {
    const t = type || 'text';
    if (t === 'textarea') {
      return `<textarea id="${escA(id)}" rows="3" maxlength="500" ${disabled ? 'disabled' : ''}>${esc(value || '')}</textarea>`;
    }
    return `<input id="${escA(id)}" type="${escA(t)}" value="${escA(value || '')}" placeholder="${escA(placeholder || '')}" ${disabled ? 'disabled' : ''} />`;
  }

  function panel({ title, description, helpKey, content }) {
    return `<section class="s-card" data-v3-settings="section">
      <header class="s-card-head">
        <div><h3>${esc(title)}</h3>${description ? `<p>${esc(description)}</p>` : ''}</div>
        ${helpKey ? helpBtn(helpKey) : ''}
      </header>
      <div class="s-card-body">${content}</div>
    </section>`;
  }

  function readBody() {
    return {
      maintenanceMode: Boolean($('set-maint')?.checked),
      maintenanceMessage: ($('set-msg')?.value || '').trim(),
      minAppVersion: ($('set-minver')?.value || '').trim(),
      forceUpdate: Boolean($('set-force')?.checked),
      allowRegistrations: Boolean($('set-reg')?.checked),
      qaOtpEnabled: Boolean($('set-qa-otp')?.checked),
      supportEmail: ($('set-email')?.value || '').trim(),
    };
  }

  function isFormDirty(baseline) {
    const body = readBody();
    return Object.keys(baseline).some((k) => String(body[k] ?? '') !== String(baseline[k] ?? ''));
  }

  function setFieldError(id, msg) {
    const el = $(id);
    const out = $(`${id}-err`);
    if (out) out.textContent = msg || '';
    if (el) {
      if (msg) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    }
  }

  /** Checks every text field; marks the bad ones and returns the first, or null when all are fine. */
  function validateFields() {
    let first = null;
    Object.entries(FIELD_RULES).forEach(([id, rule]) => {
      const msg = rule(($(id)?.value || '').trim());
      setFieldError(id, msg);
      if (msg && !first) first = $(id);
    });
    return first;
  }

  function syncDangerHints() {
    const maint = $('set-maint')?.checked;
    const force = $('set-force')?.checked;
    const qa = $('set-qa-otp')?.checked;
    const box = $('set-danger-live');
    if (!box) return;
    const bits = [];
    if (maint) bits.push('ტექნიკური სამუშაოები ჩართულია — მომხმარებლები აპში ვერ შედიან.');
    if (force) bits.push('იძულებითი განახლება ჩართულია — მინიმალურზე ძველი ვერსიები დაბლოკილია.');
    if (qa) bits.push('სატესტო OTP ჩართულია — კოდები 0000 / 000000 წარმოებაშიც მუშაობს.');
    box.innerHTML = bits.length
      ? `<div class="s-callout ${maint ? 'is-bad' : 'is-warn'}">${ico('alert')}<div>${bits.map((b) => `<p>${esc(b)}</p>`).join('')}</div></div>`
      : '';
  }

  function applyBaseline(settings) {
    if ($('set-maint')) $('set-maint').checked = Boolean(settings.maintenanceMode);
    if ($('set-force')) $('set-force').checked = Boolean(settings.forceUpdate);
    if ($('set-reg')) $('set-reg').checked = Boolean(settings.allowRegistrations);
    if ($('set-qa-otp')) $('set-qa-otp').checked = Boolean(settings.qaOtpEnabled);
    if ($('set-msg')) $('set-msg').value = settings.maintenanceMessage || '';
    if ($('set-minver')) $('set-minver').value = settings.minAppVersion || '';
    if ($('set-email')) $('set-email').value = settings.supportEmail || '';
    Object.keys(FIELD_RULES).forEach((id) => setFieldError(id, ''));
    syncDangerHints();
  }

  function bindDangerToggle(id, meta, baseline) {
    const Av = V();
    const el = $(id);
    if (!el || !Av.openConfirm) return;
    el.addEventListener('change', () => {
      const intended = el.checked;
      el.checked = !intended;
      Av.openConfirm({
        title: meta.title,
        message: meta.message(intended),
        confirmLabel: intended ? meta.confirmOn || 'ჩართვა' : meta.confirmOff || 'გამორთვა',
        cancelLabel: 'გაუქმება',
        variant: meta.variant || 'danger',
        onConfirm: async () => {
          el.checked = intended;
          Av.setDirty?.(isFormDirty(baseline));
          syncDangerHints();
        },
        onCancel: () => {
          Av.setDirty?.(isFormDirty(baseline));
        },
      });
    });
  }

  async function saveSettings(baseline, btn) {
    const Av = V();
    const invalid = validateFields();
    if (invalid) {
      invalid.focus();
      invalid.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      toastMsg('შეასწორე მონიშნული ველი და ისევ შეინახე.', 'bad');
      return;
    }
    const body = readBody();
    const turningOnDanger =
      (body.maintenanceMode && !baseline.maintenanceMode) ||
      (body.forceUpdate && !baseline.forceUpdate) ||
      (body.qaOtpEnabled && !baseline.qaOtpEnabled);

    const doSave = async () => {
      if (btn) {
        btn.disabled = true;
        btn.classList.add('is-loading');
      }
      try {
        const result = await api('/settings', { method: 'PATCH', body });
        toastMsg('რეჟიმი შენახულია', 'ok');
        const next = result?.settings || (await api('/settings')).settings;
        if (typeof setLivePill === 'function') setLivePill(next);
        Av.setDirty?.(false);
        await renderSettingsV3();
      } catch (err) {
        const msg = err?.message || 'შენახვა ვერ მოხერხდა';
        // The server refuses a minimum that would lock out the current app — show it at the version field.
        if (/მინიმუმ/.test(msg)) {
          setFieldError('set-minver', msg);
          $('set-minver')?.focus();
        }
        toastMsg(msg, 'bad');
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.classList.remove('is-loading');
        }
      }
    };

    if (turningOnDanger && Av.openConfirm) {
      Av.openConfirm({
        title: 'სახიფათო ცვლილებების შენახვა',
        message: 'შენახვა ჩართავს რეჟიმს, რომელიც ყველა მომხმარებელზე მოქმედებს. დარწმუნებული ხარ?',
        confirmLabel: 'შენახვა',
        variant: 'danger',
        onConfirm: doSave,
      });
      return;
    }
    await doSave();
  }

  /**
   * „განახლების ბარათი“ (owner 2026-10-11): when a phone has downloaded an OTA the app offers „განახლება“
   * by itself (switch, on by default); „სთხოვე ახლავე“ makes every older version look for it now. Acts at
   * once (own PUT /update-prompt), outside the page form and its save button. Never blocks anyone.
   */
  async function paintUpdatePrompt(data) {
    const host = $('set-update-card');
    if (!host) return;
    let d = data;
    if (!d) {
      try {
        d = await api('/update-prompt');
      } catch (err) {
        host.innerHTML = panel({ title: 'განახლების ბარათი', content: `<div class="s-empty">${ico('alert')}<strong>ვერ ჩაიტვირთა</strong><span>${esc(err.message || '')}</span></div>` });
        return;
      }
    }
    const pct = (n) => (d.activeUsers ? `${Math.round((n / d.activeUsers) * 100)}%` : '—');
    const asking = d.prompt.belowVersion;
    const rows = d.versions.slice(0, 8).map((v) => `<tr>
        <td><b>${esc(v.version)}</b>${v.version === d.latestVersion ? ' <span class="s-badge is-ok">უახლესი</span>' : v.behind ? ' <span class="s-badge is-warn">ძველი</span>' : ''}</td>
        <td class="num">${esc(v.users)}</td><td class="num">${esc(pct(v.users))}</td></tr>`).join('');
    host.innerHTML = panel({
      title: 'განახლების ბარათი',
      description: 'როცა ტელეფონი ახალ ვერსიას ჩამოტვირთავს, აპი თავად სთავაზობს „განახლებას“ — ერთი შეხება, App Store-ის გარეშე. არავის ბლოკავს.',
      content: `
        <div class="s-switch-row">
          <div><b>ბარათი ავტომატურად</b><small>${d.prompt.enabled ? 'ჩართულია — ახალი ვერსია თავად შეეთავაზება ყველას.' : 'გამორთულია — განახლება ჩაირთვება მხოლოდ მაშინ, როცა აპს 10+ წუთით დატოვებენ.'}</small></div>
          <input id="up-auto" class="s-switch" type="checkbox" role="switch" aria-label="ბარათი ავტომატურად" ${d.prompt.enabled ? 'checked' : ''} />
        </div>
        <div class="s-metrics" role="group" aria-label="ვერსიები ბოლო 7 დღეში">
          ${metric('უახლესი ვერსია', d.latestVersion || '—', 'ბოლო გამოშვება')}
          ${metric('აქტიური, 7 დღე', String(d.activeUsers), 'ბოლოს გამოყენებული ვერსიით')}
          ${metric('ძველ ვერსიაზე', String(d.behindUsers), `${pct(d.behindUsers)} ჯერ არ განახლებულა`, d.behindUsers ? 'warn' : '')}
        </div>
        ${rows ? `<table class="s-table"><thead><tr><th>ვერსია</th><th class="num">მომხმარებელი</th><th class="num">წილი</th></tr></thead><tbody>${rows}</tbody></table>` : ''}
        <div class="s-switch-row">
          <div><b>${asking ? `მოთხოვნა აქტიურია: ${esc(asking)}-ზე ძველები` : 'სთხოვე ძველ ვერსიებს ახლავე'}</b>
            <small>${asking ? `ჩაირთო ${esc(when(d.prompt.updatedAt))}. ეს ტელეფონები განახლებას მაშინვე მოძებნიან და ბარათს აჩვენებენ.` : 'ყველა ძველი ვერსია განახლებას ახლავე მოძებნის და ბარათს აჩვენებს — საათობრივი შემოწმების ლოდინის გარეშე.'}</small></div>
          ${asking
            ? '<button type="button" class="btn ghost compact" id="up-stop">შეწყვეტა</button>'
            : `<button type="button" class="btn primary compact" id="up-ask" ${d.latestVersion && d.prompt.enabled ? '' : 'disabled'}>${ico('refresh')} სთხოვე ახლავე</button>`}
        </div>`,
    });
    const save = async (body, okText) => {
      try {
        const next = await api('/update-prompt', { method: 'PUT', body });
        toastMsg(okText, 'ok');
        void paintUpdatePrompt(next);
      } catch (err) {
        toastMsg(err?.message || 'შენახვა ვერ მოხერხდა', 'bad');
        void paintUpdatePrompt();
      }
    };
    $('up-auto')?.addEventListener('change', (e) => {
      const on = e.currentTarget.checked;
      void save({ enabled: on }, on ? 'განახლების ბარათი ჩაირთო' : 'განახლების ბარათი გამოირთო');
    });
    $('up-ask')?.addEventListener('click', () => void save({ belowVersion: d.latestVersion }, `ვთხოვეთ ${d.latestVersion}-ზე ძველ ვერსიებს`));
    $('up-stop')?.addEventListener('click', () => void save({ belowVersion: '' }, 'მოთხოვნა შეწყდა'));
  }

  async function renderSettingsV3() {
    const root = $('tab-settings');
    if (!root) return;
    const Av = V();
    const Sh = Shell();

    Sh.mountHeader?.({
      tab: 'settings',
      kicker: 'Production',
      title: 'აპის რეჟიმი',
      purpose: 'აპის გაჩერება, განახლება და რეგისტრაცია.',
      helpKey: 'settings.page',
      actionsHtml: `<button type="button" class="btn ghost compact" id="set-refresh">${ico('refresh')} განახლება</button>`,
    });

    root.classList.add('v3-workspace-wide', 'v3-settings');
    root.innerHTML = `<div class="s-stack v3-tab-shell p2-ops" data-v3-settings="loading">${Av.skeleton ? Av.skeleton(5) : ''}</div>`;

    $('set-refresh')?.addEventListener('click', async () => {
      if (Av.dirty && Av.confirmLeave) {
        const ok = await Av.confirmLeave();
        if (!ok) return;
      }
      void renderSettingsV3();
    });

    let settings;
    try {
      ({ settings } = await api('/settings'));
    } catch (err) {
      root.innerHTML = `<div class="s-stack v3-tab-shell p2-ops" data-v3-settings="error">
        <div class="s-card"><div class="s-empty">${ico('alert')}<strong>პარამეტრები ვერ ჩაიტვირთა</strong><span>${esc(err.message || 'უცნობი შეცდომა')}</span>
          <button type="button" class="btn compact" id="set-retry">${ico('refresh')} ხელახლა ცდა</button></div></div>
      </div>`;
      $('set-retry')?.addEventListener('click', () => void renderSettingsV3());
      return;
    }

    if (typeof setLivePill === 'function') setLivePill(settings);

    const baseline = {
      maintenanceMode: Boolean(settings.maintenanceMode),
      maintenanceMessage: settings.maintenanceMessage || '',
      minAppVersion: settings.minAppVersion || '',
      forceUpdate: Boolean(settings.forceUpdate),
      allowRegistrations: Boolean(settings.allowRegistrations),
      qaOtpEnabled: Boolean(settings.qaOtpEnabled),
      supportEmail: settings.supportEmail || '',
    };

    root.innerHTML = `
      <div class="s-stack v3-tab-shell p2-ops" data-v3-settings="page">
        <div id="set-danger-live"></div>

        <div class="s-metrics" role="group" aria-label="შენახული რეჟიმი">
          ${metric('ტექნიკური სამუშაოები', onOff(settings.maintenanceMode), settings.maintenanceMode ? 'აპი მომხმარებლებისთვის გაჩერებულია' : 'აპი ჩვეულებრივ მუშაობს', settings.maintenanceMode ? 'bad' : '')}
          ${metric('იძულებითი განახლება', onOff(settings.forceUpdate), `მინიმალური ვერსია ${settings.minAppVersion || '—'}`, settings.forceUpdate ? 'warn' : '')}
          ${metric('რეგისტრაცია', settings.allowRegistrations ? 'ღიაა' : 'დახურულია', 'ახალი ანგარიშების გახსნა', settings.allowRegistrations ? '' : 'warn')}
          ${metric('სატესტო OTP კოდები', onOff(settings.qaOtpEnabled), 'ტესტ-ანგარიშებისთვის', settings.qaOtpEnabled ? 'warn' : '')}
        </div>

        <div id="set-update-card"></div>

        <div class="p2-settings-grid p2-form" id="settings-form">
          ${panel({
            title: 'ტექნიკური სამუშაოები',
            description: 'აპის დროებით გაჩერება ყველასთვის. ადმინი ამ დროსაც მუშაობს.',
            helpKey: 'settings.maintenance',
            content: `
              ${switchRow({
                id: 'set-maint',
                title: 'აპის გაჩერება',
                body: 'მომხმარებლები აპში ვერ შევლენ და ნახავენ ქვემოთ დაწერილ შეტყობინებას.',
              })}
              ${fieldBlock({
                id: 'set-msg',
                label: 'შეტყობინება მომხმარებლებს',
                hint: 'ჩანს აპში, სანამ რეჟიმი ჩართულია · 3–500 სიმბოლო',
                control: textInput({ id: 'set-msg', type: 'textarea', value: settings.maintenanceMessage || '' }),
              })}
            `,
          })}

          ${panel({
            title: 'განახლების პოლიტიკა',
            description: 'რომელ ვერსიაზე მოსთხოვოს აპმა ადამიანს განახლება.',
            helpKey: 'settings.forceUpdate',
            content: `
              ${switchRow({
                id: 'set-force',
                title: 'იძულებითი განახლება',
                body: 'მინიმალურზე ძველი ვერსია ვერ შევა — ადამიანს ჯერ განახლებას მოსთხოვს.',
              })}
              <div class="s-form-grid">
                <div class="s-field">
                  <span>აპის ბოლო ვერსია</span>
                  <div class="p2-static" id="set-mobile-ro">${esc(settings.mobileAppVersion || '—')}</div>
                  <small>ბოლო გამოშვება · აქ არ იცვლება</small>
                </div>
                ${fieldBlock({
                  id: 'set-minver',
                  label: 'მინიმალური ვერსია',
                  hint: 'ამაზე ძველს აპი განახლებას სთხოვს',
                  control: textInput({
                    id: 'set-minver',
                    value: settings.minAppVersion || '',
                    placeholder: settings.mobileAppVersion || '1.0.0',
                  }),
                })}
              </div>
            `,
          })}

          ${panel({
            title: 'რეგისტრაცია',
            description: 'ახალი ანგარიშების გახსნა აპში.',
            content: switchRow({
              id: 'set-reg',
              title: 'რეგისტრაცია ღიაა',
              body: 'გამორთვისას ახალი ანგარიში ვერ შეიქმნება; არსებული ანგარიშები მუშაობს.',
            }),
          })}

          ${panel({
            title: 'QA კონტროლი',
            description: 'სატესტო გადართვები — მხოლოდ ტესტირების დროს.',
            helpKey: 'settings.qa',
            content: switchRow({
              id: 'set-qa-otp',
              title: 'სატესტო OTP კოდები',
              body: 'კოდი 0000 (ტელეფონი) და 000000 (ელფოსტა) ყოველთვის მუშაობს. ტესტის შემდეგ გამორთე.',
            }),
          })}

          ${panel({
            title: 'მხარდაჭერა',
            description: 'საკონტაქტო მისამართი, რომელსაც აპი აჩვენებს.',
            content: fieldBlock({
              id: 'set-email',
              label: 'მხარდაჭერის ელფოსტა',
              control: textInput({ id: 'set-email', type: 'email', value: settings.supportEmail || '' }),
            }),
          })}
        </div>

        ${
          Av.stickyActions
            ? Av.stickyActions({
                dirty: false,
                danger: settings.updatedAt ? `<span class="p2-meta">ბოლოს შეინახა: ${esc(when(settings.updatedAt))}</span>` : '',
                cancel: `<button type="button" class="btn ghost" id="set-cancel">გაუქმება</button>`,
                save: `<button type="button" class="btn primary" id="set-save">${ico('check')} შენახვა</button>`,
              })
            : `<div class="p2-form-foot"><button type="button" class="btn ghost" id="set-cancel">გაუქმება</button><button type="button" class="btn primary" id="set-save">${ico('check')} შენახვა</button></div>`
        }
      </div>
    `;

    applyBaseline(baseline);
    Av.setDirty?.(false);
    Av.watchDirty?.($('settings-form'));
    void paintUpdatePrompt();

    bindDangerToggle(
      'set-maint',
      {
        title: 'ტექნიკური სამუშაოები',
        variant: 'danger',
        message: (on) =>
          on
            ? 'ჩართვის შემდეგ მომხმარებლები აპში ვერ შევლენ და დაინახავენ შეტყობინებას. ადმინი მუშაობს. გავაგრძელოთ?'
            : 'გამორთვის შემდეგ აპი ისევ ხელმისაწვდომი გახდება მომხმარებლებისთვის. გავაგრძელოთ?',
      },
      baseline,
    );
    bindDangerToggle(
      'set-force',
      {
        title: 'იძულებითი განახლება',
        variant: 'warning',
        message: (on) =>
          on
            ? 'მინიმალურზე ძველი ვერსიები ვეღარ შევლენ. დარწმუნდი, რომ მინიმალური ვერსია სწორია.'
            : 'იძულებითი განახლება გამოირთვება — ძველი ვერსიებიც შეძლებენ შესვლას.',
      },
      baseline,
    );
    bindDangerToggle(
      'set-qa-otp',
      {
        title: 'სატესტო OTP კოდები',
        variant: 'warning',
        message: (on) =>
          on
            ? 'სატესტო კოდები იმუშავებს წარმოებაშიც — ეს უსაფრთხოების რისკია. გავაგრძელოთ?'
            : 'სატესტო კოდები აღარ იმუშავებს.',
      },
      baseline,
    );

    $('set-cancel')?.addEventListener('click', async () => {
      if (Av.dirty && Av.confirmLeave) {
        const ok = await Av.confirmLeave();
        if (!ok) return;
      }
      applyBaseline(baseline);
      Av.setDirty?.(false);
    });

    $('set-save')?.addEventListener('click', () => {
      void saveSettings(baseline, $('set-save'));
    });

    ['set-msg', 'set-minver', 'set-email', 'set-reg'].forEach((id) => {
      $(id)?.addEventListener('input', () => {
        Av.setDirty?.(true);
        if (FIELD_RULES[id] && $(`${id}-err`)?.textContent) setFieldError(id, FIELD_RULES[id](($(id)?.value || '').trim()));
      });
      $(id)?.addEventListener('change', () => {
        Av.setDirty?.(isFormDirty(baseline));
        syncDangerHints();
      });
    });
  }

  global.renderSettings = renderSettingsV3;
})(window);
