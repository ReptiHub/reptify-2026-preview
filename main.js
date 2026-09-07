/* Reptify Media — reveal on scroll (once), the header clock, and ( 04 )'s counting figure. */

(function () {
  var targets = document.querySelectorAll('[data-reveal], .srule, .spine, .roll');
  if (!('IntersectionObserver' in window)) {
    for (var i = 0; i < targets.length; i++) targets[i].classList.add('in');
    return;
  }
  /* threshold 0, not 0.15. A fold taller than the viewport can never present
     15% of itself through a shrunken root at the moment the observer samples,
     and when it misses, that element keeps opacity:0 forever — the reader sees
     a blank column where The Cost should be. Any pixel intersecting is enough. */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  targets.forEach(function (t) { io.observe(t); });

  /* Belt and braces. If anything is still unrevealed once the page has settled —
     a missed callback, a restored scroll position, a fold above the entry point —
     show it. Nothing on this site should be permanently invisible because one
     observer callback did not arrive. */
  /* Two sweeps after load. The first catches anything already near the viewport
     that the observer has not reported yet. The second is the safety net: at three
     seconds every remaining target is revealed outright, whatever the observer is
     doing. A reveal is a nicety; text that never appears is a broken page, and the
     Cost fold going blank intermittently is exactly that failure. */
  window.addEventListener('load', function () {
    setTimeout(function () {
      targets.forEach(function (t) {
        if (t.classList.contains('in')) return;
        var r = t.getBoundingClientRect();
        if (r.top < window.innerHeight * 1.5) t.classList.add('in');
      });
    }, 400);
    setTimeout(function () {
      targets.forEach(function (t) { t.classList.add('in'); });
    }, 3000);
  });
})();

/* Two local times. The pitch is coverage of the hours a small team cannot
   staff, so the page says what hour it is in both places the business works
   from. Updates twice a minute, never animates. */
(function () {
  var el = document.getElementById('clock');
  if (!el) return;
  function at(zone) {
    return new Date().toLocaleTimeString('en-US', {
      timeZone: zone, hour: 'numeric', minute: '2-digit'
    });
  }
  function tick() {
    el.textContent = 'SFO ' + at('America/Los_Angeles') +
                     '  \u00b7  NYC ' + at('America/New_York');
  }
  tick();
  setInterval(tick, 30000);
})();

/* One call to action on screen at a time. The sticky bar is the phone's
   persistent action, but the closing fold carries the same button — two of the
   same button in one screen reads as a page that does not know what it wants.
   The bar steps out while the closing fold is in view and comes back after.

   The form's submit button is the same case and was missed. On contact the bar
   says "Request an Audit" and links to #form, so while Send request is on screen
   it offers to scroll the reader to the thing they are already looking at — the
   redundancy this rule exists to prevent, on the one page where the action
   actually happens. Two targets now, and the bar hides while EITHER is visible,
   which is why this tracks a set rather than reading entries[0]: with more than
   one target, entries carries only what changed, and the last change is not the
   same question as whether anything is still on screen. */
(function () {
  var bar = document.querySelector('.bar');
  if (!bar || !('IntersectionObserver' in window)) return;
  var mates = [document.querySelector('.cta'), document.querySelector('.form .btn')]
    .filter(Boolean);
  if (!mates.length) return;
  var visible = [];
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      var i = visible.indexOf(e.target);
      if (e.isIntersecting) { if (i < 0) visible.push(e.target); }
      else if (i >= 0) { visible.splice(i, 1); }
    });
    bar.classList.toggle('bar--away', visible.length > 0);
  }, { threshold: 0 });
  mates.forEach(function (t) { io.observe(t); });
})();

/* A second click closes the question.

   The fold runs on radio inputs, which is what makes one answer close another and
   what lets the whole thing animate with no script at all. The one thing a radio
   cannot do is turn itself off, so clicking an open question does nothing. This
   restores that: if the label's own input is already checked, cancel the click and
   clear it by hand. Six lines to keep the no-script behaviour and gain the toggle,
   rather than swapping in checkboxes and losing one-at-a-time. */
(function () {
  document.querySelectorAll('.faqf label[for]').forEach(function (label) {
    label.addEventListener('click', function (e) {
      var input = document.getElementById(label.getAttribute('for'));
      if (input && input.checked) { e.preventDefault(); input.checked = false; }
    });
  });
})();

/* The seam's last line of defence.

   The two words run on a view() timeline whose range is the `contain` phase —
   the stretch where the band covers the frame. `contain` has zero length unless
   the band is taller than the viewport, and a zero-length range plus
   animation-fill-mode: both holds frame 0 forever. That is the failure this
   guards, and the band's height against the viewport's is the whole test.

   It used to test the words' opacity after a three-second timer instead, on the
   theory that invisible words meant a broken timeline. But opacity 0 is where
   the animation legitimately ends — the words tear apart and fade. So anyone who
   reloaded below the seam, or scrolled past it inside three seconds, tripped the
   guard and got the two words frozen on top of each other for the rest of the
   session. A state the animation is supposed to reach is not evidence that it
   failed. */
