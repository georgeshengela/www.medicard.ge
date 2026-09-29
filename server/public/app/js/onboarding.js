// MEDICARD web — first-run profile (same data the app's onboarding writes).
// Steps: sex → main goal → birth date (18+) → height/weight → privacy acceptance (required legal record).
// The voluntary AI consent is asked the first time the person uses Medi, never pre-accepted here.
import { h, mount, icon, button, busy, field, input } from './ui.js';
import { post, put } from './api.js';
import { session, setProfile, setUser, signOut } from './session.js';

export function renderOnboarding(root, { onDone }) {
  const p = session.profile || {};
  const u = session.user || {};
  const state = {
    step: 0,
    gender: u.gender || null,
    goal: p.extraAnswers?.primaryGoal || null,
    birthDate: u.birthDate || '',
    heightCm: p.heightCm || '',
    weightKg: p.weightKg || '',
    fullName: u.fullName && u.fullName !== 'Medicard მომხმარებელი' ? u.fullName : '',
    accepted: false,
  };
  const STEPS = 5;
  const box = h('div', { class: 'onb-box' });
  mount(root, h('div', { class: 'onb' }, box));

  const bar = () => h('div', { class: 'onb-steps' }, Array.from({ length: STEPS }, (_, i) => h('i', { class: i <= state.step ? 'on' : '' })));
  const nav = (canNext, onNext, label = 'გაგრძელება') => {
    const next = button(label, { size: 'lg', disabled: !canNext, onClick: () => busy(next, onNext) });
    return h('div', { class: 'between', style: { marginTop: '28px' } },
      state.step > 0
        ? button('უკან', { variant: 'ghost', size: 'lg', icon: 'chevronLeft', onClick: () => { state.step -= 1; render(); } })
        : button('გასვლა', { variant: 'ghost', size: 'lg', onClick: () => { signOut(); location.href = '/app'; } }),
      next);
  };
  const err = h('div', { class: 'form-error', hidden: true });
  const fail = (e) => { err.textContent = e?.message || 'ვერ შეინახა.'; err.hidden = false; };

  function choice(label, ic, ink, on, onClick) {
    return h('button', { type: 'button', class: `choice ${on ? 'on' : ''}`, onClick },
      h('span', { class: `tile ink-${ink}`, style: { width: '40px', height: '40px' } }, icon(ic, { size: 20 })), label);
  }

  function render() {
    err.hidden = true;
    const s = state.step;
    let body;
    if (s === 0) {
      const nameIn = input({ value: state.fullName, placeholder: 'სახელი გვარი', autocomplete: 'name', onInput: (e) => { state.fullName = e.target.value; } });
      body = [
        h('h1', { class: 'page-head', style: { display: 'block', margin: '0 0 8px', fontSize: '28px', fontWeight: 800 } }, 'მოგესალმები MEDICARD-ში'),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, 'რამდენიმე კითხვა — და შენი სივრცე მზადაა. პასუხები ანგარიშში ინახება და აპშიც იგივე იქნება.'),
        field('როგორ მოგმართოთ?', nameIn),
        h('div', { class: 'field-label', style: { margin: '18px 0 10px' } }, 'სქესი'),
        h('div', { class: 'choice-grid' },
          choice('ქალი', 'user', 'rose', state.gender === 'FEMALE', () => { state.gender = 'FEMALE'; render(); }),
          choice('კაცი', 'user', 'blue', state.gender === 'MALE', () => { state.gender = 'MALE'; render(); })),
        nav(Boolean(state.gender), async () => { state.step = 1; render(); }),
      ];
    } else if (s === 1) {
      const goals = [
        ['medications', 'მედიკამენტების დროულად მიღება', 'pill', 'teal'],
        ['nutrition', 'კვება და წონა', 'apple', 'green'],
        ...(state.gender === 'FEMALE' ? [['cycle', 'ციკლის მიყოლა', 'flower', 'rose']] : []),
        ['general', 'ზოგადად ჯანმრთელობა', 'heart', 'violet'],
      ];
      body = [
        h('h2', { style: { fontSize: '26px', fontWeight: 800, marginBottom: '8px' } }, 'რა არის შენთვის მთავარი?'),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, 'მთავარ გვერდზე ამ სექციას პირველად დაგახვედრებთ.'),
        h('div', { class: 'choice-grid' }, goals.map(([v, l, ic, ink]) => choice(l, ic, ink, state.goal === v, () => { state.goal = v; render(); }))),
        nav(Boolean(state.goal), async () => { state.step = 2; render(); }),
      ];
    } else if (s === 2) {
      const max = new Date(); max.setFullYear(max.getFullYear() - 18);
      const bd = input({ type: 'date', value: state.birthDate || '', max: max.toISOString().slice(0, 10), min: '1900-01-01', onInput: (e) => { state.birthDate = e.target.value; } });
      body = [
        h('h2', { style: { fontSize: '26px', fontWeight: 800, marginBottom: '8px' } }, 'დაბადების თარიღი'),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, 'ასაკი საჭიროა ნორმების სწორად გამოსათვლელად. MEDICARD 18 წლიდანაა.'),
        field('თარიღი', bd),
        err,
        nav(true, async () => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(state.birthDate)) { fail({ message: 'მიუთითე დაბადების თარიღი.' }); return; }
          if (new Date(state.birthDate) > max) { fail({ message: 'MEDICARD-ით სარგებლობა 18 წლიდანაა შესაძლებელი.' }); return; }
          state.step = 3; render();
        }),
      ];
    } else if (s === 3) {
      const hIn = input({ type: 'number', inputmode: 'decimal', min: 80, max: 250, placeholder: '170', value: state.heightCm, onInput: (e) => { state.heightCm = e.target.value; } });
      const wIn = input({ type: 'number', inputmode: 'decimal', min: 20, max: 300, step: '0.1', placeholder: '70', value: state.weightKg, onInput: (e) => { state.weightKg = e.target.value; } });
      body = [
        h('h2', { style: { fontSize: '26px', fontWeight: 800, marginBottom: '8px' } }, 'სიმაღლე და წონა'),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, 'BMI-სა და კალორიების გეგმისთვის. შეგიძლია მოგვიანებით შეცვალო.'),
        h('div', { class: 'form-row' }, field('სიმაღლე (სმ)', hIn), field('წონა (კგ)', wIn)),
        err,
        nav(true, async () => {
          const hc = Number(state.heightCm); const wk = Number(state.weightKg);
          if (state.heightCm && (hc < 80 || hc > 250)) { fail({ message: 'სიმაღლე 80–250 სმ ფარგლებში უნდა იყოს.' }); return; }
          if (state.weightKg && (wk < 20 || wk > 300)) { fail({ message: 'წონა 20–300 კგ ფარგლებში უნდა იყოს.' }); return; }
          state.step = 4; render();
        }),
      ];
    } else {
      const check = h('input', { type: 'checkbox', checked: state.accepted, onChange: (e) => { state.accepted = e.target.checked; render(); } });
      body = [
        h('h2', { style: { fontSize: '26px', fontWeight: 800, marginBottom: '8px' } }, 'კონფიდენციალურობა'),
        h('p', { class: 'muted', style: { marginBottom: '16px' } }, 'შენი ჯანმრთელობის მონაცემები განსაკუთრებული კატეგორიისაა. გთხოვ, გაეცნო, როგორ ვინახავთ და ვიცავთ მათ.'),
        h('div', { class: 'policy-scroll' },
          h('p', null, '• მონაცემები ინახება დაშიფრულ არხზე და გამოიყენება მხოლოდ შენთვის სერვისის გასაწევად.'),
          h('p', null, '• შენი მონაცემები არ იყიდება და რეკლამისთვის არ გამოიყენება.'),
          h('p', null, '• AI (Medi) ფუნქციებისთვის მონაცემები მხოლოდ შენი ცალკე, ნებაყოფლობითი თანხმობით იგზავნება — ამას პირველად გამოყენებისას გკითხავთ.'),
          h('p', null, '• ანგარიშის და ყველა მონაცემის წაშლა ნებისმიერ დროს შეგიძლია პროფილიდან.'),
          h('p', { style: { marginTop: '10px' } }, h('a', { href: '/privacy', target: '_blank', class: 'link' }, 'სრული პოლიტიკის წაკითხვა ', icon('externalLink', { size: 14 })))),
        h('label', { class: 'hstack', style: { marginTop: '18px', cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' } }, check,
          h('span', null, 'წავიკითხე და ვეთანხმები ', h('a', { href: '/privacy', target: '_blank', class: 'link' }, 'კონფიდენციალურობის პოლიტიკას'), ' და ', h('a', { href: '/terms', target: '_blank', class: 'link' }, 'წესებს'), '.')),
        err,
        nav(state.accepted, finish, 'დასრულება'),
      ];
    }
    mount(box, bar(), h('div', { class: 'card pad-lg' }, body));
  }

  async function finish() {
    try {
      if (state.fullName.trim().length >= 2 && state.fullName.trim() !== session.user?.fullName) {
        const r = await (await import('./api.js')).patch('/api/auth/me', { fullName: state.fullName.trim() });
        if (r?.user) setUser(r.user);
      }
      await put('/api/health-profile', {
        extraAnswers: {
          assessmentPhaseComplete: true,
          primaryGoal: state.goal,
          privacyAccepted: true,
          privacyAcceptedAt: new Date().toISOString(),
          onboardingSource: 'web',
        },
      });
      const body = { gender: state.gender, birthDate: state.birthDate };
      if (state.heightCm) body.heightCm = Number(state.heightCm);
      if (state.weightKg) body.weightKg = Number(state.weightKg);
      const r = await post('/api/health-profile/complete', body);
      setProfile(r.profile);
      if (r.user) setUser(r.user);
      onDone();
    } catch (e) { fail(e); }
  }

  render();
}
