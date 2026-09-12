/**
 * MediCard Admin V3 — Settings observatory (full override of renderSettings).
 * Production controls: maintenance, force update, registration, QA OTP, support.
 * URL range/grain are unused by settings APIs.
 */
(function adminV3Settings(global) {
  const Shell = () => global.AdminV3Shell || {};
  const V = () => global.AdminV3 || {};
  const $ = (id) => document.getElementById(id);

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
    return typeof onOffLabel === 'function' ? onOffLabel(on) : on ? 'ჩართულია' : 'გამორთულია';
  }
  function ico(name) {
    return typeof icon === 'function' ? icon(name) : '';
  }
  function helpBtn(key) {
    return V().infoButton ? V().infoButton(key) : '';
  }
  function shortDate(iso) {
    if (!iso) return '—';
    if (typeof fmtDate === 'function') return fmtDate(iso);
    if (typeof fmtDateShort === 'function') return fmtDateShort(iso);
    return String(iso);
  }

  function kpiCell(icoName, label, value, hint, tone) {
    const toneClass =
      tone === 'warn'
        ? ' is-amber'
        : tone === 'ok'
          ? ' is-ok'
          : tone === 'soft'
            ? ' is-soft'
            : '';
    return `<article class="v3-settings-kpi${toneClass}">
      <span class="v3-settings-kpi-ico" aria-hidden="true">${ico(icoName || 'settings')}</span>
      <div class="v3-settings-kpi-copy">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
        ${hint != null && hint !== '' ? `<em>${esc(hint)}</em>` : ''}
      </div>
    </article>`;
  }

  function toggleRow({ id, title, body, checked, helpKey }) {
    return `
      <div class="v3-settings-toggle">
        <div class="v3-settings-toggle-copy">
          <div class="v3-title-row">
            <strong>${esc(title)}</strong>
            ${helpKey ? helpBtn(helpKey) : ''}
          </div>
          ${body ? `<p>${esc(body)}</p>` : ''}
        </div>
        <label class="toggle v3-settings-switch">
          <span class="switch"><input id="${escA(id)}" type="checkbox" ${checked ? 'checked' : ''}/><i></i></span>
        </label>
      </div>`;
  }

  function fieldBlock({ id, label, control, hint }) {
    return `<label class="v3-settings-field" for="${escA(id)}">
      <span>${esc(label)}</span>
      ${control}
      ${hint ? `<em>${esc(hint)}</em>` : ''}
    </label>`;
  }

  function textInput({ id, value, placeholder, disabled, type }) {
    const t = type || 'text';
    if (t === 'textarea') {
      return `<textarea id="${escA(id)}" class="v3-settings-control" rows="3" ${disabled ? 'disabled' : ''}>${esc(value || '')}</textarea>`;
    }
    return `<input id="${escA(id)}" class="v3-settings-control" type="${escA(t)}" value="${escA(value || '')}" placeholder="${escA(placeholder || '')}" ${disabled ? 'disabled' : ''} />`;
  }

  function panel({ title, description, helpKey, content, tone }) {
    const toneClass = tone === 'danger' ? ' is-danger' : tone === 'warn' ? ' is-warn' : '';
    return `<section class="v3-settings-panel${toneClass}" data-v3-settings="section">
      <div class="v3-settings-head">
        <div class="v3-settings-head-copy">
          <div class="v3-title-row"><h3>${esc(title)}</h3>${helpKey ? helpBtn(helpKey) : ''}</div>
          ${description ? `<p class="muted">${esc(description)}</p>` : ''}
        </div>
      </div>
      <div class="v3-settings-panel-body">${content}</div>
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

  function syncDangerHints() {
    const maint = $('set-maint')?.checked;
    const force = $('set-force')?.checked;
    const qa = $('set-qa-otp')?.checked;
    const box = $('set-danger-live');
    if (!box) return;
    const bits = [];
    if (maint) bits.push('ტექნიკური რეჟიმი ჩართულია — მომხმარებლები აპში ვერ შევლენ.');
    if (force) bits.push('იძულებითი განახლება ჩართულია — ძველი ვერსიები დაიბლოკება.');
    if (qa) bits.push('QA OTP ჩართულია — ტესტის კოდები მუშაობს წარმოებაშიც, თუ გარემო არ ზღუდავს.');
    box.innerHTML = bits.length
      ? `<div class="v3-settings-alert is-danger"><span class="v3-settings-alert-ico">${ico('alert')}</span><div><strong>აქტიური რისკი</strong><p>${bits.map(esc).join(' ')}</p></div></div>`
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
    const body = readBody();
    const turningOnDanger =
      (body.maintenanceMode && !baseline.maintenanceMode) ||
      (body.forceUpdate && !baseline.forceUpdate) ||
      (body.qaOtpEnabled && !baseline.qaOtpEnabled);

    const doSave = async () => {
      if (Av.runMutation) {
        await Av.runMutation({
          action: () => api('/settings', { method: 'PATCH', body }),
          pendingElement: btn,
          successMessage: 'რეჟიმი შენახულია',
          refresh: async (result) => {
            const next = result?.settings || (await api('/settings')).settings;
            if (typeof setLivePill === 'function') setLivePill(next);
            Av.setDirty?.(false);
            await renderSettingsV3();
          },
        });
        return;
      }
      const next = await api('/settings', { method: 'PATCH', body });
      if (typeof setLivePill === 'function') setLivePill(next.settings);
      if (typeof toast === 'function') toast('რეჟიმი შენახულია');
      Av.setDirty?.(false);
      await renderSettingsV3();
    };

    if (turningOnDanger && Av.openConfirm) {
      Av.openConfirm({
        title: 'სახიფათო ცვლილებების შენახვა',
        message: 'შენახვა ჩართავს წარმოების რეჟიმს, რომელიც ყველა მომხმარებელზე მოქმედებს. დარწმუნებული ხარ?',
        confirmLabel: 'შენახვა',
        variant: 'danger',
        onConfirm: doSave,
      });
      return;
    }
    await doSave();
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
      purpose: 'რა წარმოების ქცევაა ჩართული — ოფლაინი, განახლება, რეგისტრაცია და QA.',
      helpKey: 'settings.page',
    });

    root.classList.add('v3-workspace-wide', 'v3-module', 'v3-settings');
    root.innerHTML = `<div class="v3-settings-body dash-enter" data-v3-settings="loading">
      <div class="v3-settings-toolbar">
        <div class="v3-settings-toolbar-copy">
          <strong>აპის რეჟიმის ობსერვატორია</strong>
          <span>იტვირთება…</span>
        </div>
      </div>
    </div>`;

    let settings;
    try {
      ({ settings } = await api('/settings'));
    } catch (err) {
      root.innerHTML = `<div class="v3-settings-body" data-v3-settings="error">
        <div class="v3-settings-empty is-err">
          <strong>პარამეტრები ვერ ჩაიტვირთა</strong>
          <p>${esc(err.message || 'უცნობი შეცდომა')}</p>
          <button type="button" class="btn ghost compact" id="set-retry">${ico('refresh')} ხელახლა სცადე</button>
        </div>
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
      <div class="v3-settings-body dash-enter" data-v3-settings="page">
        <div class="v3-settings-toolbar">
          <div class="v3-settings-toolbar-copy">
            <strong>აპის რეჟიმის ობსერვატორია</strong>
            <span>წარმოების კონტროლი · პერიოდის ფილტრი არ გამოიყენება${settings.updatedAt ? ` · განახლდა ${esc(shortDate(settings.updatedAt))}` : ''}</span>
          </div>
          <div class="v3-settings-toolbar-actions">
            ${helpBtn('settings.page')}
            <button type="button" class="btn ghost compact" id="set-refresh">${ico('refresh')} განახლება</button>
          </div>
        </div>

        <div class="v3-settings-kpis" role="group" aria-label="რეჟიმის მდგომარეობა">
          ${kpiCell('alert', 'ოფლაინი', onOff(settings.maintenanceMode), 'ტექნიკური რეჟიმი', settings.maintenanceMode ? 'warn' : 'ok')}
          ${kpiCell('zap', 'იძ. განახლება', onOff(settings.forceUpdate), 'ძველი კლიენტები', settings.forceUpdate ? 'warn' : 'ok')}
          ${kpiCell('users', 'რეგისტრაცია', settings.allowRegistrations ? 'ღიაა' : 'დახურულია', 'ახალი ანგარიშები', settings.allowRegistrations ? 'ok' : 'warn')}
          ${kpiCell('shield', 'QA OTP', onOff(settings.qaOtpEnabled), 'ტესტის კოდები', settings.qaOtpEnabled ? 'warn' : 'ok')}
        </div>

        <div id="set-danger-live"></div>

        <div class="v3-settings-grid" id="settings-form">
          ${panel({
            title: 'აპის ხელმისაწვდომობა',
            description: 'ოფლაინი / განახლების რეჟიმი და შეტყობინება მომხმარებლებისთვის',
            helpKey: 'settings.maintenance',
            tone: 'danger',
            content: `
              <div class="v3-settings-alert is-danger">
                <span class="v3-settings-alert-ico">${ico('alert')}</span>
                <div><strong>წარმოების გავლენა</strong><p>ტექნიკური რეჟიმი აჩერებს აპსა და API-ს მომხმარებლებისთვის. ადმინ კონსოლი რჩება ხელმისაწვდომი.</p></div>
              </div>
              ${toggleRow({
                id: 'set-maint',
                title: 'ოფლაინი / განახლება',
                body: 'აპი და API გაჩერდება მომხმარებლებისთვის.',
                checked: settings.maintenanceMode,
                helpKey: 'settings.maintenance',
              })}
              ${fieldBlock({
                id: 'set-msg',
                label: 'ოფლაინის შეტყობინება',
                control: textInput({ id: 'set-msg', type: 'textarea', value: settings.maintenanceMessage || '' }),
              })}
            `,
          })}

          ${panel({
            title: 'განახლების პოლიტიკა',
            description: 'მინიმალური ვერსია და იძულებითი განახლება',
            helpKey: 'settings.forceUpdate',
            tone: 'warn',
            content: `
              <div class="v3-settings-alert is-warn">
                <span class="v3-settings-alert-ico">${ico('zap')}</span>
                <div><strong>ყურადღება</strong><p>იძულებითი განახლება ბლოკავს ძველ კლიენტებს. მინიმალური ვერსია უნდა ემთხვეოდეს რეალურ mobile/app.json რელიზს.</p></div>
              </div>
              ${toggleRow({
                id: 'set-force',
                title: 'იძულებითი განახლება',
                body: 'ძველი აპის ვერსია ვერ შევა სისტემაში.',
                checked: settings.forceUpdate,
                helpKey: 'settings.forceUpdate',
              })}
              <div class="v3-settings-fields">
                ${fieldBlock({
                  id: 'set-mobile-ro',
                  label: 'აპის ვერსია (mobile/app.json)',
                  control: textInput({ id: 'set-mobile-ro', value: settings.mobileAppVersion || '—', disabled: true }),
                  hint: 'მხოლოდ წაკითხვა',
                })}
                ${fieldBlock({
                  id: 'set-minver',
                  label: 'მინიმალური აპის ვერსია (API)',
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
            description: 'ახალი ანგარიშების გახსნა',
            content: toggleRow({
              id: 'set-reg',
              title: 'რეგისტრაცია ღიაა',
              body: 'გამორთვისას ახალი ანგარიშები ვერ შეიქმნება.',
              checked: settings.allowRegistrations,
            }),
          })}

          ${panel({
            title: 'QA კონტროლი',
            description: 'ტესტის OTP და სხვა QA გადართვები',
            helpKey: 'settings.qa',
            tone: 'warn',
            content: `
              <div class="v3-settings-alert is-warn">
                <span class="v3-settings-alert-ico">${ico('shield')}</span>
                <div><strong>მხოლოდ უსაფრთხო გარემო</strong><p>QA OTP ტესტის კოდებს (0000 / 000000) უშვებს. გამორთე ტესტის შემდეგ.</p></div>
              </div>
              ${toggleRow({
                id: 'set-qa-otp',
                title: 'QA OTP',
                body: 'ტესტის კოდი 0000 (ტელეფონი) და 000000 (ელ-ფოსტა) ყოველთვის მუშაობს.',
                checked: settings.qaOtpEnabled,
                helpKey: 'settings.qa',
              })}
            `,
          })}

          ${panel({
            title: 'მხარდაჭერა',
            description: 'საკონტაქტო ელ-ფოსტა აპში',
            content: fieldBlock({
              id: 'set-email',
              label: 'მხარდაჭერის ელ-ფოსტა',
              control: textInput({ id: 'set-email', type: 'email', value: settings.supportEmail || '' }),
            }),
          })}
        </div>

        ${
          Av.stickyActions
            ? Av.stickyActions({
                dirty: false,
                cancel: `<button type="button" class="btn ghost" id="set-cancel">გაუქმება</button>`,
                save: `<button type="button" class="btn primary" id="set-save">${ico('check')} შენახვა</button>`,
              })
            : `<div class="v3-settings-actions"><button type="button" class="btn ghost" id="set-cancel">გაუქმება</button><button type="button" class="btn primary" id="set-save">${ico('check')} შენახვა</button></div>`
        }
      </div>
    `;

    syncDangerHints();
    Av.setDirty?.(false);
    Av.watchDirty?.($('settings-form'));

    $('set-refresh')?.addEventListener('click', async () => {
      if (Av.dirty && Av.confirmLeave) {
        const ok = await Av.confirmLeave();
        if (!ok) return;
      }
      void renderSettingsV3();
    });

    bindDangerToggle(
      'set-maint',
      {
        title: 'ტექნიკური რეჟიმი',
        variant: 'danger',
        message: (on) =>
          on
            ? 'ჩართვის შემდეგ მომხმარებლები აპში ვერ შევლენ და დაინახავენ ოფლაინ შეტყობინებას. ადმინი რჩება ხელმისაწვდომი. გავაგრძელოთ?'
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
            ? 'ძველი აპის ვერსიები ვეღარ შევლენ სისტემაში. დარწმუნდი, რომ მინიმალური ვერსია სწორია.'
            : 'იძულებითი განახლება გაითიშება — ძველი კლიენტები კვლავ შეძლებენ შესვლას (თუ სხვა პოლიტიკა არ ზღუდავს).',
      },
      baseline,
    );
    bindDangerToggle(
      'set-qa-otp',
      {
        title: 'QA OTP',
        variant: 'warning',
        message: (on) =>
          on
            ? 'ტესტის OTP კოდები იმუშავებს. წარმოებაში ჩართვა უსაფრთხოების რისკია. გავაგრძელოთ?'
            : 'QA OTP გამოირთვება — ტესტის კოდები აღარ იმუშავებს.',
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

    // Keep danger banner in sync for non-confirm fields too
    ['set-msg', 'set-minver', 'set-email', 'set-reg'].forEach((id) => {
      $(id)?.addEventListener('input', () => Av.setDirty?.(true));
      $(id)?.addEventListener('change', () => {
        Av.setDirty?.(isFormDirty(baseline));
        syncDangerHints();
      });
    });
  }

  global.renderSettings = renderSettingsV3;
})(window);