(function () {
  var band = document.querySelector('.friction');
  var seam = band && band.closest('.seam');
  if (!seam) return;
  function check() {
    band.classList.toggle('seam--static', seam.offsetHeight <= window.innerHeight);
  }
  check();
  addEventListener('resize', check);
})();


/* The one action the site has, reported to analytics if analytics is there.

   "Request an Audit" appears in six places — nav, hero, section CTAs, the mobile
   bar, the footer and the closing fold — and they are all the same action under
   the same name, so they are all the same event. Reporting them separately would
   answer "which button" when the question worth answering is "did they ask".
   The placement rides along as a parameter for whoever does want that breakdown.

   Delegated from the document, so it covers buttons that did not exist at load,
   and guarded on gtag, so the site behaves identically with analytics removed. */
(function () {
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="contact"]');
    if (!a || typeof window.gtag !== 'function') return;
    var where = a.closest('.bar') ? 'mobile bar'
              : a.closest('.hdr') ? 'header'
              : a.closest('.ftr') ? 'footer'
              : a.closest('.cta') ? 'closing fold'
              : 'in page';
    gtag('event', 'audit_request_click', {
      placement: where,
      page_path: location.pathname
    });
  }, true);
})();


/* Where the reader is, in the contents list.

   The arrowhead moves to the entry whose heading has most recently reached the
   top of the page, so the mark and the heading are literally in line when it
   happens.

   This reads the headings' positions on scroll rather than using an
   IntersectionObserver, and that is the second attempt. An observer answers "is
   this element visible", and the question here is "which heading is the last one
   above the line" — a different question, and the observer answered it wrongly:
   it only reports crossings, so a heading that never crossed while the reader
   jumped stayed unrecorded and the mark stuck on whichever one happened to fire
   last. Six rect reads on a throttled scroll is a rounding error, and it is
   right every time, including on a jump, a resize, or an anchor landing.

   Throttled to one read per frame, and it does nothing at all when nothing
   changed. */
(function () {
  var toc = document.querySelector('.toc');
  if (!toc) return;
  var links = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
  if (!links.length) return;

  var items = [];
  links.forEach(function (a) {
    var el = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (el) items.push({ a: a, el: el });
  });
  if (!items.length) return;

  var current = null, ticking = false;

  function read() {
    ticking = false;
    /* the line sits just under the sticky header — a heading counts as reached
       when its top passes it */
    /* a few pixels below the header rather than exactly on it: a heading parked
       at 100.4px against a line at 100 is "not yet there" by a third of a pixel,
       which is not a distinction any reader is making */
    var line = (parseFloat(getComputedStyle(document.documentElement)
                  .getPropertyValue('--header')) || 72) + 34;
    var found = null;
    for (var i = 0; i < items.length; i++) {
      if (items[i].el.getBoundingClientRect().top <= line) found = items[i];
    }
    if (found === current) return;
    if (current) current.a.classList.remove('is-here');
    if (found) found.a.classList.add('is-here');
    current = found;
  }
  function tick() { if (!ticking) { ticking = true; requestAnimationFrame(read); } }

  read();
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick);
})();


/* Journal search.
 *
 * It used to hide non-matching cards where they stood. That is fine for a grid
 * and wrong for the deck, which is a three-card slicing accordion: removing a
 * slice made the survivors resize, so a reader typing two letters watched the
 * furniture rearrange instead of seeing an answer.
 *
 * A query now swaps the deck, the grid and the topic pills for a list of
 * results, and clearing it puts them back. Rows rather than cards, because a
 * result is a decision and a row is the fastest thing to scan.
 *
 * Still no index and no request: the articles are already in the page as cards,
 * so the rows are built from them. With script off the field is inert and the
 * pills still work, which is the order of priority this page should have. */
