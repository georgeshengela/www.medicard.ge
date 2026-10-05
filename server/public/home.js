/* MEDICARD front page: Medi demo, spaces. */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var I18N = window.MedicardI18n || { isEn: false, t: function (k) { return k; } };
  var T = I18N.t;
  var year = document.getElementById('y');
  if (year) year.textContent = String(new Date().getFullYear());

  var SCREEN = function (key) { return '/screens/v3/' + key + '.webp?v=1'; };
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /* ───── Medi demo conversation ───── */
  var CHATS = {
    medi: {
      label: T('Medi · მოქმედებები', 'Medi · Actions'),
      turns: [
        { me: T('დღეს დილის წამალი დავლიე?', 'Did I take my morning meds today?') },
        { medi: T('კი, 08:05-ზე მონიშნე. შემდეგი მიღება 20:00-ზეა.', 'Yes, you marked it at 08:05. Your next dose is at 20:00.'), chip: T('შეხსენება 20:00', 'Reminder 20:00') },
        { me: T('ჩაწერე ორი ჭიქა წყალი.', 'Log two glasses of water.') },
        { medi: T('ჩავწერე 500 მლ. დღის მიზნამდე 1 ლიტრი დაგრჩა.', 'Logged 500 ml. You’re 1 liter away from today’s goal.') }
      ]
    },
    doctor: {
      label: T('ექიმთან · კითხვა ჯანმრთელობაზე', 'Doctor · Health questions'),
      turns: [
        { me: T('ბოლო დღეებში საღამოობით თავი მტკივა.', 'I’ve had headaches in the evenings lately.') },
        { medi: T('ამ დღეებში წყალი მიზანზე ნაკლები დალიე და ძილი 6 საათზე ნაკლები იყო — ორივე შეიძლება იყოს ტკივილის მიზეზი.', 'On those days you drank less water than your goal and slept under 6 hours — either could be behind the pain.') },
        { medi: T('თუ ტკივილი უეცრად ძლიერდება, ან მხედველობა, მეტყველება ან ძალა გეცვლება, დაუყოვნებლივ დარეკე 112-ზე.', 'If the pain suddenly gets worse, or your vision, speech or strength changes, call 112 right away.'), chip: T('კითხვები ექიმისთვის', 'Questions for your doctor') }
      ]
    },
    deep: {
      label: T('ღრმა ანალიზი · დოკუმენტები', 'Deep analysis · Documents'),
      turns: [
        { me: T('სისხლის ანალიზის ფურცელი ავტვირთე.', 'I uploaded my blood test results.') },
        { medi: T('ამოვიკითხე 18 მაჩვენებელი. ჰემოგლობინი ნორმაშია, ფერიტინი ნორმის ქვედა ზღვართანაა.', 'I read 18 values. Hemoglobin is in range; ferritin is near the lower limit.') },
        { medi: T('ეს დიაგნოზი არ არის. მოგიმზადე სამი კითხვა ექიმთან განსახილველად.', 'This isn’t a diagnosis. I’ve prepared three questions to discuss with your doctor.'), chip: T('ანალიზი შენახულია', 'Result saved') }
      ]
    }
  };

  var chatBody = document.getElementById('chat-body');
  var chatMode = document.getElementById('chat-mode');
  var chatPanel = document.getElementById('chat');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.modes [role="tab"]'));
  var chatRun = 0;

  function bubble(cls, text, chip) {
    var el = document.createElement('div');
    el.className = 'bubble ' + cls;
    el.textContent = text;
    if (chip) {
      var c = document.createElement('span');
      c.className = 'chip';
      c.textContent = chip;
      el.appendChild(document.createElement('br'));
      el.appendChild(c);
    }
    return el;
  }

  function play(mode) {
    var run = ++chatRun;
    var conv = CHATS[mode];
    chatBody.textContent = '';
    chatMode.textContent = conv.label;
    if (reduced) {
      conv.turns.forEach(function (turn) {
        chatBody.appendChild(turn.me ? bubble('me', turn.me) : bubble('medi', turn.medi, turn.chip));
      });
      return;
    }
    var i = 0;
    (function next() {
      if (run !== chatRun || i >= conv.turns.length) return;
      var turn = conv.turns[i++];
      if (turn.me) {
        chatBody.appendChild(bubble('me', turn.me));
        setTimeout(next, 520);
      } else {
        var typing = document.createElement('div');
        typing.className = 'typing';
        typing.setAttribute('aria-hidden', 'true');
        typing.innerHTML = '<i></i><i></i><i></i>';
        chatBody.appendChild(typing);
        setTimeout(function () {
          if (run !== chatRun) return;
          typing.remove();
          chatBody.appendChild(bubble('medi', turn.medi, turn.chip));
          setTimeout(next, 700);
        }, 900);
      }
    })();
  }

  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
    });
    chatPanel.setAttribute('aria-labelledby', tab.id);
    if (focus) tab.focus();
    play(tab.dataset.mode);
  }

  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      var d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      selectTab(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });

  if (chatBody) {
    var started = false;
    var io = new IntersectionObserver(function (entries) {
      if (!started && entries[0].isIntersecting) {
        started = true;
        play('medi');
        io.disconnect();
      }
    }, { threshold: 0.35 });
    io.observe(chatPanel);
  }

  /* ───── Spaces ───── */
  var spaces = Array.prototype.slice.call(document.querySelectorAll('.space'));
  var mini = document.getElementById('mini-phone');
  var miniScreen = document.getElementById('mini-screen');
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  function showSpace(btn) {
    spaces.forEach(function (s) {
      var on = s === btn;
      s.classList.toggle('is-on', on);
      s.setAttribute('aria-pressed', String(on));
    });
    var key = btn.dataset.screen;
    miniScreen.src = SCREEN(key);
  }
  spaces.forEach(function (btn) {
    btn.addEventListener('click', function () { showSpace(btn); });
    if (fine) btn.addEventListener('pointerenter', function () { showSpace(btn); });
  });
  if (mini && fine && !reduced) {
    var preview = mini.parentElement;
    document.getElementById('spaces').addEventListener('pointermove', function (e) {
      var r = preview.getBoundingClientRect();
      var x = ((e.clientX - r.left) / r.width) * 2 - 1;
      var y = ((e.clientY - r.top) / r.height) * 2 - 1;
      mini.style.setProperty('--ry', clamp(x * 12, -16, 16).toFixed(2) + 'deg');
      mini.style.setProperty('--rx', clamp(-y * 8, -10, 10).toFixed(2) + 'deg');
    });
  }
})();
