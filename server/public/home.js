/* MEDICARD front page: the world map in the hero and the live country count. */
(function () {
  'use strict';

  var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var I18N = window.MedicardI18n || { isEn: false, t: function (k) { return k; } };
  var year = document.getElementById('y');
  if (year) year.textContent = String(new Date().getFullYear());

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
      var count = document.getElementById('countries-count');
      if (count && dots.length) count.textContent = String(dots.length);
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
