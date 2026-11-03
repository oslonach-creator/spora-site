/* Spora site: cookieless campaign counting + test signup.
   No cookies, no localStorage, no visitor ID, no IP stored by us.
   Counts one "visit" per page load and one "form_start" per page load, with the campaign code
   from ?c= or ?utm_campaign=, a 2-letter language and a device class. Honours Do Not Track / GPC
   for counting (signups still work). Details: privacy.html#website */
(function () {
  'use strict';
  var API = 'https://rypnhprmjxhuiimblrtf.supabase.co/rest/v1/rpc/';
  var KEY = 'sb_publishable_LXLKtk-56j9YH-9xzxo2FA_B0T4QW7m';
  var CONSENT = 'site-signup-v1-2026-11';

  function clean(v, extra) {
    if (!v) return null;
    var re = extra ? /[^a-z0-9._-]/g : /[^a-z0-9-]/g;
    var out = String(v).toLowerCase().replace(re, '').slice(0, 64);
    return out || null;
  }
  var q = new URLSearchParams(location.search);
  // Instagram's own bio link arrives as ?utm_source=ig&utm_content=link_in_bio with no campaign,
  // whatever is typed in the bio field. Count it as campaign "ig-bio" so bio visits are attributed.
  var igBio = !q.get('c') && !q.get('utm_campaign') && (q.get('utm_source') || '').toLowerCase() === 'ig' &&
    (q.get('utm_content') || '').toLowerCase() === 'link_in_bio';
  var ctx = {
    campaign: clean(q.get('c') || q.get('utm_campaign') || (igBio ? 'ig-bio' : null)),
    source: clean(q.get('utm_source') || (q.get('c') && /^ig-/.test(q.get('c').toLowerCase()) ? 'instagram' : null), true),
    medium: clean(q.get('utm_medium'), true),
    lang: ((navigator.language || '').slice(0, 2).toLowerCase().match(/^[a-z]{2}$/) || [null])[0],
    device: window.matchMedia('(pointer: coarse)').matches
      ? (Math.min(screen.width, screen.height) >= 600 ? 'tablet' : 'mobile') : 'desktop'
  };
  var noCount = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
  var page = location.pathname.toLowerCase().replace(/[^a-z0-9/._-]/g, '').slice(0, 80) || '/';

  function rpc(name, body) {
    return fetch(API + name, {
      method: 'POST', keepalive: true,
      headers: { 'Content-Type': 'application/json', apikey: KEY, Authorization: 'Bearer ' + KEY },
      body: JSON.stringify(body)
    });
  }
  function track(event) {
    if (noCount) return;
    rpc('site_track', { p_event: event, p_page: page, p_campaign: ctx.campaign, p_utm_source: ctx.source,
      p_utm_medium: ctx.medium, p_lang: ctx.lang, p_device: ctx.device }).catch(function () {});
  }

  // Carry the campaign code into the email fallbacks so mailed requests can be joined too.
  if (ctx.campaign) {
    var links = document.querySelectorAll('a[href^="mailto:hello@getspora.app?subject="]');
    for (var i = 0; i < links.length; i++) {
      links[i].href = links[i].href.replace(/subject=([^&]*)/, function (m, s) { return 'subject=' + s + '%20%5B' + ctx.campaign + '%5D'; });
    }
  }

  track('visit');

  var form = document.getElementById('signup');
  if (!form) return;
  form.hidden = false;
  var status = form.querySelector('.signup-status');
  var started = false;
  form.addEventListener('focusin', function () { if (!started) { started = true; track('form_start'); } });

  var emailLabel = form.querySelector('[data-email-label]');
  function syncPlatform() {
    var p = form.platform.value;
    emailLabel.textContent = p === 'android' ? 'Gmail address on your Android phone' : 'Your email';
  }
  form.addEventListener('change', syncPlatform);
  syncPlatform();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var btn = form.querySelector('button[type=submit]');
    status.className = 'signup-status';
    if (!form.consent.checked) { status.textContent = 'Please tick the box so we may email you.'; return; }
    var platform = form.platform.value;
    btn.disabled = true;
    status.textContent = 'Sending…';
    rpc('site_signup', {
      p_email: form.email.value, p_platform: platform, p_consent_version: CONSENT,
      p_grows: form.grows.value, p_campaign: ctx.campaign, p_utm_source: ctx.source,
      p_lang: ctx.lang, p_device: ctx.device, p_website: form.website.value
    }).then(function (r) { return r.ok ? r.json() : 'error'; }).then(function (res) {
      btn.disabled = false;
      if (res === 'ok') {
        form.reset(); syncPlatform();
        status.className = 'signup-status is-ok';
        status.textContent = platform === 'android'
          ? 'Thanks. We will send your Google Play test link to that address.'
          : 'Thanks. We will email you the day Spora is on the App Store.';
      } else if (res === 'bad_email') {
        status.textContent = 'That email address does not look right.';
      } else {
        status.innerHTML = 'Something went wrong. Please email <a href="mailto:hello@getspora.app">hello@getspora.app</a> instead.';
      }
    }).catch(function () {
      btn.disabled = false;
      status.innerHTML = 'No connection. Please email <a href="mailto:hello@getspora.app">hello@getspora.app</a> instead.';
    });
  });
})();