(function () {
  var q = document.getElementById('jq');
  var jl = document.querySelector('.jl');
  if (!q || !jl) return;

  var cards = Array.prototype.slice.call(document.querySelectorAll('.jl [data-cat]'));
  if (!cards.length) return;

  /* read each card once, so typing never touches the DOM it is searching */
  var docs = cards.map(function (el) {
    var pick = function (sel) {
      var n = el.querySelector(sel);
      return n ? n.textContent.trim() : '';
    };
    return {
      href:  el.getAttribute('href'),
      cat:   el.getAttribute('data-cat') || '',
      title: pick('.jfeat__t, .ecard__t'),
      desc:  pick('.jfeat__d, .ecard__d'),
      date:  pick('time'),
      hay:   el.textContent.toLowerCase()
    };
  });

  var res = document.createElement('section');
  res.className = 'jres';
  res.setAttribute('aria-label', 'Search results');
  res.setAttribute('aria-live', 'polite');
  jl.appendChild(res);

  function esc(t) {
    return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  /* mark the matched run inside the title, so the reader can see why a row is
     here without reading the whole line */
  function mark(text, term) {
    var i = text.toLowerCase().indexOf(term);
    if (!term || i < 0) return esc(text);
    return esc(text.slice(0, i)) + '<mark>' + esc(text.slice(i, i + term.length)) +
           '</mark>' + esc(text.slice(i + term.length));
  }

  function run() {
    var t = q.value.trim().toLowerCase();

    if (!t) {
      jl.classList.remove('is-searching');
      res.innerHTML = '';
      return;
    }

    jl.classList.add('is-searching');
    var hits = docs.filter(function (d) { return d.hay.indexOf(t) > -1; });

    if (!hits.length) {
      res.innerHTML = '<p class="jres__count">Nothing in the Journal matches ' +
        '<b>' + esc(q.value.trim()) + '</b> yet.</p>';
      return;
    }

    res.innerHTML =
      '<p class="jres__count"><b>' + hits.length + '</b> ' +
      (hits.length === 1 ? 'piece' : 'pieces') + ' matching <b>' +
      esc(q.value.trim()) + '</b></p>' +
      '<div class="jres__list">' + hits.map(function (d) {
        return '<a class="jres__row" href="' + d.href + '">' +
                 '<span class="jres__t">' + mark(d.title, t) + '</span>' +
                 '<span class="jres__meta">' + esc(d.cat) + ' &middot; ' + esc(d.date) + '</span>' +
                 '<span class="jres__d">' + mark(d.desc, t) + '</span>' +
               '</a>';
      }).join('') + '</div>';
  }

  q.addEventListener('input', run);
  q.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && q.value) { q.value = ''; run(); }
  });
})();


/* ── the sweep ─────────────────────────────────────────────
   A section heading inks in letter by letter as it comes up the page. Written as
   a house device rather than as one heading's trick: put `data-sweep` on any
   heading and it gets the same move, which is how the Journal is meant to rhyme
   with the rest of the site instead of merely sharing its palette.

   The split is done here rather than in the markup so the HTML stays a sentence
   — copy that lives as one string can be edited, translated and read by a
   crawler; copy pre-split into forty spans cannot. Existing element children
   (the greyed first word) are walked into rather than flattened, so the two-tone
   survives and each half keeps its own end colour.

   No JS, no split, no animation, and the heading is simply a heading. The colour
   at rest is the end state, never the start, so nothing can strand it pale. */
/* The splitter both letter devices use. Walks into element children rather than
   flattening them, so a two-tone heading keeps its halves and each keeps its own
   end colour, and skips any subtree matching `skip` — the audit's labels are
   screen-reader text and have no business being animated one character at a
   time. Spaces stay bare text nodes: they take no index, and there is nothing to
   see happening to a space. Returns how many characters got a span.

   Kept as one function because the second caller was going to be a copy of the
   first with two lines different, and two DOM walkers that must agree is how a
   device drifts from the thing it was meant to rhyme with. */
function splitLetters(root, skip, onChar) {
  var i = 0;
  (function walk(node) {
    [].slice.call(node.childNodes).forEach(function (n) {
      if (n.nodeType === 3) {
        var frag = document.createDocumentFragment();
        n.nodeValue.split('').forEach(function (ch) {
          if (ch === ' ') { frag.appendChild(document.createTextNode(' ')); return; }
          var s = document.createElement('span');
          s.className = 'ltr';
          s.textContent = ch;
          onChar(s, i++);
          frag.appendChild(s);
        });
        node.replaceChild(frag, n);
      } else if (n.nodeType === 1 && !(skip && n.matches(skip))) {
        walk(n);
      }
    });
  })(root);
  return i;
}

(function () {
  var heads = document.querySelectorAll('[data-sweep]');
  if (!heads.length || !CSS.supports('animation-timeline', 'view()')) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  heads.forEach(function (h) {
    var n = splitLetters(h, null, function (s, i) { s.style.setProperty('--i', i); });
    /* the last index, not the count — dividing by the count leaves the final
       letter at 10/11 of the ramp and it never quite reaches full ink. Floored at
       1 so a one-letter heading cannot divide by zero. */
    h.style.setProperty('--n', Math.max(1, n - 1));
  });
})();


/* ── ( 05 ): the answers type themselves in ────────────────
   Each of the four lines in an open pane arrives one character at a time.

   The characters are already in the page and stay there — split into spans and
   hidden with opacity, never removed and re-inserted. A typewriter that builds
   its string in JS is invisible to a crawler and reads as a stream of single
   letters to a screen reader, which on a page arguing that businesses should be
   findable would be a joke at its own expense.

   Nothing moves. Every span holds its box whether it is showing or not, so a
   line cannot reflow as it types and the panel's height is settled from the
   first frame. That is the same property the fold was rebuilt around.

   Keyed on .in as well as [open], so the pane that is open on arrival types as
   the fold reaches the reader rather than having already finished somewhere up
   the page. Every later one types on the click that opens it. */
