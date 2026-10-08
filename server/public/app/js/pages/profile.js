// MEDICARD web — Profile & settings: personal data, health profile, privacy/AI consent,
// phone verification, email preferences, theme, language, sign out, account deletion.
import {
  h, mount, icon, pageHead, section, card, button, row, formModal, field, input, select, textarea, toast,
  confirmDialog, openModal, busy, fmtDate, badge, segmented, toggle, fmtNum,
} from '../ui.js';
import { get, patch, put, post, del } from '../api.js';
import { session, setUser, setProfile, refreshMe, signOut, initials, applyTheme, getThemePref } from '../session.js';
import { readAiConsent, askAiConsent } from '../aiConsent.js';
import { t, lang, isEn, setLang, LANGUAGES } from '../i18n.js';
import { openConflictModal, signInMethodsCard } from '../accountLinks.js';

const PRIVACY_URL = isEn ? '/privacy-en' : '/privacy';
const TERMS_URL = isEn ? '/terms-en' : '/terms';

const GENDER = { FEMALE: t('ქალი', 'Female'), MALE: t('კაცი', 'Male'), OTHER: t('სხვა', 'Other') };
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ACTIVITY = { SEDENTARY: t('უმოძრაო', 'Sedentary'), LIGHT: t('მსუბუქი', 'Light'), MODERATE: t('ზომიერი', 'Moderate'), ACTIVE: t('აქტიური', 'Active'), VERY_ACTIVE: t('ძალიან აქტიური', 'Very active') };
const SMOKING = { NEVER: t('არასდროს', 'Never'), FORMER: t('ადრე ვეწეოდი', 'Former smoker'), CURRENT: t('ვეწევი', 'Current smoker') };
const ALCOHOL = { NEVER: t('არ ვსვამ', 'Don’t drink'), OCCASIONAL: t('იშვიათად', 'Occasionally'), REGULAR: t('რეგულარულად', 'Regularly') };
const SLEEP = { POOR: t('ცუდი', 'Poor'), FAIR: t('საშუალო', 'Fair'), GOOD: t('კარგი', 'Good'), EXCELLENT: t('შესანიშნავი', 'Excellent') };
const STRESS = { LOW: t('დაბალი', 'Low'), MODERATE: t('ზომიერი', 'Moderate'), HIGH: t('მაღალი', 'High'), VERY_HIGH: t('ძალიან მაღალი', 'Very high') };

const isSyntheticEmail = (e) => /@(phone|apple)\.medicard\.ge$/.test(String(e || ''));
const opts = (map, withEmpty = true) => [...(withEmpty ? [{ value: '', label: '—' }] : []), ...Object.entries(map).map(([value, label]) => ({ value, label }))];
const list = (v) => (Array.isArray(v) && v.length ? v.join(', ') : '—');

