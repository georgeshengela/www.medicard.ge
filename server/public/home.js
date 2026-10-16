/* MEDICARD front page: the world map in the hero and the live country count. */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var I18N = window.MedicardI18n || { isEn: false, t: function (k) { return k; } };
  var year = document.getElementById('y');
  if (year) year.textContent = String(new Date().getFullYear());

  /* ───── MEDICARD in numbers: live whole-app totals (/api/site/stats), counted up once in view ───── */
  // Fallbacks = the totals on 2026-10-16, so the block never reads empty if the API is slow
  var STATS = { steps: 28166754, medicines: 10014, mediAnswers: 1255, coins: 12520, cycleLogs: 1128, waterLiters: 410, countries: 10 };
  var countEls = Array.prototype.slice.call(document.querySelectorAll('.numbers .count'));
  var counted = false;
  function statKey(el) { return el.id === 'countries-count' ? 'countries' : el.dataset.stat; }
  function fmt(n, format) {
    if (format === 'millions') { var m = Math.floor(n / 1e6); return I18N.isEn ? m + 'M' : m + ' მლნ'; }
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, I18N.isEn ? ',' : ' ');
  }
  function paint(el, n) { el.textContent = fmt(n, el.dataset.format); }
  function setStat(key, n) {
    if (!(n > 0)) return;
    STATS[key] = n;
    if (!counted) return; // the count-up will land on the new value
    countEls.forEach(function (el) { if (statKey(el) === key) paint(el, n); });
  }
  function countUp() {
    counted = true;
    var t0 = performance.now(), dur = 1700;
    (function frame(now) {
      var k = reduced ? 1 : Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      countEls.forEach(function (el) { paint(el, STATS[statKey(el)] * e); });
      if (k < 1) requestAnimationFrame(frame);
    })(t0);
  }
  countEls.forEach(function (el) { paint(el, STATS[statKey(el)]); });
  if (countEls.length && window.fetch) {
    fetch('/api/site/stats').then(function (r) { return r.ok ? r.json() : null; }).then(function (s) {
      if (s) Object.keys(s).forEach(function (k) { if (k in STATS) setStat(k, Number(s[k])); });
    }).catch(function () {});
  }
  if (countEls.length && 'IntersectionObserver' in window && !reduced) {
    var numIo = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      numIo.disconnect();
      countUp();
    }, { threshold: 0.3 });
    numIo.observe(document.querySelector('.numbers'));
  } else {
    counted = true;
  }

  /* ───── World map: light every country with at least one MEDICARD user ───── */
  var worldDots = document.getElementById('world-dots');
  if (worldDots && window.fetch) {
    Promise.all([
      fetch('/world/countries.json?v=1').then(function (r) { return r.json(); }),
      fetch('/api/site/presence').then(function (r) { return r.ok ? r.json() : { countries: [] }; })
    ]).then(function (res) {
      var map = res[0], codes = (res[1] && res[1].countries) || [], names = (res[1] && res[1].names) || {};
      // Georgia first: it is home, and the name tag starts there
      codes = codes.filter(function (c) { return map.c[c]; })
        .sort(function (a, b) { return (b === 'GE') - (a === 'GE'); });
      var dots = codes.map(function (code, i) {
        var p = map.c[code];
        // A small round flag marks the country (circle-flags, MIT, vendored in /world/flags)
        var dot = document.createElement('i');
        dot.className = 'world-dot' + (code === 'GE' ? ' is-home' : '');
        dot.style.backgroundImage = 'url(/world/flags/' + code.toLowerCase() + '.svg)';
        dot.style.left = (p[0] / map.w * 100).toFixed(3) + '%';
        dot.style.top = (p[1] / map.h * 100).toFixed(3) + '%';
        dot.style.setProperty('--i', i);
        worldDots.appendChild(dot);
        return { el: dot, name: (names[code] && names[code][I18N.isEn ? 'en' : 'ka']) || code };
      });
      if (dots.length) setStat('countries', dots.length);
      if (!dots.length) return;
      // One name at a time: neighbours in Europe sit too close for every label at once
      var tag = document.createElement('span');
      tag.className = 'world-tag';
      worldDots.appendChild(tag);
      var at = -1;
      function next() {
        if (dots[at]) dots[at].el.classList.remove('is-named');
        at = (at + 1) % dots.length;
        var d = dots[at];
        d.el.classList.add('is-named');
        tag.classList.remove('is-on');
        setTimeout(function () {
          tag.textContent = d.name;
          tag.style.left = d.el.style.left;
          tag.style.top = d.el.style.top;
          // Under the top bar (phones): hang the tag below the flag there
          tag.classList.remove('is-below');
          var a = tag.getBoundingClientRect();
          ['#topbar'].forEach(function (sel) {
            var el = document.querySelector(sel);
            if (!el) return;
            var b = el.getBoundingClientRect();
            if (a.left < b.right + 8 && a.right > b.left - 8 && a.top < b.bottom + 8 && a.bottom > b.top - 8) tag.classList.add('is-below');
          });
          tag.classList.add('is-on');
        }, reduced ? 0 : 380);
      }
      setTimeout(function () {
        next();
        if (dots.length > 1) setInterval(next, 2800);
      }, reduced ? 0 : 900 + dots.length * 120);
    }).catch(function () {});
  }
})();