(function () {
  var panes = document.querySelectorAll('.naud__pane');
  var bodies = document.querySelectorAll('.npil__b');
  if (!panes.length && !bodies.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  /* ( 06 ) runs the same device on its descriptions. One paragraph rather than
     four lines, so there is no running total to keep and no line index — the
     shared delay reads --s and --l as 0 when nothing sets them. */
  bodies.forEach(function (b) {
    splitLetters(b, null, function (s, i) { s.style.setProperty('--i', i); });
    b.classList.add('is-typed');
  });

  panes.forEach(function (p) {
    /* --s is how many characters the lines above this one hold, so a line starts
       when the one before it has finished rather than on a fixed offset from it.
       That distinction is the whole difference between four typewriters running
       at once and one machine working down the pane: a fixed offset overlaps
       whenever a line is longer than the offset assumes, and these lines are 41,
       21, 48 and 29 characters. Only the running total knows. */
    var run = 0;
    [].slice.call(p.querySelectorAll('.naud__k, .naud__f')).forEach(function (l, li) {
      var n = splitLetters(l, '.naud__lbl', function (s, i) { s.style.setProperty('--i', i); });
      l.style.setProperty('--l', li);
      l.style.setProperty('--s', run);
      run += n;
    });
    /* the class, not the presence of .ltr: the CSS must not hide a single
       character on a page where this script did not run */
    p.classList.add('is-typed');
  });
})();


/* ── bookmark us ───────────────────────────────────────────
   There is no way to add a bookmark from script. Every browser removed it years
   ago on purpose, because a page that can write to your bookmarks can also spam
   them. So the button does the only honest thing available: it names the
   shortcut, with the modifier that matches the machine it is being read on.

   Platform is read from userAgentData where it exists and the UA string where it
   does not, and anything unrecognised falls back to Ctrl — being wrong towards
   Ctrl on a Mac is a smaller failure than showing a Mac key on Windows, which is
   the more common machine.

   The hint is a live region so it is announced rather than only seen, and the
   button is a real <button>, not an anchor with no destination. */
(function () {
  var btn = document.querySelector('[data-bookmark]');
  var hint = document.querySelector('[data-bookmark-hint]');
  if (!btn || !hint) return;

  var p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  var mac = /mac|iphone|ipad|ipod/i.test(p);
  var keys = mac ? '\u2318 D' : 'Ctrl + D';
  var timer;

  btn.addEventListener('click', function () {
    hint.textContent = 'Press ' + keys + ' to bookmark this page.';
    hint.classList.add('is-on');
    clearTimeout(timer);
    timer = setTimeout(function () {
      hint.classList.remove('is-on');
      /* cleared after the fade, not with it, so the text does not vanish mid-transition */
      setTimeout(function () { hint.textContent = ''; }, 400);
    }, 6000);
  });
})();

/* ── the Journal's lead accordion ─────────────────────────
   Which of the three is open is a choice the reader makes, not a hover state,
   and this is the whole of what makes it one.

   Hover cannot express it. Read more and the headline live in the text column
   beside the pictures, and the only route a pointer has from a slip to that
   button crosses the gutter and the other slip. Under :hover the card closed the
   instant the pointer left the picture, so every article except the first could
   be read and never clicked. Opening on point and staying open until another
   slip is pointed at is what makes the text reachable.

   The attribute ships as 0 in the markup, so the first card is open before this
   runs and stays open if it never does. Nothing here is required for the page to
   work — every card is a plain link either way.

   pointerenter rather than mouseenter: a pen or a hybrid device gets the same
   behaviour, and a touch that lands on a slip opens it instead of doing nothing.
   focusin covers the keyboard, where tabbing through the three is the same
   journey. */
(function () {
  var strip = document.querySelector('.jdeck__strip');
  if (!strip) return;

  var slices = Array.prototype.slice.call(strip.children);
  if (slices.length < 2) return;

  slices.forEach(function (slice, i) {
    function open() {
      if (strip.dataset.open !== String(i)) strip.dataset.open = String(i);
    }
    slice.addEventListener('pointerenter', open);
    slice.addEventListener('focusin', open);
  });
})();

/* Print. Delegated from the document so it costs one listener for the whole
   site rather than one per article, and so it keeps working if a share row is
   ever rendered after load. The part worth writing was the @media print block,
   not the call.

   The colophon's printed-on date is stamped here rather than written into the
   page, because it is a fact about this sheet and not about the article. It
   hangs off beforeprint so the browser's own print command gets it too — a
   reader who never touches our button still ends up with a dated page. Stamped
   on the button path as well, since older Safari fired beforeprint late or not
   at all, and a duplicate assignment costs nothing. */
(function () {
  function stamp() {
    var el = document.querySelector('[data-printed]');
    if (!el) return;
    el.textContent = ' \u00b7 Printed ' + new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    });
  }

  window.addEventListener('beforeprint', stamp);

  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('[data-print]');
    if (!btn) return;
    e.preventDefault();
    stamp();
    window.print();
  });
})();

