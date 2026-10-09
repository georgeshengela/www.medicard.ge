// MEDICARD web — first-run profile (same data the app's onboarding writes).
// Steps: sex → main goal → birth date (18+) → height/weight → privacy acceptance (required legal record).
// The voluntary AI consent is asked the first time the person uses Medi, never pre-accepted here.
import { h, mount, icon, button, busy, field, input } from './ui.js';
import { post, put } from './api.js';
import { session, setProfile, setUser, signOut, displayName } from './session.js';
import { t, isEn } from './i18n.js';

const PRIVACY_URL = isEn ? '/privacy-en' : '/privacy';
const TERMS_URL = isEn ? '/terms-en' : '/terms';

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
    fullName: displayName(),
    accepted: false,
  };
  const STEPS = 5;
  // „MEDICARD უკვე გამოგიყენებია?“ — first, once, on an account created within the last day that has
  // not started onboarding anywhere (same rule as the app and the server's discard-new): a „yes“
  // removes this new empty account so the person signs in the old way. Someone who already answered
  // steps in the app is resumed here instead — „yes“ would be the honest answer for them.
  const askedKey = `medicard.web.existingAccountAsked.${u.id}`;
  const fresh = u.createdAt && Date.now() - new Date(u.createdAt).getTime() < 24 * 60 * 60 * 1000;
  const extra = p.extraAnswers || {};
  const started = Boolean(p.completedAt) || typeof extra.onboardingStepKey === 'string'
    || extra.assessmentPhaseComplete === true || extra.onboardingComplete === true || extra.onboardingVersion != null;
  let asked = true;
  try { asked = Boolean(localStorage.getItem(askedKey)); } catch { asked = false; }
  if (fresh && !asked && !started) state.step = -1;
  const box = h('div', { class: 'onb-box' });
  mount(root, h('div', { class: 'onb' }, box));

  const bar = () => h('div', { class: 'onb-steps' }, Array.from({ length: STEPS }, (_, i) => h('i', { class: i <= state.step ? 'on' : '' })));
  const nav = (canNext, onNext, label = t('გაგრძელება', 'Continue')) => {
    const next = button(label, { size: 'lg', disabled: !canNext, onClick: () => busy(next, onNext) });
    return h('div', { class: 'between', style: { marginTop: '28px' } },
      state.step > 0
        ? button(t('უკან', 'Back'), { variant: 'ghost', size: 'lg', icon: 'chevronLeft', onClick: () => { state.step -= 1; render(); } })
        : button(t('გასვლა', 'Sign out'), { variant: 'ghost', size: 'lg', onClick: () => { signOut(); location.href = '/app'; } }),
      next);
  };
  const err = h('div', { class: 'form-error', hidden: true });
  const fail = (e) => { err.textContent = e?.message || t('ვერ შეინახა.', 'Couldn’t save.'); err.hidden = false; };

  // The cycle goal is for women only: switching to male drops it, so it is never saved hidden.
  const goalKeys = (gender) => ['medications', 'nutrition', ...(gender === 'FEMALE' ? ['cycle'] : []), 'general'];
  const setGender = (gender) => {
    state.gender = gender;
    if (!goalKeys(gender).includes(state.goal)) state.goal = null;
    render();
  };

  function choice(label, ic, ink, on, onClick) {
    return h('button', { type: 'button', class: `choice ${on ? 'on' : ''}`, onClick },
      h('span', { class: `tile ink-${ink}`, style: { width: '40px', height: '40px' } }, icon(ic, { size: 20 })), label);
  }

  function render() {
    err.hidden = true;
    const s = state.step;
    let body;
    if (s === -1) {
      const yes = button(t('კი, ანგარიში უკვე მაქვს', 'Yes, I already have an account'), { variant: 'ghost', size: 'lg', onClick: () => busy(yes, async () => {
        try {
          await post('/api/auth/me/discard-new', {});
          signOut();
          location.href = '/app';
        } catch (e) { fail(e); }
      }) });
      body = [
        h('h1', { class: 'page-head', style: { display: 'block', margin: '0 0 8px', fontSize: '28px', fontWeight: 800 } }, t('MEDICARD უკვე გამოგიყენებია?', 'Have you used MEDICARD before?')),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, t(
          'თუ ანგარიში უკვე გაქვს — ნომრით, ელ-ფოსტით, Apple-ით ან Google-ით, აპში ან ვებზე — შედი იმავე გზით. ასე ყველაფერი ერთ ანგარიშზე დარჩება.',
          'If you already have an account — with a phone number, email, Apple or Google, in the app or on the web — sign in the same way. That keeps everything on one account.',
        )),
        err,
        h('div', { class: 'between', style: { marginTop: '28px' } },
          yes,
          button(t('არა, პირველად ვარ', 'No, I am new here'), { size: 'lg', onClick: () => {
            try { localStorage.setItem(askedKey, '1'); } catch { /* private mode */ }
            state.step = 0;
            render();
          } })),
      ];
      mount(box, h('div', { class: 'card pad-lg' }, body));
      return;
    }
    if (s === 0) {
      const nameIn = input({ value: state.fullName, placeholder: t('სახელი გვარი', 'First and last name'), autocomplete: 'name', onInput: (e) => { state.fullName = e.target.value; } });
      body = [
        h('h1', { class: 'page-head', style: { display: 'block', margin: '0 0 8px', fontSize: '28px', fontWeight: 800 } }, t('მოგესალმები MEDICARD-ში', 'Welcome to MEDICARD')),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, t('რამდენიმე კითხვა — და შენი სივრცე მზადაა. პასუხები ანგარიშში ინახება და აპშიც იგივე იქნება.', 'A few questions and your space is ready. Your answers are saved to your account and show up in the app too.')),
        field(t('როგორ მოგმართოთ?', 'What should we call you?'), nameIn),
        h('div', { class: 'field-label', style: { margin: '18px 0 10px' } }, t('სქესი', 'Sex')),
        h('div', { class: 'choice-grid' },
          choice(t('ქალი', 'Female'), 'user', 'rose', state.gender === 'FEMALE', () => setGender('FEMALE')),
          choice(t('კაცი', 'Male'), 'user', 'blue', state.gender === 'MALE', () => setGender('MALE'))),
        nav(Boolean(state.gender), async () => { state.step = 1; render(); }),
      ];
    } else if (s === 1) {
      const goals = [
        ['medications', t('მედიკამენტების დროულად მიღება', 'Taking medications on time'), 'pill', 'teal'],
        ['nutrition', t('კვება და წონა', 'Nutrition and weight'), 'apple', 'green'],
        ...(state.gender === 'FEMALE' ? [['cycle', t('ციკლის მიყოლა', 'Tracking my cycle'), 'flower', 'rose']] : []),
        ['general', t('ზოგადად ჯანმრთელობა', 'General health'), 'heart', 'violet'],
      ];
      body = [
        h('h2', { style: { fontSize: '26px', fontWeight: 800, marginBottom: '8px' } }, t('რა არის შენთვის მთავარი?', 'What matters most to you?')),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, t('მთავარ გვერდზე ამ სექციას პირველად დაგახვედრებთ.', 'We’ll put this section first on your Home page.')),
        h('div', { class: 'choice-grid' }, goals.map(([v, l, ic, ink]) => choice(l, ic, ink, state.goal === v, () => { state.goal = v; render(); }))),
        nav(goals.some(([v]) => v === state.goal), async () => { state.step = 2; render(); }),
      ];
    } else if (s === 2) {
      const max = new Date(); max.setFullYear(max.getFullYear() - 18);
      const bd = input({ type: 'date', value: state.birthDate || '', max: max.toISOString().slice(0, 10), min: '1900-01-01', onInput: (e) => { state.birthDate = e.target.value; } });
      body = [
        h('h2', { style: { fontSize: '26px', fontWeight: 800, marginBottom: '8px' } }, t('დაბადების თარიღი', 'Date of birth')),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, t('ასაკი საჭიროა ნორმების სწორად გამოსათვლელად. MEDICARD 18 წლიდანაა.', 'Your age helps us calculate reference ranges correctly. MEDICARD is for people 18 and older.')),
        field(t('თარიღი', 'Date'), bd),
        err,
        nav(true, async () => {
          if (!/^\d{4}-\d{2}-\d{2}$/.test(state.birthDate)) { fail({ message: t('მიუთითე დაბადების თარიღი.', 'Enter your date of birth.') }); return; }
          if (new Date(state.birthDate) > max) { fail({ message: t('MEDICARD-ით სარგებლობა 18 წლიდანაა შესაძლებელი.', 'You must be 18 or older to use MEDICARD.') }); return; }
          state.step = 3; render();
        }),
      ];
    } else if (s === 3) {
      const hIn = input({ type: 'number', inputmode: 'decimal', min: 80, max: 250, placeholder: '170', value: state.heightCm, onInput: (e) => { state.heightCm = e.target.value; } });
      const wIn = input({ type: 'number', inputmode: 'decimal', min: 20, max: 300, step: '0.1', placeholder: '70', value: state.weightKg, onInput: (e) => { state.weightKg = e.target.value; } });
      body = [
        h('h2', { style: { fontSize: '26px', fontWeight: 800, marginBottom: '8px' } }, t('სიმაღლე და წონა', 'Height and weight')),
        h('p', { class: 'muted', style: { marginBottom: '22px' } }, t('BMI-სა და კალორიების გეგმისთვის. შეგიძლია მოგვიანებით შეცვალო.', 'For your BMI and calorie plan. You can change this later.')),
        h('div', { class: 'form-row' }, field(t('სიმაღლე (სმ)', 'Height (cm)'), hIn), field(t('წონა (კგ)', 'Weight (kg)'), wIn)),
        err,
        nav(true, async () => {
          const hc = Number(state.heightCm); const wk = Number(state.weightKg);
          if (state.heightCm && (hc < 80 || hc > 250)) { fail({ message: t('სიმაღლე 80–250 სმ ფარგლებში უნდა იყოს.', 'Height must be between 80 and 250 cm.') }); return; }
          if (state.weightKg && (wk < 20 || wk > 300)) { fail({ message: t('წონა 20–300 კგ ფარგლებში უნდა იყოს.', 'Weight must be between 20 and 300 kg.') }); return; }
          state.step = 4; render();
        }),
      ];
    } else {
      const check = h('input', { type: 'checkbox', checked: state.accepted, onChange: (e) => { state.accepted = e.target.checked; render(); } });
      body = [
        h('h2', { style: { fontSize: '26px', fontWeight: 800, marginBottom: '8px' } }, t('კონფიდენციალურობა', 'Privacy')),
        h('p', { class: 'muted', style: { marginBottom: '16px' } }, t('შენი ჯანმრთელობის მონაცემები განსაკუთრებული კატეგორიისაა. გთხოვ, გაეცნო, როგორ ვინახავთ და ვიცავთ მათ.', 'Your health data is a special category of personal data. Please read how we store and protect it.')),
        h('div', { class: 'policy-scroll' },
          h('p', null, t('• მონაცემები ინახება დაშიფრულ არხზე და გამოიყენება მხოლოდ შენთვის სერვისის გასაწევად.', '• Your data travels over an encrypted connection and is used only to provide the service to you.')),
          h('p', null, t('• შენი მონაცემები არ იყიდება და რეკლამისთვის არ გამოიყენება.', '• Your data is never sold and never used for advertising.')),
          h('p', null, t('• AI (Medi) ფუნქციებისთვის მონაცემები მხოლოდ შენი ცალკე, ნებაყოფლობითი თანხმობით იგზავნება — ამას პირველად გამოყენებისას გკითხავთ.', '• For AI (Medi) features, data is sent only with your separate, voluntary consent — we’ll ask the first time you use them.')),
          h('p', null, t('• ანგარიშის და ყველა მონაცემის წაშლა ნებისმიერ დროს შეგიძლია პროფილიდან.', '• You can delete your account and all your data at any time from your profile.')),
          h('p', { style: { marginTop: '10px' } }, h('a', { href: PRIVACY_URL, target: '_blank', class: 'link' }, t('სრული პოლიტიკის წაკითხვა ', 'Read the full policy '), icon('externalLink', { size: 14 })))),
        h('label', { class: 'hstack', style: { marginTop: '18px', cursor: 'pointer', flexWrap: 'nowrap', alignItems: 'flex-start' } }, check,
          isEn
            ? h('span', null, 'I have read and agree to the ', h('a', { href: PRIVACY_URL, target: '_blank', class: 'link' }, 'Privacy Policy'), ' and the ', h('a', { href: TERMS_URL, target: '_blank', class: 'link' }, 'Terms'), '.')
            : h('span', null, 'წავიკითხე და ვეთანხმები ', h('a', { href: PRIVACY_URL, target: '_blank', class: 'link' }, 'კონფიდენციალურობის პოლიტიკას'), ' და ', h('a', { href: TERMS_URL, target: '_blank', class: 'link' }, 'წესებს'), '.')),
        err,
        nav(state.accepted, finish, t('დასრულება', 'Finish')),
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