export default async function profilePage(root) {
  const render = () => {
    const u = session.user || {};
    const p = session.profile || {};
    const bmi = p.heightCm && p.weightKg ? (p.weightKg / ((p.heightCm / 100) ** 2)).toFixed(1) : null;

    mount(root,
      pageHead(t('პროფილი', 'Profile'), t('შენი მონაცემები, კონფიდენციალურობა და პარამეტრები. ცვლილებები აპშიც მაშინვე აისახება.', 'Your details, privacy and settings. Changes show up in the app right away.')),
      h('div', { class: 'grid grid-main' },
        h('div', null,
          card({ class: 'pad-lg hub-section' },
            h('div', { class: 'hstack', style: { gap: '18px', flexWrap: 'nowrap' } },
              h('span', { class: 'avatar lg' }, initials()),
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('h2', { style: { fontSize: '22px' } }, u.fullName || t('მომხმარებელი', 'User')),
                h('div', { class: 'muted', style: { marginTop: '2px' } }, [u.phone, isSyntheticEmail(u.email) ? null : u.email].filter(Boolean).join(' · ') || '—'),
                h('div', { class: 'hstack', style: { marginTop: '10px' } },
                  badge(t(`${fmtNum(u.points || 0)} ქულა`, `${fmtNum(u.points || 0)} ${u.points === 1 ? 'point' : 'points'}`), 'brand'),
                  u.createdAt ? badge(t(`წევრი ${fmtDate(u.createdAt, { year: true })}-დან`, `Member since ${fmtDate(u.createdAt, { year: true })}`), 'neutral') : null)),
              button(t('რედაქტირება', 'Edit'), { variant: 'ghost', icon: 'edit', onClick: editPersonal }))),

          section(t('პირადი მონაცემები', 'Personal details'), card(h('div', { class: 'list' },
            row({ icon: 'user', ink: 'blue', title: t('სახელი', 'Name'), sub: u.fullName || '—' }),
            row({ icon: 'heart', ink: 'rose', title: t('სქესი', 'Sex'), sub: GENDER[u.gender] || '—' }),
            row({ icon: 'calendar', ink: 'violet', title: t('დაბადების თარიღი', 'Date of birth'), sub: u.birthDate ? `${fmtDate(u.birthDate, { year: true })}${u.age ? t(` · ${u.age} წლის`, ` · ${u.age} years old`) : ''}` : '—' }),
          )), { action: button(t('შეცვლა', 'Edit'), { variant: 'ghost', size: 'sm', icon: 'edit', onClick: editPersonal }) }),

          // Phone, email + password, Apple, Google — every way into this one account (accountLinks.js).
          section(t('შესვლის გზები', 'Sign-in methods'), signInMethodsCard({ onAddPhone: linkPhone, onChange: () => { refreshMe().then(render).catch(() => {}); } }).el),

          section(t('ჯანმრთელობის პროფილი', 'Health profile'), card(
            h('div', { class: 'stats-row', style: { marginBottom: '16px' } },
              statBox(t('სიმაღლე', 'Height'), p.heightCm ? `${p.heightCm}` : '—', t('სმ', 'cm')),
              statBox(t('წონა', 'Weight'), p.weightKg ? `${p.weightKg}` : '—', t('კგ', 'kg')),
              statBox('BMI', bmi || '—', ''),
              statBox(t('სისხლის ჯგუფი', 'Blood type'), p.bloodType && p.bloodType !== 'UNKNOWN' ? p.bloodType : '—', '')),
            h('div', { class: 'list' },
              row({ icon: 'alert', ink: 'amber', title: t('ალერგიები', 'Allergies'), sub: list(p.allergies) }),
              row({ icon: 'heart', ink: 'rose', title: t('ქრონიკული მდგომარეობები', 'Chronic conditions'), sub: list(p.chronicConditions) }),
              row({ icon: 'users', ink: 'violet', title: t('ოჯახური ისტორია', 'Family history'), sub: list(p.familyHistory) }),
              row({ icon: 'activity', ink: 'green', title: t('ცხოვრების წესი', 'Lifestyle'), sub: [ACTIVITY[p.activityLevel], p.smokingStatus && `${t('მოწევა', 'Smoking')}: ${SMOKING[p.smokingStatus]}`, p.alcoholUse && `${t('ალკოჰოლი', 'Alcohol')}: ${ALCOHOL[p.alcoholUse]}`, p.sleepQuality && `${t('ძილი', 'Sleep')}: ${SLEEP[p.sleepQuality]}`].filter(Boolean).join(' · ') || '—' })),
          ), { action: button(t('შეცვლა', 'Edit'), { variant: 'ghost', size: 'sm', icon: 'edit', onClick: editHealth }) })),

        h('div', null,
          section(t('კონფიდენციალურობა', 'Privacy'), privacyCard()),
          section(t('გარეგნობა', 'Appearance'), card(
            h('div', { class: 'between' },
              h('div', null, h('div', { class: 'card-title' }, t('თემა', 'Theme')), h('div', { class: 'card-sub' }, t('ღია, მუქი ან სისტემის მიხედვით', 'Light, dark or match your system'))),
              segmented([{ value: 'light', label: t('ღია', 'Light') }, { value: 'dark', label: t('მუქი', 'Dark') }, { value: 'system', label: t('ავტო', 'Auto') }], getThemePref(), (v) => applyTheme(v))))),
          section(t('ენა', 'Language'), languageCard()),
          section(t('შეტყობინებები', 'Notifications'), emailCard()),
          section(t('აპი', 'App'), card(h('div', { class: 'list' },
            row({ icon: 'smartphone', ink: 'teal', title: t('MEDICARD აპი', 'MEDICARD app'), sub: t('შეხსენებები, ნაბიჯები, MEDIRUN და ხმოვანი Medi — ტელეფონში', 'Reminders, steps, MEDIRUN and voice Medi — on your phone'), trailing: button('App Store', { size: 'sm', variant: 'secondary', href: 'https://apps.apple.com/app/id6812517519', external: true }) }),
            h('a', { class: 'row row-link', href: PRIVACY_URL, target: '_blank' }, h('span', { class: 'tile ink-neutral', style: { width: '38px', height: '38px' } }, icon('shield', { size: 18 })), h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t('კონფიდენციალურობის პოლიტიკა', 'Privacy policy'))), icon('externalLink', { size: 16, className: 'row-chev' })),
            h('a', { class: 'row row-link', href: TERMS_URL, target: '_blank' }, h('span', { class: 'tile ink-neutral', style: { width: '38px', height: '38px' } }, icon('file', { size: 18 })), h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t('მომსახურების წესები', 'Terms of service'))), icon('externalLink', { size: 16, className: 'row-chev' })),
            h('a', { class: 'row row-link', href: 'mailto:support@medicard.ge' }, h('span', { class: 'tile ink-neutral', style: { width: '38px', height: '38px' } }, icon('mail', { size: 18 })), h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, t('მხარდაჭერა', 'Support')), h('div', { class: 'row-sub' }, 'support@medicard.ge')))))),
          section(t('ანგარიში', 'Account'), card(
            h('div', { class: 'stack' },
              button(t('გასვლა', 'Sign out'), { variant: 'ghost', icon: 'logout', class: 'btn-block', onClick: () => { signOut(); location.href = '/app'; } }),
              button(t('ანგარიშის წაშლა', 'Delete account'), { variant: 'outline', icon: 'trash', class: 'btn-block', onClick: deleteAccount }),
              h('p', { class: 'faint', style: { fontSize: '12.5px' } }, t('წაშლა სამუდამოა: ანგარიში და ყველა ჯანმრთელობის მონაცემი იშლება.', 'Deletion is permanent: your account and all your health data are erased.'))))))));
  };

  function statBox(label, value, unit) {
    return h('div', null, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value', style: { fontSize: '22px' } }, value, unit ? h('small', null, ` ${unit}`) : null));
  }

  function languageCard() {
    return card(
      h('div', { class: 'between' },
        h('div', null, h('div', { class: 'card-title' }, 'Language / ენა'), h('div', { class: 'card-sub' }, t('გვერდი ხელახლა ჩაიტვირთება არჩეულ ენაზე', 'The page reloads in the language you choose'))),
        segmented(LANGUAGES.map((l) => ({
          value: l.value,
          label: h('span', { lang: l.value }, h('span', { style: { fontSize: '11px', fontWeight: 800, opacity: 0.7, marginRight: '6px' } }, l.badge), l.label),
        })), lang, (v) => { if (v !== lang) setLang(v); })));
  }

  function privacyCard() {
    const body = h('div', { class: 'list' }, row({ icon: 'sparkles', ink: 'violet', title: t('AI-სთან გაზიარება', 'Sharing with AI'), sub: t('იტვირთება…', 'Loading…') }));
    readAiConsent(true).then((st) => {
      mount(body,
        row({
          icon: 'sparkles', ink: 'violet', title: t('AI-სთან გაზიარება (Medi)', 'Sharing with AI (Medi)'),
          sub: st.accepted ? `${t('ნებადართულია', 'Allowed')}${st.updatedAt ? ` · ${fmtDate(st.updatedAt, { year: true })}` : ''}` : t('არ არის ნებადართული — Medi-ს პირველად გამოყენებისას გკითხავთ', 'Not allowed — we’ll ask the first time you use Medi'),
          trailing: button(st.accepted ? t('მართვა', 'Manage') : t('ნახვა', 'View'), { size: 'sm', variant: 'ghost', onClick: async () => { await askAiConsent(st, { settings: true }); render(); } }),
        }),
        row({ icon: 'shield', ink: 'teal', title: t('კონფიდენციალურობის თანხმობა', 'Privacy consent'), sub: session.profile?.extraAnswers?.privacyAcceptedAt ? t(`მიღებულია ${fmtDate(session.profile.extraAnswers.privacyAcceptedAt, { year: true })}`, `Accepted ${fmtDate(session.profile.extraAnswers.privacyAcceptedAt, { year: true })}`) : t('მიღებულია', 'Accepted') }));
    }).catch(() => mount(body, row({ icon: 'sparkles', ink: 'violet', title: t('AI-სთან გაზიარება', 'Sharing with AI'), sub: t('სტატუსი ვერ ჩაიტვირთა', 'Couldn’t load the status') })));
    return card(body);
  }

  function emailCard() {
    const u = session.user || {};
    if (isSyntheticEmail(u.email)) {
      return card(h('p', { class: 'muted', style: { fontSize: '14px' } }, t('შეხსენებები და push შეტყობინებები MEDICARD აპში იმართება.', 'Reminders and push notifications are managed in the MEDICARD app.')));
    }
    const body = h('div', null, h('p', { class: 'faint' }, t('იტვირთება…', 'Loading…')));
    get('/api/account/email-preferences').then((pref) => {
      mount(body, h('div', { class: 'between' },
        h('div', null, h('div', { class: 'card-title' }, t('სიახლეები ელ-ფოსტით', 'News by email')), h('div', { class: 'card-sub' }, t('რჩევები და სიახლეები. სერვისის წერილები მაინც მოვა.', 'Tips and news. Service emails still arrive.'))),
        toggle(Boolean(pref.marketingOptIn), async (on) => {
          try { await patch('/api/account/email-preferences', { marketingOptIn: on }); toast(on ? t('ჩაირთო', 'Turned on') : t('გამოირთო', 'Turned off')); } catch (e) { toast(e.message, 'error'); }
        })));
    }).catch(() => mount(body, h('p', { class: 'faint' }, t('პარამეტრები ვერ ჩაიტვირთა.', 'Couldn’t load settings.'))));
    return card(body);
  }

  function editPersonal() {
    const u = session.user || {};
    const max = new Date(); max.setFullYear(max.getFullYear() - 18);
    formModal({
      title: t('პირადი მონაცემები', 'Personal details'),
      fields: [
        field(t('სახელი და გვარი', 'Full name'), input({ name: 'fullName', value: u.fullName || '', required: true, minlength: 2 })),
        h('div', { class: 'form-row' },
          field(t('სქესი', 'Sex'), select(opts(GENDER, false), u.gender || 'FEMALE', { name: 'gender' })),
          field(t('დაბადების თარიღი', 'Date of birth'), input({ name: 'birthDate', type: 'date', value: u.birthDate || '', max: max.toISOString().slice(0, 10) }))),
      ],
      onSubmit: async (v, close) => {
        const body = {};
        if (v.fullName.trim() && v.fullName.trim() !== u.fullName) body.fullName = v.fullName.trim();
        if (v.gender && v.gender !== u.gender) body.gender = v.gender;
        if (v.birthDate && v.birthDate !== u.birthDate) body.birthDate = v.birthDate;
        if (!Object.keys(body).length) { close(); return; }
        const r = await patch('/api/auth/me', body);
        setUser(r.user);
        close();
        toast(t('შენახულია', 'Saved'));
        render();
      },
    });
  }

  function editHealth() {
    const p = session.profile || {};
    const tags = (name, value, placeholder) => textarea({ name, value: Array.isArray(value) ? value.join(', ') : '', placeholder, rows: 2, style: { minHeight: '64px' } });
    formModal({
      title: t('ჯანმრთელობის პროფილი', 'Health profile'),
      size: 'lg',
      fields: [
        h('div', { class: 'form-row' },
          field(t('სიმაღლე (სმ)', 'Height (cm)'), input({ name: 'heightCm', type: 'number', min: 80, max: 250, value: p.heightCm ?? '' })),
          field(t('წონა (კგ)', 'Weight (kg)'), input({ name: 'weightKg', type: 'number', step: '0.1', min: 20, max: 300, value: p.weightKg ?? '' }))),
        h('div', { class: 'form-row' },
          field(t('სისხლის ჯგუფი', 'Blood type'), select([{ value: '', label: '—' }, ...BLOOD.map((b) => ({ value: b, label: b })), { value: 'UNKNOWN', label: t('არ ვიცი', 'I don’t know') }], p.bloodType || '', { name: 'bloodType' })),
          field(t('აქტიურობა', 'Activity'), select(opts(ACTIVITY), p.activityLevel || '', { name: 'activityLevel' }))),
        h('div', { class: 'form-row' },
          field(t('მოწევა', 'Smoking'), select(opts(SMOKING), p.smokingStatus || '', { name: 'smokingStatus' })),
          field(t('ალკოჰოლი', 'Alcohol'), select(opts(ALCOHOL), p.alcoholUse || '', { name: 'alcoholUse' }))),
        h('div', { class: 'form-row' },
          field(t('ძილის ხარისხი', 'Sleep quality'), select(opts(SLEEP), p.sleepQuality || '', { name: 'sleepQuality' })),
          field(t('სტრესი', 'Stress'), select(opts(STRESS), p.stressLevel || '', { name: 'stressLevel' }))),
        field(t('ალერგიები', 'Allergies'), tags('allergies', p.allergies, t('მძიმით გამოყავი: პენიცილინი, თხილი', 'Separate with commas: penicillin, hazelnuts'))),
        field(t('ქრონიკული მდგომარეობები', 'Chronic conditions'), tags('chronicConditions', p.chronicConditions, t('მაგ: ჰიპერტენზია', 'e.g. hypertension'))),
        field(t('ოჯახური ისტორია', 'Family history'), tags('familyHistory', p.familyHistory, t('მაგ: დიაბეტი (დედა)', 'e.g. diabetes (mother)'))),
      ],
      onSubmit: async (v, close) => {
        const body = {};
        const num = (k) => { if (v[k] !== '' && v[k] !== undefined) body[k] = Number(v[k]); };
        num('heightCm'); num('weightKg');
        for (const k of ['bloodType', 'activityLevel', 'smokingStatus', 'alcoholUse', 'sleepQuality', 'stressLevel']) if (v[k]) body[k] = v[k];
        for (const k of ['allergies', 'chronicConditions', 'familyHistory']) body[k] = String(v[k] || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 40);
        const r = await put('/api/health-profile', body);
        setProfile(r.profile);
        if (r.user) setUser(r.user);
        close();
        toast(t('ჯანმრთელობის პროფილი განახლდა', 'Health profile updated'));
        render();
      },
    });
  }

  function linkPhone() {
    let phone = '';
    const m = openModal({
      title: t('ტელეფონის დადასტურება', 'Verify phone'),
      size: 'sm',
      body: (close) => {
        const box = h('div');
        const err = h('div', { class: 'form-error', hidden: true });
        // A number on another of the person's accounts: bring it here or switch (accountLinks.js).
        const fail = (e) => {
          if (e?.body?.conflict?.token) {
            close();
            openConflictModal(e.body.conflict, { onMoved: () => { refreshMe().then(render).catch(() => {}); } });
            return;
          }
          err.textContent = e.message;
          err.hidden = false;
        };
        const step1 = () => {
          const inp = input({ type: 'tel', inputmode: 'numeric', placeholder: '5XX XXX XXX', maxlength: 12 });
          const go = button(t('კოდის მიღება', 'Get code'), { class: 'btn-block' });
          go.addEventListener('click', () => busy(go, async () => {
            err.hidden = true;
            phone = inp.value.replace(/\D/g, '').replace(/^995/, '');
            try { const r = await post('/api/auth/phone/link/start', { phone }); step2(r); } catch (e) { fail(e); }
          }));
          mount(box, h('div', { class: 'form' }, h('p', { class: 'muted' }, t('დადასტურებული ნომერი საჭიროა ჯილდოების მისაღებად და ქალების სივრცისთვის.', 'A verified number is needed to redeem rewards and for the women’s space.')), field(t('ნომერი', 'Number'), h('div', { class: 'phone-wrap' }, h('span', null, '+995'), inp)), err, go));
          setTimeout(() => inp.focus(), 30);
        };
        const step2 = (r) => {
          const code = input({ inputmode: 'numeric', maxlength: 4, placeholder: '0000', value: r?.devCode || '' });
          const go = button(t('დადასტურება', 'Verify'), { class: 'btn-block' });
          go.addEventListener('click', () => busy(go, async () => {
            err.hidden = true;
            try {
              const res = await post('/api/auth/phone/link/verify', { phone, code: code.value.trim() });
              if (res.user) setUser(res.user);
              await refreshMe().catch(() => {});
              close();
              toast(t('ნომერი დადასტურდა', 'Number verified'));
              render();
            } catch (e) { fail(e); }
          }));
          mount(box, h('div', { class: 'form' }, h('p', { class: 'muted' }, t(`კოდი გაიგზავნა ნომერზე +995 ${phone}.`, `We sent a code to +995 ${phone}.`)), field(t('4-ნიშნა კოდი', '4-digit code'), code), err, go));
          setTimeout(() => code.focus(), 30);
        };
        step1();
        return box;
      },
    });
    return m;
  }

  async function deleteAccount() {
    const ok = await confirmDialog({
      title: t('ანგარიშის წაშლა', 'Delete account'),
      body: t('ანგარიში და ყველა მონაცემი — მედიკამენტები, ანალიზები, ჩანაწერები, ციკლი, კვება — სამუდამოდ წაიშლება. აღდგენა შეუძლებელია.', 'Your account and all your data — medications, lab results, records, cycle, nutrition — will be permanently deleted. This can’t be undone.'),
      confirm: t('გაგრძელება', 'Continue'),
      danger: true,
    });
    if (!ok) return;
    const word = t('წაშლა', 'DELETE');
    formModal({
      title: t('დაადასტურე წაშლა', 'Confirm deletion'),
      size: 'sm',
      danger: true,
      submit: t('სამუდამოდ წაშლა', 'Delete permanently'),
      fields: [h('p', { class: 'muted' }, t(`დასადასტურებლად ჩაწერე სიტყვა „${word}“.`, `To confirm, type the word “${word}”.`)), field(t('დადასტურება', 'Confirmation'), input({ name: 'confirm', autocomplete: 'off' }))],
      onSubmit: async (v, close) => {
        if (v.confirm.trim() !== word) throw new Error(t(`ჩაწერე „${word}“.`, `Type “${word}”.`));
        await del('/api/auth/me');
        close();
        signOut();
        location.href = '/';
      },
    });
  }

  render();
}