/* Cookie choice.
 *
 * Every page ships Consent Mode v2 with analytics_storage DENIED as its
 * default, set before the config call. So denial is the resting state and this
 * bar exists only to grant — which is the right way round, and why "Decline"
 * here is not a promise about future behaviour but a decision to leave things
 * exactly as they already are.
 *
 * The default re-applies on every page load, so a previous "accept" has to be
 * re-granted on each page rather than assumed to persist. That happens first,
 * before any UI, so an accepting visitor is measured from the first hit.
 *
 * Injected rather than written into 18 files: a visitor who has already chosen
 * must never see it, and static markup would paint and then hide on each load.
 * There is no non-JS fallback because there is nothing a non-JS fallback could
 * do — it cannot store a choice, and the analytics it would be consenting to
 * cannot run either.
 *
 * Only analytics is offered. The site runs no advertising and shares nothing
 * with ad networks, so ad_storage stays denied in every branch; a toggle for
 * something we do not do would be theatre. */
(function () {
  var KEY = 'rm-consent', VERSION = 1;

  function read() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY));
      return v && v.v === VERSION ? v : null;
    } catch (e) { return null; }
  }

  /* HighLevel's page tracking, on the same decision as GA.
   *
   * Their install note says to paste a plain <script> before </body> on every
   * page. Done that way it fires before the visitor has been asked and again
   * after they decline, which would make the Decline button untrue and
   * contradict a sentence already published on the privacy page. So it loads
   * from here instead: same switch as analytics_storage, injected once, never
   * on a refusal.
   *
   * Above the gtag guard on purpose. If gtag is blocked — an ad blocker, a
   * corporate proxy — apply() returns early, and anything written below that
   * line silently never runs for the visitors most likely to have blocked it. */
  var GHL_ID = 'tk_f0745f17e74f4cebb10d71860e418726';
  var ghlDone = false;
  function loadGHL() {
    if (ghlDone) return;
    ghlDone = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://link.msgsndr.com/js/external-tracking.js';
    s.setAttribute('data-tracking-id', GHL_ID);
    document.body.appendChild(s);
  }

  function apply(analytics) {
    if (analytics) loadGHL();
    if (typeof gtag !== 'function') return;
    gtag('consent', 'update', {
      analytics_storage: analytics ? 'granted' : 'denied'
    });
  }

  function save(analytics) {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        v: VERSION, analytics: !!analytics, at: new Date().toISOString()
      }));
    } catch (e) { /* private mode: the choice holds for this page only */ }
    apply(analytics);
  }

  var saved = read();
  if (saved) apply(saved.analytics);   /* before the UI, so the first hit counts */

  function build() {
    var el = document.createElement('div');
    el.className = 'cbar';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'false');
    el.setAttribute('aria-label', 'Cookie choices');
    el.innerHTML =
      '<div class="cbar__row">' +
        '<p class="cbar__say">By using this site, you agree to our use of cookies. ' +
        '<a href="' + (location.pathname.indexOf('/journal/') === 0 ? '../' : '') + 'privacy.html">Privacy Policy</a></p>' +
        '<div class="cbar__acts">' +
          '<button type="button" class="cbar__b" data-c="accept">Accept</button>' +
          '<button type="button" class="cbar__b cbar__b--ghost" data-c="decline">Decline</button>' +
          '<button type="button" class="cbar__b cbar__b--ghost" data-c="prefs" aria-expanded="false">Manage preferences</button>' +
        '</div>' +
      '</div>' +
      '<div class="cbar__prefs" hidden>' +
        '<label class="cbar__opt">' +
          '<input type="checkbox" checked disabled>' +
          '<span><b>Strictly necessary</b><i>Remembers this choice and keeps the site working. No tracking, and it cannot be switched off.</i></span>' +
        '</label>' +
        '<label class="cbar__opt">' +
          '<input type="checkbox" data-opt="analytics"' + (saved && saved.analytics ? ' checked' : '') + '>' +
          '<span><b>Analytics</b><i>Google Analytics, and nothing else. Never shared with advertisers. Decline and GA still gets a cookieless ping, but sets no cookie.</i></span>' +
        '</label>' +
        '<div class="cbar__acts" style="margin-top:.75rem">' +
          '<button type="button" class="cbar__b" data-c="save">Save preferences</button>' +
        '</div>' +
      '</div>';
    return el;
  }

  function open() {
    if (document.querySelector('.cbar')) return;
    var el = build();
    document.body.appendChild(el);
    document.body.classList.add('has-cbar');

    /* The footer has to grow by however tall this is, or the bar lands on the
       legal line and hides Privacy, Terms and Cookies. Re-measured whenever the
       preferences panel opens, because that changes the height. */
    var measure = function () {
      document.documentElement.style.setProperty('--cbar-h', el.offsetHeight + 'px');
    };
    measure();
    if (window.ResizeObserver) new ResizeObserver(measure).observe(el);
    /* Force the starting transform to be computed, then transition off it.
       requestAnimationFrame was the obvious way to do this and is wrong here:
       rAF does not fire in a background tab, so a site opened in one built the
       bar and never revealed it. A reflow works whether the tab is painting or
       not, and if it is not, the bar is simply already in place when it is. */
    void el.offsetHeight;
    el.classList.add('cbar--in');

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-c]');
      if (!b) return;
      var c = b.getAttribute('data-c');

      if (c === 'prefs') {
        var panel = el.querySelector('.cbar__prefs');
        var show = panel.hidden;
        panel.hidden = !show;
        b.setAttribute('aria-expanded', String(show));
        return;
      }
      if (c === 'accept') save(true);
      else if (c === 'decline') save(false);
      else if (c === 'save') save(el.querySelector('[data-opt="analytics"]').checked);
      close(el);
    });
  }

  function close(el) {
    el.classList.remove('cbar--in');
    document.body.classList.remove('has-cbar');
    document.documentElement.style.removeProperty('--cbar-h');
    var done = function () { el.remove(); };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done();
    else { el.addEventListener('transitionend', done, { once: true }); setTimeout(done, 700); }
  }

  /* A choice you cannot revisit is not a choice. The footer legal line gains a
     way back in, added here so it cannot drift out of sync across 18 files. */
  var fine = document.querySelector('.ftr__fine p:last-child');
  if (fine) {
    /* A button, not a link. It performs an action on this page rather than
       going anywhere, and href="#" would have told both the browser and a
       screen reader otherwise. "Cookie preferences" rather than "Cookies" for
       the same reason: sitting between Privacy and Terms, a one-word label
       reads as a third policy page that does not exist. */
    fine.insertAdjacentHTML('beforeend',
      ' &middot; <button type="button" class="ftr__pref" data-cookie-reopen>Cookie preferences</button>');
    fine.addEventListener('click', function (e) {
      var a = e.target.closest('[data-cookie-reopen]');
      if (!a) return;
      e.preventDefault();
      var existing = document.querySelector('.cbar');
      if (existing) return;
      open();
      var panel = document.querySelector('.cbar__prefs');
      var btn = document.querySelector('[data-c="prefs"]');
      if (panel) { panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); }
    });
  }

  if (!saved) open();
})();

