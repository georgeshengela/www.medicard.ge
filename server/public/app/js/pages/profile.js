// MEDICARD web — Profile & settings: personal data, health profile, privacy/AI consent,
// phone verification, email preferences, theme, sign out, account deletion.
import {
  h, mount, icon, pageHead, section, card, button, row, formModal, field, input, select, textarea, toast,
  confirmDialog, openModal, busy, fmtDate, badge, segmented, toggle, fmtNum,
} from '../ui.js';
import { get, patch, put, post, del } from '../api.js';
import { session, setUser, setProfile, refreshMe, signOut, initials, applyTheme, getThemePref } from '../session.js';
import { readAiConsent, askAiConsent } from '../aiConsent.js';

const GENDER = { FEMALE: 'ქალი', MALE: 'კაცი', OTHER: 'სხვა' };
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const ACTIVITY = { SEDENTARY: 'უმოძრაო', LIGHT: 'მსუბუქი', MODERATE: 'ზომიერი', ACTIVE: 'აქტიური', VERY_ACTIVE: 'ძალიან აქტიური' };
const SMOKING = { NEVER: 'არასდროს', FORMER: 'ადრე ვეწეოდი', CURRENT: 'ვეწევი' };
const ALCOHOL = { NEVER: 'არ ვსვამ', OCCASIONAL: 'იშვიათად', REGULAR: 'რეგულარულად' };
const SLEEP = { POOR: 'ცუდი', FAIR: 'საშუალო', GOOD: 'კარგი', EXCELLENT: 'შესანიშნავი' };
const STRESS = { LOW: 'დაბალი', MODERATE: 'ზომიერი', HIGH: 'მაღალი', VERY_HIGH: 'ძალიან მაღალი' };

const isSyntheticEmail = (e) => String(e || '').endsWith('@phone.medicard.ge');
const opts = (map, withEmpty = true) => [...(withEmpty ? [{ value: '', label: '—' }] : []), ...Object.entries(map).map(([value, label]) => ({ value, label }))];
const list = (v) => (Array.isArray(v) && v.length ? v.join(', ') : '—');

