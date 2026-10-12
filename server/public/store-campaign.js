/* App Store campaign links (App Store Connect → Analytics → Acquisition → Campaigns), 2026-10-12.
   An ad links to e.g. /cycle?c=ig-cycle-a; every App Store button on the page then opens
   apps.apple.com/app/apple-store/id6812517519?pt=…&ct=ig-cycle-a&mt=8, so App Store Connect counts downloads per ad.
   Without ?c= the page's own name is used (data-campaign on this script tag, e.g. site-cycle).
   Only the campaign name travels: no personal or health data, no cookies. */
(function () {
  var APP = 'https://apps.apple.com/app/id6812517519';
  var clean = function (s) { return String(s || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 30); };
  var me = document.currentScript;
  var q = '';
  try { q = new URLSearchParams(location.search).get('c'); } catch (e) {}
  var ct = clean(q) || clean(me && me.getAttribute('data-campaign')) || 'site';
  var url = 'https://apps.apple.com/app/apple-store/id6812517519?pt=128273660&ct=' + ct + '&mt=8';
  var links = document.querySelectorAll('a[href="' + APP + '"]');
  for (var i = 0; i < links.length; i++) links[i].href = url;
})();