/* The solution list: let a pointer choice outlive the pointer.
 *
 * The scroll cascade and the hover state were fighting. Hovering killed the
 * animation so the hover rules could show through, but :hover stops matching
 * the moment the pointer leaves, the animation resumes, and the light snaps
 * back to whatever the scroll position says. The reader picks a solution, looks
 * away, and the site puts it back — which reads as being overruled.
 *
 * So a pointer choice sets .is-picked and it stays set. Scrolling is what hands
 * control back to the cascade, because scrolling is the reader saying they are
 * done choosing. A threshold rather than any scroll at all: momentum and the
 * odd stray pixel should not count as a decision. */
(function () {
  /* Parameterised, because ( 06 ) of the location pages runs the same device.
     Was hardcoded to .help__list and .help; the body below is unchanged apart
     from taking the list, the fold and a class prefix as arguments. The Napa
     rows are the second caller. */
  function wire(list, fold, prefix) {
    if (!list || !fold) return;

    var items = Array.prototype.slice.call(list.children);
    if (items.length < 2) return;

    var liveIdx = -1;
    var pickedAt = 0;

    function pick(li) {
      items.forEach(function (n) { n.classList.toggle('is-picked', n === li); });
      list.classList.add(prefix + '--picked');
      list.classList.remove(prefix + '--live');
      liveIdx = -1;
      /* the frame column reads this — the offer's position is the only thing the
         stylesheet needs to know to bring the matching photograph up */
      fold.setAttribute('data-sol', String(items.indexOf(li) + 1));
      pickedAt = window.scrollY;
    }

    items.forEach(function (li) {
      li.addEventListener('pointerenter', function () { pick(li); });
      li.addEventListener('focusin', function () { pick(li); });
    });

    /* ── the fold reads itself as it passes ──────────────────
       A pointer is not the only way to be looking at something. Scrolling the
       fold through the viewport walks the offers in order, dimming the rest and
       bringing up the matching frame, so a reader who never moves the mouse
       still sees all five — which on a trackpad or a phone-turned-laptop is
       most of them.

       The pointer always wins while it is claiming a row; this only runs when
       it is not. And releasing hands back to the scroll position rather than to
       nothing, so the fold never blanks between the two. */
    function fromScroll() {
      if (list.classList.contains(prefix + '--picked')) return;
      var r = fold.getBoundingClientRect();
      var vh = window.innerHeight || document.documentElement.clientHeight;
      if (r.bottom < 0 || r.top > vh) return;
      /* 0 as the fold's top meets the bottom of the screen, 1 as its bottom
         leaves the top — the whole of its pass, not just the part on screen */
      var p = (vh - r.top) / (vh + r.height);
      p = Math.min(Math.max(p, 0), 0.9999);
      var i = Math.floor(p * items.length);
      if (i === liveIdx) return;
      liveIdx = i;
      items.forEach(function (n, k) { n.classList.toggle('is-picked', k === i); });
      list.classList.add(prefix + '--live');
      fold.setAttribute('data-sol', String(i + 1));
    }

    window.addEventListener('scroll', fromScroll, { passive: true });
    window.addEventListener('resize', fromScroll);
    fromScroll();

    window.addEventListener('scroll', function () {
      if (!list.classList.contains(prefix + '--picked')) return;
      if (Math.abs(window.scrollY - pickedAt) < 40) return;
      list.classList.remove(prefix + '--picked');
      items.forEach(function (n) { n.classList.remove('is-picked'); });
      liveIdx = -1;
      fromScroll();
    }, { passive: true });
  }

  var hl = document.querySelector('.help__list');
  if (hl) wire(hl, hl.closest('.help'), 'help__list');

  /* the location pages' ( 06 ). The list is its own fold here, so it is both
     arguments; the rows are its children either way. */
  var np = document.querySelector('.npil');
  if (np) wire(np, np, 'npil');
})();

