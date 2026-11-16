/* Spora site: small interactions. Everything here is an enhancement: without this file the page
   shows the same content as plain rows, lists and photos. No cookies, no storage, no network. */
(function () {
  'use strict';
  var doc = document;
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls) { var n = doc.createElement(tag); if (cls) n.className = cls; return n; }
  function each(list, fn) { for (var i = 0; i < list.length; i++) fn(list[i], i); }

  /* 1. Kit / hobby / farm switch. The three list items become tab panels, each with its phone screen. */
  (function () {
    var list = doc.querySelector('.who-list');
    if (!list) return;
    var items = list.children;
    if (items.length < 2) return;
    var tabs = el('div', 'who-tabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', 'Kind of grower');
    var buttons = [];

    function select(i, focus) {
      each(items, function (li, k) {
        var on = k === i;
        li.hidden = !on;
        li.classList.toggle('is-in', on);
        buttons[k].setAttribute('aria-selected', on ? 'true' : 'false');
        buttons[k].tabIndex = on ? 0 : -1;
      });
      if (focus) buttons[i].focus();
    }

    each(items, function (li, i) {
      var copy = el('div', 'who-copy');
      while (li.firstChild) copy.appendChild(li.firstChild);
      li.appendChild(copy);
      if (li.getAttribute('data-screen')) {
        var phone = el('figure', 'phone');
        var screen = el('div', 'screen');
        var img = el('img');
        img.src = li.getAttribute('data-screen');
        img.width = 720; img.height = 1513;
        img.alt = li.getAttribute('data-screen-alt') || '';
        img.loading = 'lazy';
        if (li.hasAttribute('data-screen-bar')) {
          screen.innerHTML = '<span class="bar" aria-hidden="true"><b>9:41</b><svg width="54" height="14"><use href="#sb-right"/></svg></span>';
        }
        screen.appendChild(img);
        phone.appendChild(screen);
        li.appendChild(phone);
      }
      li.id = li.id || 'who-panel-' + i;
      li.setAttribute('role', 'tabpanel');
      var b = el('button');
      b.type = 'button';
      b.id = 'who-tab-' + i;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-controls', li.id);
      b.textContent = li.getAttribute('data-tab') || copy.querySelector('h3').textContent;
      li.setAttribute('aria-labelledby', b.id);
      b.addEventListener('click', function () { select(i); });
      b.addEventListener('keydown', function (e) {
        var n = items.length, to = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') to = (i + 1) % n;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') to = (i + n - 1) % n;
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = n - 1;
        if (to >= 0) { e.preventDefault(); select(to, true); }
      });
      buttons.push(b);
      tabs.appendChild(b);
    });
    list.setAttribute('role', 'presentation');
    list.parentNode.insertBefore(tabs, list);
    list.classList.add('is-switch');
    select(0);
    // The first panel is shown without its entry animation; later ones animate in.
    items[0].classList.remove('is-in');
  })();

  /* 2. Photo sliders: three photos in a row become one picture that crossfades as you drag. */
  var scrubs = [];
  each(doc.querySelectorAll('.trio'), function (trio, n) {
    var lis = trio.children;
    if (lis.length < 2) return;
    var wrap = el('div', 'scrub');
    var stage = el('div', 'scrub-stage');
    var marks = el('div', 'scrub-marks');
    var imgs = [], labels = [];
    each(lis, function (li) {
      var img = li.querySelector('img');
      var span = li.querySelector('span');
      if (!img) return;
      img.removeAttribute('loading');
      stage.appendChild(img);
      imgs.push(img);
      var m = el('span');
      m.textContent = span ? span.textContent : '';
      marks.appendChild(m);
      labels.push(m);
    });
    marks.setAttribute('aria-hidden', 'true');
    var input = el('input', 'scrub-range');
    input.type = 'range'; input.min = 0; input.max = 100; input.step = 1; input.value = 0;
    input.setAttribute('aria-label', trio.getAttribute('aria-label') || 'Progress');
    var last = imgs.length - 1;

    function paint() {
      var v = +input.value / 100 * last;
      var near = Math.round(v);
      each(imgs, function (img, i) {
        img.style.opacity = i === 0 ? 1 : Math.max(0, Math.min(1, v - (i - 1)));
      });
      each(labels, function (m, i) { m.classList.toggle('is-on', i === near); });
      input.setAttribute('aria-valuetext', labels[near].textContent);
      input.style.setProperty('--fill', input.value + '%');
    }
    var touched = false;
    function stop() { touched = true; }
    input.addEventListener('input', paint);
    input.addEventListener('pointerdown', stop);
    input.addEventListener('keydown', stop);

    wrap.appendChild(stage);
    wrap.appendChild(input);
    wrap.appendChild(marks);
    trio.parentNode.replaceChild(wrap, trio);
    wrap.parentNode.classList.add('has-scrub');
    paint();

    // Play once, slowly, the first time it is seen, so it is clear the picture moves.
    if (!calm && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        var t0 = null, ms = 2600;
        function frame(t) {
          if (touched) return;
          if (t0 === null) t0 = t;
          var p = Math.min(1, (t - t0) / ms);
          input.value = Math.round((p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2) * 100);
          paint();
          if (p < 1) requestAnimationFrame(frame);
        }
        setTimeout(function () { requestAnimationFrame(frame); }, 350);
      }, { threshold: .6 });
      io.observe(stage);
    }
    scrubs.push(wrap);
  });

  /* 3. Feature tour. On a wide screen the steps share one phone that stays in view while the
     screen changes. On small screens, and without this script, every step keeps its own phone. */
  (function () {
    var tour = doc.querySelector('[data-tour]');
    if (!tour || !('IntersectionObserver' in window) || !window.matchMedia) return;
    var steps = tour.querySelectorAll('[data-step]');
    if (!steps.length) return;
    var stage = el('div', 'tour-stage');
    var phone = el('figure', 'phone');
    var screens = el('div', 'tour-screens');
    var photo = el('div', 'tour-photo');
    var slides = [];
    each(steps, function (step, i) {
      var s = step.querySelector('.phone .screen');
      var slide = null;
      if (s) {
        slide = s.cloneNode(true);
        each(slide.querySelectorAll('img'), function (img) { img.removeAttribute('loading'); });
        screens.appendChild(slide);
      }
      slides.push(slide);
    });
    phone.appendChild(screens);
    stage.appendChild(phone);
    stage.appendChild(photo);

    var photoStep = tour.querySelector('[data-step="photo"]');
    var photoScrub = photoStep && photoStep.querySelector('.scrub');
    var photoHome = photoScrub && photoScrub.parentNode;

    var current = -1;
    function show(i) {
      if (i === current) return;
      current = i;
      var isPhoto = steps[i] === photoStep && photoScrub;
      stage.classList.toggle('is-photo', !!isPhoto);
      if (isPhoto) return; // the phone keeps its last screen underneath while it fades out
      each(slides, function (s, k) { if (s) s.classList.toggle('is-on', k === i); });
    }
    var io = new IntersectionObserver(function (entries) {
      each(entries, function (e) {
        if (e.isIntersecting) show(Array.prototype.indexOf.call(steps, e.target));
      });
    }, { rootMargin: '-50% 0px -50% 0px' });

    var mq = window.matchMedia('(min-width: 1001px) and (min-height: 700px)');
    var on = false;
    function sync() {
      if (mq.matches === on) return;
      on = mq.matches;
      tour.classList.toggle('is-tour', on);
      if (on) {
        tour.appendChild(stage);
        if (photoScrub) photo.appendChild(photoScrub);
        each(steps, function (s) { io.observe(s); });
        if (current < 0) show(0);
      } else {
        io.disconnect();
        if (photoScrub) photoHome.appendChild(photoScrub);
        if (stage.parentNode) stage.parentNode.removeChild(stage);
      }
    }
    if (mq.addEventListener) mq.addEventListener('change', sync); else mq.addListener(sync);
    sync();
  })();

  /* 4. Scroll reveals. Only for what starts below the fold, so the page is complete at rest. */
  (function () {
    if (calm || !('IntersectionObserver' in window)) return;
    var sel = '.section-head,.row-text,.row-media,.pair .card,.lab-list>div,.lab-more>div,.where>li,' +
      '.farm-photo,.farm-text,.guides-media,.team,.get-card,.news-list>div,.faq-list';
    var vh = window.innerHeight;
    var io = new IntersectionObserver(function (entries) {
      each(entries, function (e) {
        if (!e.isIntersecting && e.boundingClientRect.top > 0) return;
        io.unobserve(e.target);
        e.target.classList.add('rv-in');
        e.target.addEventListener('transitionend', function done(ev) {
          if (ev.target !== e.target) return;
          e.target.removeEventListener('transitionend', done);
          e.target.classList.remove('rv', 'rv-in');
          e.target.style.transitionDelay = '';
        });
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    each(doc.querySelectorAll(sel), function (n) {
      if (n.closest('.tour-stage') || n.closest('.rv')) return;
      var r = n.getBoundingClientRect();
      if (r.top < vh) return;
      // Neighbours in a grid arrive one after the other.
      var k = 0, p = n;
      if (/^(DIV|LI)$/.test(n.tagName) && n.parentNode.children.length <= 6 && n.matches('.lab-list>div,.lab-more>div,.where>li,.news-list>div,.pair .card')) {
        while ((p = p.previousElementSibling)) k++;
      }
      if (k) n.style.transitionDelay = (k % 3) * 70 + 'ms';
      n.classList.add('rv');
      io.observe(n);
    });
  })();
})();