export default async function profilePage(root) {
  const render = () => {
    const u = session.user || {};
    const p = session.profile || {};
    const bmi = p.heightCm && p.weightKg ? (p.weightKg / ((p.heightCm / 100) ** 2)).toFixed(1) : null;

    mount(root,
      pageHead('პროფილი', 'შენი მონაცემები, კონფიდენციალურობა და პარამეტრები. ცვლილებები აპშიც მაშინვე აისახება.'),
      h('div', { class: 'grid grid-main' },
        h('div', null,
          card({ class: 'pad-lg hub-section' },
            h('div', { class: 'hstack', style: { gap: '18px', flexWrap: 'nowrap' } },
              h('span', { class: 'avatar lg' }, initials()),
              h('div', { style: { flex: 1, minWidth: 0 } },
                h('h2', { style: { fontSize: '22px' } }, u.fullName || 'მომხმარებელი'),
                h('div', { class: 'muted', style: { marginTop: '2px' } }, [u.phone, isSyntheticEmail(u.email) ? null : u.email].filter(Boolean).join(' · ') || '—'),
                h('div', { class: 'hstack', style: { marginTop: '10px' } },
                  badge(`${fmtNum(u.points || 0)} ქულა`, 'brand'),
                  badge(`სტრიკი ${fmtNum(u.currentStreak || 0)} დღე`, 'neutral'),
                  u.createdAt ? badge(`წევრი ${fmtDate(u.createdAt, { year: true })}-დან`, 'neutral') : null)),
              button('რედაქტირება', { variant: 'ghost', icon: 'edit', onClick: editPersonal }))),

          section('პირადი მონაცემები', card(h('div', { class: 'list' },
            row({ icon: 'user', ink: 'blue', title: 'სახელი', sub: u.fullName || '—' }),
            row({ icon: 'heart', ink: 'rose', title: 'სქესი', sub: GENDER[u.gender] || '—' }),
            row({ icon: 'calendar', ink: 'violet', title: 'დაბადების თარიღი', sub: u.birthDate ? `${fmtDate(u.birthDate, { year: true })}${u.age ? ` · ${u.age} წლის` : ''}` : '—' }),
            row({ icon: 'phone', ink: 'teal', title: 'ტელეფონი', sub: u.phone || 'დაუდასტურებელი', trailing: u.phone ? badge('დადასტურებული', 'ok') : button('დადასტურება', { size: 'sm', variant: 'secondary', onClick: linkPhone }) }),
            isSyntheticEmail(u.email) ? null : row({ icon: 'mail', ink: 'sky', title: 'ელ-ფოსტა', sub: u.email })),
          ), { action: button('შეცვლა', { variant: 'ghost', size: 'sm', icon: 'edit', onClick: editPersonal }) }),

          section('ჯანმრთელობის პროფილი', card(
            h('div', { class: 'stats-row', style: { marginBottom: '16px' } },
              statBox('სიმაღლე', p.heightCm ? `${p.heightCm}` : '—', 'სმ'),
              statBox('წონა', p.weightKg ? `${p.weightKg}` : '—', 'კგ'),
              statBox('BMI', bmi || '—', ''),
              statBox('სისხლის ჯგუფი', p.bloodType && p.bloodType !== 'UNKNOWN' ? p.bloodType : '—', '')),
            h('div', { class: 'list' },
              row({ icon: 'alert', ink: 'amber', title: 'ალერგიები', sub: list(p.allergies) }),
              row({ icon: 'heart', ink: 'rose', title: 'ქრონიკული მდგომარეობები', sub: list(p.chronicConditions) }),
              row({ icon: 'users', ink: 'violet', title: 'ოჯახური ისტორია', sub: list(p.familyHistory) }),
              row({ icon: 'activity', ink: 'green', title: 'ცხოვრების წესი', sub: [ACTIVITY[p.activityLevel], p.smokingStatus && `მოწევა: ${SMOKING[p.smokingStatus]}`, p.alcoholUse && `ალკოჰოლი: ${ALCOHOL[p.alcoholUse]}`, p.sleepQuality && `ძილი: ${SLEEP[p.sleepQuality]}`].filter(Boolean).join(' · ') || '—' })),
          ), { action: button('შეცვლა', { variant: 'ghost', size: 'sm', icon: 'edit', onClick: editHealth }) })),

        h('div', null,
          section('კონფიდენციალურობა', privacyCard()),
          section('გარეგნობა', card(
            h('div', { class: 'between' },
              h('div', null, h('div', { class: 'card-title' }, 'თემა'), h('div', { class: 'card-sub' }, 'ღია, მუქი ან სისტემის მიხედვით')),
              segmented([{ value: 'light', label: 'ღია' }, { value: 'dark', label: 'მუქი' }, { value: 'system', label: 'ავტო' }], getThemePref(), (v) => applyTheme(v))))),
          section('შეტყობინებები', emailCard()),
          section('აპი', card(h('div', { class: 'list' },
            row({ icon: 'smartphone', ink: 'teal', title: 'MEDICARD აპი', sub: 'შეხსენებები, ნაბიჯები, MEDIRUN და ხმოვანი Medi — ტელეფონში', trailing: button('App Store', { size: 'sm', variant: 'secondary', href: 'https://apps.apple.com/app/id6812517519', external: true }) }),
            h('a', { class: 'row row-link', href: '/privacy', target: '_blank' }, h('span', { class: 'tile ink-neutral', style: { width: '38px', height: '38px' } }, icon('shield', { size: 18 })), h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'კონფიდენციალურობის პოლიტიკა')), icon('externalLink', { size: 16, className: 'row-chev' })),
            h('a', { class: 'row row-link', href: '/terms', target: '_blank' }, h('span', { class: 'tile ink-neutral', style: { width: '38px', height: '38px' } }, icon('file', { size: 18 })), h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'მომსახურების წესები')), icon('externalLink', { size: 16, className: 'row-chev' })),
            h('a', { class: 'row row-link', href: 'mailto:support@medicard.ge' }, h('span', { class: 'tile ink-neutral', style: { width: '38px', height: '38px' } }, icon('mail', { size: 18 })), h('div', { class: 'row-main' }, h('div', { class: 'row-title' }, 'მხარდაჭერა'), h('div', { class: 'row-sub' }, 'support@medicard.ge')))))),
          section('ანგარიში', card(
            h('div', { class: 'stack' },
              button('გასვლა', { variant: 'ghost', icon: 'logout', class: 'btn-block', onClick: () => { signOut(); location.href = '/app'; } }),
              button('ანგარიშის წაშლა', { variant: 'outline', icon: 'trash', class: 'btn-block', onClick: deleteAccount }),
              h('p', { class: 'faint', style: { fontSize: '12.5px' } }, 'წაშლა სამუდამოა: ანგარიში და ყველა ჯანმრთელობის მონაცემი იშლება.')))))));
  };

  function statBox(label, value, unit) {
    return h('div', null, h('div', { class: 'stat-label' }, label), h('div', { class: 'stat-value', style: { fontSize: '22px' } }, value, unit ? h('small', null, ` ${unit}`) : null));
  }

  function privacyCard() {
    const body = h('div', { class: 'list' }, row({ icon: 'sparkles', ink: 'violet', title: 'AI-სთან გაზიარება', sub: 'იტვირთება…' }));
    readAiConsent(true).then((st) => {
      mount(body,
        row({
          icon: 'sparkles', ink: 'violet', title: 'AI-სთან გაზიარება (Medi)',
          sub: st.accepted ? `ნებადართულია${st.updatedAt ? ` · ${fmtDate(st.updatedAt, { year: true })}` : ''}` : 'არ არის ნებადართული — Medi-ს პირველად გამოყენებისას გკითხავთ',
          trailing: button(st.accepted ? 'მართვა' : 'ნახვა', { size: 'sm', variant: 'ghost', onClick: async () => { await askAiConsent(st, { settings: true }); render(); } }),
        }),
        row({ icon: 'shield', ink: 'teal', title: 'კონფიდენციალურობის თანხმობა', sub: session.profile?.extraAnswers?.privacyAcceptedAt ? `მიღებულია ${fmtDate(session.profile.extraAnswers.privacyAcceptedAt, { year: true })}` : 'მიღებულია' }));
    }).catch(() => mount(body, row({ icon: 'sparkles', ink: 'violet', title: 'AI-სთან გაზიარება', sub: 'სტატუსი ვერ ჩაიტვირთა' })));
    return card(body);
  }

  function emailCard() {
    const u = session.user || {};
    if (isSyntheticEmail(u.email)) {
      return card(h('p', { class: 'muted', style: { fontSize: '14px' } }, 'შეხსენებები და push შეტყობინებები MEDICARD აპში იმართება.'));
    }
    const body = h('div', null, h('p', { class: 'faint' }, 'იტვირთება…'));
    get('/api/account/email-preferences').then((pref) => {
      mount(body, h('div', { class: 'between' },
        h('div', null, h('div', { class: 'card-title' }, 'სიახლეები ელ-ფოსტით'), h('div', { class: 'card-sub' }, 'რჩევები და სიახლეები. სერვისის წერილები მაინც მოვა.')),
        toggle(Boolean(pref.marketingOptIn), async (on) => {
          try { await patch('/api/account/email-preferences', { marketingOptIn: on }); toast(on ? 'ჩაირთო' : 'გამოირთო'); } catch (e) { toast(e.message, 'error'); }
        })));
    }).catch(() => mount(body, h('p', { class: 'faint' }, 'პარამეტრები ვერ ჩაიტვირთა.')));
    return card(body);
  }

  function editPersonal() {
    const u = session.user || {};
    const max = new Date(); max.setFullYear(max.getFullYear() - 18);
    formModal({
      title: 'პირადი მონაცემები',
      fields: [
        field('სახელი და გვარი', input({ name: 'fullName', value: u.fullName || '', required: true, minlength: 2 })),
        h('div', { class: 'form-row' },
          field('სქესი', select(opts(GENDER, false), u.gender || 'FEMALE', { name: 'gender' })),
          field('დაბადების თარიღი', input({ name: 'birthDate', type: 'date', value: u.birthDate || '', max: max.toISOString().slice(0, 10) }))),
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
        toast('შენახულია');
        render();
      },
    });
  }

  function editHealth() {
    const p = session.profile || {};
    const tags = (name, value, placeholder) => textarea({ name, value: Array.isArray(value) ? value.join(', ') : '', placeholder, rows: 2, style: { minHeight: '64px' } });
    formModal({
      title: 'ჯანმრთელობის პროფილი',
      size: 'lg',
      fields: [
        h('div', { class: 'form-row' },
          field('სიმაღლე (სმ)', input({ name: 'heightCm', type: 'number', min: 80, max: 250, value: p.heightCm ?? '' })),
          field('წონა (კგ)', input({ name: 'weightKg', type: 'number', step: '0.1', min: 20, max: 300, value: p.weightKg ?? '' }))),
        h('div', { class: 'form-row' },
          field('სისხლის ჯგუფი', select([{ value: '', label: '—' }, ...BLOOD.map((b) => ({ value: b, label: b })), { value: 'UNKNOWN', label: 'არ ვიცი' }], p.bloodType || '', { name: 'bloodType' })),
          field('აქტიურობა', select(opts(ACTIVITY), p.activityLevel || '', { name: 'activityLevel' }))),
        h('div', { class: 'form-row' },
          field('მოწევა', select(opts(SMOKING), p.smokingStatus || '', { name: 'smokingStatus' })),
          field('ალკოჰოლი', select(opts(ALCOHOL), p.alcoholUse || '', { name: 'alcoholUse' }))),
        h('div', { class: 'form-row' },
          field('ძილის ხარისხი', select(opts(SLEEP), p.sleepQuality || '', { name: 'sleepQuality' })),
          field('სტრესი', select(opts(STRESS), p.stressLevel || '', { name: 'stressLevel' }))),
        field('ალერგიები', tags('allergies', p.allergies, 'მძიმით გამოყავი: პენიცილინი, თხილი')),
        field('ქრონიკული მდგომარეობები', tags('chronicConditions', p.chronicConditions, 'მაგ: ჰიპერტენზია')),
        field('ოჯახური ისტორია', tags('familyHistory', p.familyHistory, 'მაგ: დიაბეტი (დედა)')),
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
        toast('ჯანმრთელობის პროფილი განახლდა');
        render();
      },
    });
  }

  function linkPhone() {
    let phone = '';
    const m = openModal({
      title: 'ტელეფონის დადასტურება',
      size: 'sm',
      body: (close) => {
        const box = h('div');
        const err = h('div', { class: 'form-error', hidden: true });
        const step1 = () => {
          const inp = input({ type: 'tel', inputmode: 'numeric', placeholder: '5XX XXX XXX', maxlength: 12 });
          const go = button('კოდის მიღება', { class: 'btn-block' });
          go.addEventListener('click', () => busy(go, async () => {
            err.hidden = true;
            phone = inp.value.replace(/\D/g, '').replace(/^995/, '');
            try { const r = await post('/api/auth/phone/link/start', { phone }); step2(r); } catch (e) { err.textContent = e.message; err.hidden = false; }
          }));
          mount(box, h('div', { class: 'form' }, h('p', { class: 'muted' }, 'დადასტურებული ნომერი საჭიროა ჯილდოების მისაღებად და ქალების სივრცისთვის.'), field('ნომერი', h('div', { class: 'phone-wrap' }, h('span', null, '+995'), inp)), err, go));
          setTimeout(() => inp.focus(), 30);
        };
        const step2 = (r) => {
          const code = input({ inputmode: 'numeric', maxlength: 4, placeholder: '0000', value: r?.devCode || '' });
          const go = button('დადასტურება', { class: 'btn-block' });
          go.addEventListener('click', () => busy(go, async () => {
            err.hidden = true;
            try {
              const res = await post('/api/auth/phone/link/verify', { phone, code: code.value.trim() });
              if (res.user) setUser(res.user);
              await refreshMe().catch(() => {});
              close();
              toast('ნომერი დადასტურდა');
              render();
            } catch (e) { err.textContent = e.message; err.hidden = false; }
          }));
          mount(box, h('div', { class: 'form' }, h('p', { class: 'muted' }, `კოდი გაიგზავნა ნომერზე +995 ${phone}.`), field('4-ნიშნა კოდი', code), err, go));
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
      title: 'ანგარიშის წაშლა',
      body: 'ანგარიში და ყველა მონაცემი — მედიკამენტები, ანალიზები, ჩანაწერები, ციკლი, კვება — სამუდამოდ წაიშლება. აღდგენა შეუძლებელია.',
      confirm: 'გაგრძელება',
      danger: true,
    });
    if (!ok) return;
    const word = 'წაშლა';
    formModal({
      title: 'დაადასტურე წაშლა',
      size: 'sm',
      danger: true,
      submit: 'სამუდამოდ წაშლა',
      fields: [h('p', { class: 'muted' }, `დასადასტურებლად ჩაწერე სიტყვა „${word}“.`), field('დადასტურება', input({ name: 'confirm', autocomplete: 'off' }))],
      onSubmit: async (v, close) => {
        if (v.confirm.trim() !== word) throw new Error(`ჩაწერე „${word}“.`);
        await del('/api/auth/me');
        close();
        signOut();
        location.href = '/';
      },
    });
  }

  render();
}