/* ── ( 05 ): one question is always open ───────────────────
   <details name> gives exclusivity for free but not a floor. Clicking the open
   question closes it, and because only one can be open, that leaves the fold
   showing four bare questions with a chevron each and nothing inside — which
   reads as an empty list rather than as an accordion somebody collapsed. The
   markup opens the first one, and this is what keeps a floor under it after
   the reader starts clicking.

   Cancelling the click on the already-open summary is the whole mechanism.
   Enter and Space on a focused <summary> dispatch a click too, so the keyboard
   is covered by the same three lines and nothing needs a key handler.

   Deliberately not the toggle event: by the time that fires the details has
   already closed, and reopening it there is a second frame of the fold with a
   hole in it. */
(function () {
  var sums = [].slice.call(document.querySelectorAll('.naud > details > summary'));
  if (!sums.length) return;

  sums.forEach(function (s) {
    s.addEventListener('click', function (e) {
      if (s.parentNode.open) e.preventDefault();
    });
  });

  /* ── and on hover, to match ( 06 ) ──────────────────────────────────────
     Only where there is a cursor. A touch reader still taps, which is what
     <details> does on its own.

     THE GUARD IS THE WHOLE THING. Opening a question closes the one above it,
     which removes that panel's height and slides the question you are pointing
     at UP the list — measured at 144px — out from under the cursor and onto its
     neighbour. The browser then fires pointerenter on THAT neighbour, even
     though the pointer has not moved a pixel, and the list walks itself down to
     the bottom. That cascade is why the first hover version of this fold was
     abandoned.

     An enter event carrying the same coordinates as the last real pointermove
     is the element arriving under a stationary cursor, not the cursor arriving
     at the element. Ignoring those leaves exactly one open per gesture: the
     fold opens what you point at, and if it then slides out from under you,
     nothing else happens until you actually move the mouse again.

     This leans on the order Pointer Events specifies for a pointer crossing
     into a new element — the boundary events first, pointermove after — so at
     the moment enter fires, px/py still hold where the pointer WAS. A phantom
     enter has no move beside it, so px/py already hold where the pointer IS,
     and the two match. Worth stating because the first test written for this
     fired move before enter, which is backwards, and made a working guard look
     like it was blocking every hover. */
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var px = -1, py = -1;
  window.addEventListener('pointermove', function (e) {
    px = e.clientX; py = e.clientY;
  }, { passive: true });

  sums.forEach(function (s) {
    s.addEventListener('pointerenter', function (e) {
      if (e.clientX === px && e.clientY === py) return;
      s.parentNode.open = true;
    });
  });
})();

/* ── the client stories ────────────────────────────────────
   Two arrows stepping through the slots. Written against whatever slots are
   present rather than a fixed count, so adding a real testimonial is a matter of
   adding a <figure> and nothing else.

   The ends stop rather than wrap. A carousel that loops gives the reader no way
   to know they have seen everything, and with three slots they would find that
   out by going round twice. Disabled buttons say it in one glance. */
