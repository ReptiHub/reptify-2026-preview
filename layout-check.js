/* Layout invariants — run this in the browser console on any page of this site.
 *
 *     copy(await fetch('/layout-check.js').then(r=>r.text())) → paste → enter
 *
 * Every rule here exists because it was broken on this site and found by
 * measuring rather than by looking. That is the whole point: these are the
 * faults an eye lets through and a number does not.
 *
 * It reports. It does not fix. A failure is a decision to make, not a value to
 * clamp.
 */
(function () {
  var out = [], fail = 0;
  function check(name, ok, detail) {
    out.push((ok ? '  PASS  ' : '  FAIL  ') + name.padEnd(34) + detail);
    if (!ok) fail++;
  }
  var W = document.documentElement.clientWidth;
  var px = function (n) { return Math.round(n); };

  /* Put the page in its REST state before measuring anything.

     `.js [data-reveal]` is opacity 0 and translateY(10px) until the observer
     adds `.in`, so on a page loaded and measured without scrolling, every
     revealed block is invisible and shifted. Two consequences, and the second
     one hid a real bug for an hour: rects are measured 10px out, and the
     contrast check skips every element it should be testing because they all
     read as opacity 0. The CTA note was being silently passed over for exactly
     this reason while the sanity test insisted the check was broken.

     The sweep driving this used to add the class from outside, and it was
     adding `is-in` — a class that does not exist in this stylesheet. Doing it
     here instead means the check cannot be run against a half-animated page by
     accident, whatever calls it. */
  document.querySelectorAll('[data-reveal], .srule, .spine, .roll')
    .forEach(function (e) { e.classList.add('in'); });
  /* Adding the class is not enough on its own. `[data-reveal]` carries a 450ms
     opacity transition, so the computed value immediately after is still near
     zero and every element reads as hidden — which made the contrast check
     silently skip the entire page and report clean. A stylesheet that cancels
     the transition and pins the end state makes it instant and deterministic.

     It is left in place on purpose: after a run the page is sitting in its
     finished state, which is the state you want to be looking at anyway. */
  var rest = document.createElement('style');
  rest.textContent = '[data-reveal]{transition:none!important;opacity:1!important;transform:none!important}';
  document.head.appendChild(rest);
  document.body.getBoundingClientRect();                  // force the style flush

  /* 1 · MEASURE, held constant across widths.
     The band is stated here rather than buried, because this site chose the
     upper end of it deliberately: its reference runs 105 characters and holds
     that at every width by scaling type with the column. 60–75 is the
     conventional band; 72–88 is what this site set for long-form, matching the
     shape of the reference without going all the way to 105.

     Marketing copy is a different job and gets a different band. It is scanned
     rather than read, and short lines are what make a statement land — 52–72,
     which is where the reference's own homepage sits at 65. Reporting a
     solution page as failing at 65 characters was the check being wrong, not
     the page.

     Change a number here and the decision is visible; never change one to make
     a page pass. */
  /* The band is a desktop band. A 375px phone physically cannot hold 72
     characters at a readable size — it holds about 45, which is correct there and
     not a fault. Checking it below the split reported the phone as broken on
     every run, which is how a check teaches people to ignore it. */
  var LONGFORM = !!document.querySelector('.jp__prose');
  var MEASURE = LONGFORM ? [72, 88] : [52, 72];
  var CHECK_MEASURE = W >= 1000;
  /* the standfirst is deliberately larger than body copy, so it is not body copy
     — including it made this report 1.31x when the real ratio was 1.79 */
  var p = [...document.querySelectorAll('.jp__prose > p, .prose > p, article p')]
    .filter(function (e) {
      return e.textContent.trim().length > 200 && e.offsetWidth > 200 &&
             !e.classList.contains('jp__answer') && !e.classList.contains('lead');
    })
    .sort(function (a, b) { return b.offsetWidth - a.offsetWidth; })[0];
  if (p) {
    var cs = getComputedStyle(p);
    var cx = document.createElement('canvas').getContext('2d');
    cx.font = cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    var s = 'the quick brown fox jumps over a lazy dog and reads a paragraph ';
    var chars = Math.round(p.offsetWidth / (cx.measureText(s).width / s.length));
    if (CHECK_MEASURE) check('measure ' + MEASURE[0] + '–' + MEASURE[1] + ' characters',
      chars >= MEASURE[0] && chars <= MEASURE[1], chars + ' chars');
  }

  /* 2 · COLUMN BALANCE. A secondary column must never be wider than the column
     it supports. Broken at a 900px rail against a 560px article. */
  /* by grid row, not by child count. Reading the first two children skipped
     this check entirely on a container with four — which is how a 659px rail
     beside a 640px column passed. */
  document.querySelectorAll('.jp, .ends').forEach(function (g) {
    if (getComputedStyle(g).display !== 'grid') return;
    var kids = [...g.children].filter(function (e) { return e.offsetWidth > 80; });
    var top = Math.min.apply(null, kids.map(function (e) { return Math.round(e.getBoundingClientRect().top); }));
    var row = kids.filter(function (e) { return Math.round(e.getBoundingClientRect().top) === top; });
    if (row.length !== 2) return;
    var a = row[0].offsetWidth, b = row[1].offsetWidth;
    check('rail ≤ reading column', a <= b + 1, px(a) + ' vs ' + px(b));
  });

  /* 3 · EQUAL MARGINS, on page-level blocks only. A column inside a two-column
     grid is offset by design — checking it for symmetry reports a fault where a
     decision was made, which is worse than not checking. */
  ['.jp', '.jl', '.more__grid', '.hero__grid'].forEach(function (sel) {
    var e = document.querySelector(sel); if (!e) return;
    var r = e.getBoundingClientRect();
    check('equal margins ' + sel, Math.abs(r.left - (W - r.right)) <= 2,
      'L' + px(r.left) + ' R' + px(W - r.right));
  });

  /* 4 · SHARED EDGES. Everything in a column starts on that column's line. */
  var edges = {};
  document.querySelectorAll('.jp__head, .jp__prose, .ends, .more, .ends__more').forEach(function (e) {
    var k = Math.round(e.getBoundingClientRect().left);
    edges[k] = (edges[k] || 0) + 1;
  });
  check('column edges ≤ 2 distinct', Object.keys(edges).length <= 2, Object.keys(edges).join(', '));

  /* 5 · ASPECT RATIOS SURVIVE THEIR TRACK. An aspect-ratio in a stretched grid
     row is a suggestion. Broken at 246 / 261 / 246. */
  ['.ecard__shot', '.mcard__shot'].forEach(function (sel) {
    var els = [...document.querySelectorAll(sel)]; if (els.length < 2) return;
    var hs = els.map(function (e) { return Math.round(e.getBoundingClientRect().height); });
    check('equal image heights ' + sel, new Set(hs).size === 1, hs.join(', '));
  });

  /* 6 · NO HORIZONTAL OVERFLOW, ever, at any width. */
  check('no horizontal overflow', document.documentElement.scrollWidth <= W,
    document.documentElement.scrollWidth + ' vs ' + W);

  /* 7 · HIERARCHY. A heading has to outrank body copy clearly enough to be found
     without reading. Broken at 1.53x, with the standfirst the same size. */
  var h2 = document.querySelector('.jp__prose h2, .prose h2');
  if (h2 && p) {
    var ratio = parseFloat(getComputedStyle(h2).fontSize) / parseFloat(getComputedStyle(p).fontSize);
    check('h2 ≥ 1.6x body', ratio >= 1.6, ratio.toFixed(2) + 'x');
  }

  /* 8 · THE ASK IS REACHABLE. A page that asks for nothing until 76% has already
     lost the reader who leaves at 40%. */
  /* The rule used to be "ask within the first 45%", on the reasoning that an
     eight-minute article should not make a reader wait. That reasoning was
     wrong for this site, and the owner overruled it: the mid-read ask and the
     end offer carried the same sentence and the same button, so the article
     asked twice and the first one arrived before the argument had earned it.
     The rail ask is gone and the offer now reveals itself on arrival.

     So the invariant is no longer about position — it is about existence. A
     long-form page that asks nowhere is the real fault, and it is the one this
     check can still catch. A page that asks once, late, on purpose, is a
     decision, and a guard that reports a decision as a failure is a guard
     people stop reading. */
  if (document.querySelector('.jp__prose')) {
    var asks = [...document.querySelectorAll('a[href*="contact"]')]
      .map(function (a) { return a.getBoundingClientRect().top + scrollY; })
      .filter(function (y) { return y > 200; });
    var where = asks.length
      ? Math.round(Math.min.apply(null, asks) / document.body.scrollHeight * 100) + '% down'
      : 'none in the body';
    check('long-form asks somewhere', asks.length > 0, where);
  }

  /* 9 · THE DECK'S TEXT CLEARS THE GRID.
     The Journal's lead accordion positions its text column against the deck, so
     the text adds no height to it. When the headline wraps — which it does at the
     narrow end of the accordion's range — the text runs past the bottom of the
     pictures, and past the deck itself, into the cards below. It was 78px into
     the grid when this was found, and nothing about the CSS said so.

     The reserve that fixes it is fitted to how long the three standfirsts are, so
     this is the check that catches the day somebody lengthens one. */
  var deck = document.querySelector('.jdeck');
  var jgrid = document.querySelector('.jgrid');
  if (deck && jgrid) {
    var bodies = [].slice.call(deck.querySelectorAll('.jfeat__body'));
    if (bodies.length) {
      var lowest = Math.max.apply(null, bodies.map(function (b) {
        return b.getBoundingClientRect().bottom;
      }));
      var clear = jgrid.getBoundingClientRect().top - lowest;
      check('deck text clears grid', clear >= 0, px(clear) + 'px');
    }
  }

  /* 10 · THE READING COLUMN REACHES BOTH MARGINS.
     A capped column has to be told which end of its track to sit on, and if it
     is not, the leftover lands outside the text as margin. That is how this page
     ended up with a 593px right margin at 2560 while every other block on it
     kept 88 — the article looked like it had lost its right-hand side, and no
     rule in the stylesheet said anything was wrong.

     Checked against the wrap's own padding rather than a number, so it holds at
     every width. */
  var wrap = document.querySelector('.jp');
  var reading = document.querySelector('.jp__prose');
  if (wrap && reading && W >= 1000) {
    var padR = parseFloat(getComputedStyle(wrap).paddingRight) || 0;
    var slack = (wrap.getBoundingClientRect().right - padR)
              - reading.getBoundingClientRect().right;
    check('prose reaches right margin', Math.abs(slack) <= 12, px(slack) + 'px short');

    /* 11 · AND FILLS ITS TRACK.
       The margin check alone was not enough. Pushing the column to the right of
       an oversized track fixed the margin and moved the same slack into the
       middle of the page — 247px of empty track between the rail and the first
       word at 2000, 505px at 2560. Two checks, because the space has two places
       to hide and closing one opens the other. A track sized to its text has
       nowhere to put it. */
    var track = reading.parentElement;
    var inset = reading.getBoundingClientRect().left - track.getBoundingClientRect().left;
    check('prose fills its track', inset <= 12, px(inset) + 'px of empty track');
  }

  /* 12 · THE BIG WORD IS NOT BEING CLIPPED.
     A row with `overflow: hidden` and a word set in vw will eventually cut the
     longest word off, and from the outside a clipped word and a word that just
     fits look the same — Implement overflowed its row by 99px at 1920 and the
     only visible symptom was a two-pixel gap where a 24px one was specified.
     scrollWidth is what tells the truth here. */
  var bigRows = document.querySelectorAll('.svcf__more');
  if (bigRows.length) {
    var worst = 0, at = '';
    [].forEach.call(bigRows, function (m) {
      var over = m.scrollWidth - m.clientWidth;
      if (over > worst) { worst = over; at = (m.textContent || '').trim().slice(0, 12); }
    });
    check('big word fits its row', worst <= 1, worst ? px(worst) + 'px clipped on ' + at : 'clear');
  }

  /* 13 · TEXT CAN BE SEEN AGAINST ITS OWN GROUND.
     Three times now this site has shipped text that was in the DOM, occupied
     real height, and was invisible: an offer fold set in ink on the ink ground,
     a figure moved from the dark fold onto the paper one, and a CTA note at
     rgba(21,24,27,.7) on rgb(21,24,27) — contrast exactly zero.

     Every one looked like missing content rather than a colour bug, and the
     first was diagnosed wrong twice because the PARENT reported the right
     colour. Only the element's own computed colour, against the nearest
     ancestor that actually paints a background, tells the truth.

     Alpha is composited against that ground before comparing, or a half
     transparent ink on paper reads as a failure when it is simply grey. */
  function lum(c) {
    var m = (c || '').match(/[\d.]+/g);
    if (!m) return null;
    return { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 };
  }
  /* Finding what a line of text actually sits on is the whole difficulty here,
     and three geometric rules failed before this one.

     Nearest opaque ANCESTOR misses backdrops: the homepage study fold is
     painted by `div.study__ground`, absolutely positioned at z-index -1 and not
     an ancestor of the label on it, so the walk returns paper and a legible
     chalk label is called invisible.

     Smallest covering opaque BOX is worse, because it looks right. The footer
     is a fixed dark panel at 0,0,1440,973 that `main` scrolls over — it covers
     every element on every page and is smaller in area than `main`. That rule
     reported all thirteen pages broken. Area is not paint order.

     Restricting the search to the ancestor's subtree fixed the false positives
     and then missed the real bug it was written for.

     So: stop guessing at paint order and ask the browser. elementsFromPoint
     does the actual hit test, topmost first, honouring z-index and stacking
     contexts — the first opaque background in that list is by definition what
     the reader sees behind the text.

     It runs on every line rather than on nominated suspects. A cheap ancestor
     walk was filtering first, and that filter was itself the fourth wrong
     answer: the CTA note's dark ground is a backdrop rather than an ancestor,
     so the walk saw ink on paper, called it healthy and never confirmed the one
     case the check was written for. A filter that can veto the answer is not a
     filter. Hit testing everything costs about 250ms a page, which is nothing
     for something that runs at a keyboard. */
  function paintedGround(el) {
    var keep = window.scrollY;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    var r = el.getBoundingClientRect();
    var x = Math.max(1, Math.min(innerWidth - 1, r.left + Math.min(6, r.width / 2)));
    var y = Math.max(1, Math.min(innerHeight - 1, r.top + r.height / 2));
    var stack = document.elementsFromPoint(x, y) || [];
    var found = null;

    /* BEHIND, NOT ABOVE — and that is a different question from ancestry.

       This filtered to ancestors, for a real reason: Napa's sticky nav carries
       an ink "Request an Audit" button, and once the folds went to two columns
       the page got short enough that scrollIntoView centred the hero h1 behind
       it. The sampler took the button's ink as the ground and called a
       near-black headline on off-white ink-on-ink.

       But "in front of the text" and "not an ancestor of it" are not the same
       set, and the difference is a whole fold: index.html's process section
       paints its ink from <div class="svcf__ground">, a z-index:-1 sibling
       under the text, not a background on any ancestor. Ancestors-only walked
       straight past it to main's chalk and reported chalk-on-chalk — twelve
       elements at a luminance gap of 0, every one of them 15.48:1 in fact. That
       false positive has been in every run of this check since the fold was
       built, which is exactly how a check trains people to ignore it.

       elementsFromPoint already answers the real question: it returns topmost
       first, so everything AFTER the text in that list is painted behind it.
       Start there. The nav button sits before the text and is skipped; the
       backdrop sits after it and is found.

       If the text is not in the stack at all, something opaque covers it — no
       reading is trustworthy, so fall back to the ancestor walk. */
    var from = stack.indexOf(el);
    if (from < 0) {
      for (var i = 0; i < stack.length && !found; i++) {
        if (!stack[i].contains(el)) continue;
        var c = lum(getComputedStyle(stack[i]).backgroundColor);
        if (c && c.a > .95) found = c;
      }
    } else {
      for (var j = from; j < stack.length && !found; j++) {
        var c2 = lum(getComputedStyle(stack[j]).backgroundColor);
        if (c2 && c2.a > .95) found = c2;
      }
    }
    window.scrollTo({ top: keep, behavior: 'instant' });
    return found;
  }
  function Y(c) { return .2126 * c.r + .7152 * c.g + .0722 * c.b; }
  function gap(fg, bg) {
    var mix = {                                            /* composite alpha */
      r: fg.r * fg.a + bg.r * (1 - fg.a),
      g: fg.g * fg.a + bg.g * (1 - fg.a),
      b: fg.b * fg.a + bg.b * (1 - fg.a)
    };
    return Math.abs(Y(mix) - Y(bg));
  }

  var faint = 0, faintOn = '';
  document.querySelectorAll('main p, main li, main h1, main h2, main h3, main summary, main figcaption, main a')
    .forEach(function (e) {
      if (!e.firstChild || e.querySelector('*')) return;          // leaf text only
      if (!(e.textContent || '').trim()) return;
      var r = e.getBoundingClientRect();
      /* 2px, not 0. The visually-hidden class this site uses for screen-reader
         headings clips to a 1x1 box rather than to nothing, so a zero test lets
         it through and it reports as paper text on the paper ground — which it
         is, deliberately. No real line of copy is two pixels tall. */
      if (r.width <= 2 || r.height <= 2) return;
      /* A paragraph inside a CLOSED <details> is not painted, but it still
         reports a layout box. scrollIntoView then centres a box nobody can
         see, and elementsFromPoint returns whatever IS painted there — the
         next section. On Napa that section is now an ink fold, so every
         closed FAQ answer was being tested as ink text on an ink ground it
         does not sit on. The old arrangement passed only because the section
         behind the phantom happened to be chalk. The summary stays testable:
         it is the part of a closed details that is actually on screen. */
      var det = e.closest('details');
      if (det && !det.open && e.tagName !== 'SUMMARY') return;
      var cs = getComputedStyle(e);
      if (cs.visibility === 'hidden') return;
      /* Effective opacity, not the element's own. A paragraph at opacity 1
         inside a wrapper at opacity 0 is not on screen, and testing its colour
         against a ground nobody can see reports a fault that does not exist. */
      var vis = 1;
      for (var p = e; p && p.nodeType === 1 && vis; p = p.parentElement) vis *= +getComputedStyle(p).opacity;
      if (!vis) return;
      var fg = lum(cs.color);
      if (!fg) return;
      var painted = paintedGround(e);
      if (!painted) return;
      var d = gap(fg, painted);
      if (d < 25 && (faintOn === '' || d < faint)) {
        faint = d; faintOn = (e.textContent || '').trim().slice(0, 26);
      }
    });
  check('text visible on its ground', faintOn === '',
    faintOn ? 'luminance gap ' + px(faint) + ' on "' + faintOn + '"' : 'clear');

  console.log('\n  ' + location.pathname + '  @' + W + 'px\n' + out.join('\n') +
    '\n\n  ' + (fail ? fail + ' FAILED' : 'all passed') + '\n');
  return fail;
})();