(function () {
  var track = document.getElementById('stories-track');
  if (!track) return;

  var slides = Array.prototype.slice.call(track.querySelectorAll('.story'));
  if (slides.length < 2) return;

  var nav = document.querySelectorAll('[data-story]');
  var at = 0;

  function show(i) {
    at = Math.min(Math.max(i, 0), slides.length - 1);
    slides.forEach(function (s, k) { s.classList.toggle('is-on', k === at); });
    nav.forEach(function (b) {
      var step = parseInt(b.getAttribute('data-story'), 10);
      b.disabled = (at + step < 0) || (at + step > slides.length - 1);
    });
  }

  nav.forEach(function (b) {
    b.addEventListener('click', function () {
      show(at + parseInt(b.getAttribute('data-story'), 10));
    });
  });

  show(0);
})();

/* ── how far the Process picture reaches ───────────────────
   It covers the heading and the first pass, then stops. That height is the
   bottom of the first row measured from the top of the fold, and neither piece
   has a size CSS can be told in advance — the heading wraps differently at every
   width and the row's height comes from its own sentence. So it is measured and
   written as --svcf-pic-h, and the stylesheet carries a 40% fallback for the
   case where this never runs.

   Re-measured on resize and once the fonts have loaded, because a heading set in
   the fallback face is a different height from the same heading in Archivo, and
   the first measurement would otherwise be of the wrong page. */
(function () {
  var sec = document.querySelector('.svcf');
  var first = sec && sec.querySelector('.svcf__item');
  if (!sec || !first) return;

  function set() {
    /* the rule above the first row, not below it — the picture stops on that
       hairline rather than crossing it */
    var h = first.getBoundingClientRect().top - sec.getBoundingClientRect().top;
    sec.style.setProperty('--svcf-pic-h', Math.round(h) + 'px');
  }

  set();
  window.addEventListener('resize', set);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(set);
})();

/* ── the phone menu ─────────────────────────────────────────
   Open state lives on <html>, not on the button, so the panel, the ground and
   the scroll lock can all be written from one selector. Closes on Escape, on any
   link inside it, and on a resize past the breakpoint — the last one matters
   because a phone rotated to landscape crosses 861 and would otherwise be left
   with an open panel and no button to shut it. */
(function () {
  var b = document.querySelector('.burger');
  var nav = document.getElementById('nav');
  if (!b || !nav) return;
  var root = document.documentElement;

  function set(open) {
    root.classList.toggle('nav-open', open);
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  b.addEventListener('click', function () {
    set(!root.classList.contains('nav-open'));
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) set(false);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') set(false);
  });
  window.addEventListener('resize', function () {
    if (window.innerWidth > 860) set(false);
  });
})();


/* ── ( 04 ) · the counting figure, fallback only ──────────
   The count is CSS now: a registered custom property scrubbed by a view
   timeline, so the reader drives it by scrolling. This exists for browsers
   that cannot do that.

   It stands down where the CSS works. Both writing to the same element would
   have the script setting textContent while the stylesheet renders a counter
   in ::after — two numbers, one box.

   The element ships with its final value as text, so a browser that supports
   neither still shows 45%. Nothing here can leave a wrong number on screen. */
(function () {
  var fig = document.querySelector('[data-count-to]');
  if (!fig) return;

  /* CSS owns it wherever scroll-driven animation exists. */
  /* 'view()' with the parentheses. Testing the bare keyword returns false in a
     browser that fully supports scroll-driven animation, so this guard failed
     open: the script ran alongside the CSS and its textContent write deleted
     the literal fallback element the CSS depends on. */
  if (window.CSS && CSS.supports && CSS.supports('animation-timeline', 'view()')) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;                       /* the static value is already right */

  var from = parseInt(fig.getAttribute('data-count-from'), 10);
  var to   = parseInt(fig.getAttribute('data-count-to'), 10);
  if (isNaN(from) || isNaN(to)) return;

  var band = fig.closest('[data-reveal]');
  if (!band) return;

  var ran = false;
  function run() {
    if (ran) return;
    ran = true;
    var t0 = null, done = false, STEP = 28, cur = from;

    /* The correct value lands whatever the loop does. rAF is throttled in a
       hidden tab, so a count that writes its start value up front and trusts
       the loop to arrive is how a figure freezes on the wrong number. */
    var backstop = setTimeout(function () {
      if (!done) { done = true; fig.textContent = to + '%'; }
    }, (to - from) * STEP + 900);

    function frame(t) {
      if (done) return;
      if (t0 === null) { t0 = t; fig.textContent = from + '%'; }
      var want = Math.min(from + Math.floor((t - t0) / STEP), to);
      if (want > cur) cur = cur + 1;          /* one at a time, never a jump */
      fig.textContent = cur + '%';
      if (cur < to) {
        requestAnimationFrame(frame);
      } else {
        done = true;
        clearTimeout(backstop);
        fig.textContent = to + '%';
      }
    }
    requestAnimationFrame(frame);
  }

  if (band.classList.contains('in')) { run(); return; }
  var mo = new MutationObserver(function () {
    if (band.classList.contains('in')) { mo.disconnect(); run(); }
  });
  mo.observe(band, { attributes: true, attributeFilter: ['class'] });
}());
