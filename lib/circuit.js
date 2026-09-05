/* THE REPTIFY PROCESS CIRCUIT — portable.
   ----------------------------------------------------------------------------
   Drop-in for any Reptify page or microsite. Include lib/circuit.css and this
   file; no build step, no dependencies, no configuration object.

   The markup contract, and it is the whole contract:

     <div class="procf__grid">
       <svg class="circuit" aria-hidden="true"></svg>   <- left empty, written here
       <div class="proc__bull"> the mark </div>          <- where the current starts
       <ol class="chain">
         <li class="step">                               <- exactly four, clockwise
           <span class="step__n">01</span>
           <h3 class="step__name">…</h3>
           <p>…</p>
           <p class="step__gets"><span>What you get</span> …</p>
           <div class="step__meter" aria-hidden="true"><i><s></s></i><b></b></div>
         </li>
         … three more
       </ol>
     </div>

   Four cards, laid out as a 2x2 ring — top-left, top-right, bottom-right,
   bottom-left. That count and that arrangement are the design, not a limitation
   to be generalised away: the route is a closed loop back to the mark, which is
   the point being made. A page with a different number of steps wants a
   different device, not this one with a parameter.

   Everything else is derived at runtime from measured boxes, so it survives any
   viewport, any card height and any type scale. Below 1024px the square is gone
   and the whole thing switches itself off.

   Colours come from the host page's token block with fallbacks baked in here, so
   the module still runs on a page that has not defined them.

   House device — Reptify's own pages and microsites only. Never carried into a
   client build; a signature move that appears on two clients is a template.
   ----------------------------------------------------------------------------

   The process circuit.

   The current leaves the mark, enters Audit, splits and runs both ways around
   that card's edges, the two halves meet at the arrow out, and the next card
   does the same. Out of Optimize it returns to the mark.

   The paths are written here rather than in the markup because a perimeter route
   that must begin and end on two particular edges of a box needs the box's real
   measurements, and those change with the viewport. Each lit path is one white
   stroke with a coloured drop-shadow, moved by stroke-dashoffset through the Web
   Animations API — WAAPI because every path needs its own window inside one
   shared cycle, which is exactly the thing @keyframes cannot express without a
   separate rule per path. */
(function () {
  var grid = document.querySelector('.procf__grid');
  if (!grid || !grid.animate) return;
  var svg = grid.querySelector('.circuit');
  var steps = Array.prototype.slice.call(grid.querySelectorAll('.step'));
  var bull = grid.querySelector('.proc__bull');
  if (!svg || steps.length !== 4 || !bull) return;

  var NS = 'http://www.w3.org/2000/svg';

  /* The circuit runs on its own clock — it is a loop, and a loop that only moves
     when the page moves is a diagram, not a circuit. What the scroll controls is
     when it starts: it waits at frame zero and sets off from the bull the moment
     the fold is genuinely on screen, so the first thing anyone sees is the
     current reaching Audit. */
  var CYCLE = 14000;
  var DASH = 15;               /* the bright core of the light */
  var tok = getComputedStyle(document.documentElement);
  /* fallbacks so the module runs on a page that has not declared the site's
     token block — the animation interpolates colours, and an empty string is
     not a colour */
  var FALLBACK = {
    '--ink-lift': '#1C2024', '--ink-live': '#16222E', '--brand': '#018EFF',
    '--brand-18': 'rgba(1, 142, 255, .18)', '--chalk-14': 'rgba(240, 239, 234, .14)',
    '--chalk-40': 'rgba(240, 239, 234, .40)', '--spark': '#FFFFFF',
    '--ember': '#FF6600'
  };
  function T(n) { return tok.getPropertyValue(n).trim() || FALLBACK[n] || ''; }
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* every animation on the ring takes the same options, so none of them can end
     up on a different clock from the rest */
  function timing() {
    return { duration: CYCLE, iterations: Infinity, easing: 'linear' };
  }
  var WARM = false;            /* the second, warm pulse — off at the owner's request */

  /* Windows as fractions of the cycle: feed, then card / arrow / card …, then
     the return home. Laid out from four numbers rather than typed as a table —
     a typed table is four chances to put a card and its arrow in the wrong
     order, and every retiming meant editing eleven pairs by hand.

     GAP is the beat between the arrowhead and the card: the white light clears
     the head before the box wakes, instead of the two happening at once. */
  var FEED = .06, ARROW = .030, GAP = .012, HOME = .107;
  var WIN = (function () {
    var n = steps.length;
    /* whatever is left over, split evenly between the cards */
    var span = (1 - FEED - HOME - (n - 1) * ARROW - n * GAP) / n;
    var w = { feed: [0, FEED], card: [], arrow: [], home: [1 - HOME, .985] };
    var t = FEED;
    for (var i = 0; i < n; i++) {
      t += GAP;
      w.card.push([+t.toFixed(3), +(t + span).toFixed(3)]);
      t += span;
      if (i < n - 1) { w.arrow.push([+t.toFixed(3), +(t + ARROW).toFixed(3)]); t += ARROW; }
    }
    return w;
  })();

  /* half a pixel in, so a stroke centred on the path sits on the card's own 1px
     border rather than straddling its outer edge */
  function box(el) {
    var r = el.getBoundingClientRect(), g = grid.getBoundingClientRect();
    return { x: r.left - g.left + .5, y: r.top - g.top + .5, w: r.width - 1, h: r.height - 1 };
  }
  function d(pts) {
    return 'M' + pts.map(function (p) { return p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join('L');
  }
  function add(cls, path) {
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('class', cls);
    p.setAttribute('d', path);
    p.setAttribute('vector-effect', 'non-scaling-stroke');
    svg.appendChild(p);
    return p;
  }
  /* A solid head, not two crossed strokes. Two strokes meeting at a point double
     their weight where they overlap and leave a visible notch on the outside of
     the join — at 1px on a dark ground that reads as a smudge rather than an
     arrow. One filled triangle has a single edge, lands exactly on the card and
     keeps the line hairline all the way into it. */
  function head(x, y, dx, dy) {
    var L = 9, W = 4.6;                     /* length along the run, half-width across */
    var bx = x - dx * L, by = y - dy * L;   /* the base, back along the direction */
    var px = -dy, py = dx;                  /* perpendicular */
    var p = document.createElementNS(NS, 'path');
    p.setAttribute('class', 'head');
    p.setAttribute('d', d([[x, y],
                           [bx + px * W, by + py * W],
                           [bx - px * W, by - py * W]]) + 'Z');
    svg.appendChild(p);
  }

  /* one pulse: white core, coloured halo, travelling its own window */
  /* one element, two flashes a cycle: cold as the light arrives, warm half a
     cycle later. Both live in a single animation because two animations on one
     property would simply fight, and the later one would win all cycle. */
  function pulse(el, props, base, hot, win) {
    var wins = (WARM ? [win, [(win[0] + .5) % 1, (win[1] + .5) % 1]] : [win])
      .filter(function (w) { return w[1] > w[0]; })
      .sort(function (a, b) { return a[0] - b[0]; });
    var kf = [], at = function (o, v) {
      var f = {}; props.forEach(function (p, i) { f[p] = v[i]; }); f.offset = Math.max(0, Math.min(1, o));
      kf.push(f);
    };
    at(0, base);
    wins.forEach(function (w) {
      /* nothing lights before the light gets there: the charge begins on the
         window's first frame, not a beat ahead of it */
      at(w[0], base);
      at(w[0] + .012, hot);
      at(w[1] - .015, hot);
      /* the hand-off: the bar reads 100, the light sets off down the arrow, and
         this card only lets go across the next one's rise — the two overlap on
         purpose, which is what makes it a pass rather than a switch */
      at(w[1] + .020, hot);
      at(w[1] + .078, base);
    });
    at(1, base);
    el.animate(kf, timing());
  }

  /* One pulse, built the way the button's edge light is built: not a mark being
     dragged along a line but a bright core with the light falling off behind it.
     The button gets that from one conic gradient with soft stops; a stroke has
     no gradient along its own path, so the falloff is three dashes of the same
     colour — longer, dimmer, each a beat further back. */
  function light(pathD, win, warm) {
    trail(pathD, win, 78, .12, 2);
    trail(pathD, win, 40, .34, 2.4);
    var p = add('spark' + (warm ? ' spark--warm' : ''), pathD);
    var len = p.getTotalLength();
    p.style.strokeDasharray = DASH + ' ' + (len + DASH * 4);
    var PARK = DASH * 2;
    p.animate([
      { strokeDashoffset: PARK, offset: 0 },
      { strokeDashoffset: PARK, offset: win[0] },
      { strokeDashoffset: -(len + PARK), offset: win[1] },
      { strokeDashoffset: -(len + PARK), offset: 1 }
    ], timing());
  }

  /* A falloff layer, locked to the core rather than delayed behind it. A time
     lag is what made this look like two separate lights chasing each other: a
     second of delay on a 14s cycle is a whole second of travel. Instead the
     layers share a leading edge — for a dash of length L, that means shifting
     the offset by (L - DASH), which is pure geometry and cannot drift. */
  function trail(pathD, win, len, opacity, width) {
    var p = add('spark spark--tail', pathD);
    p.style.opacity = opacity;
    p.style.strokeWidth = width;
    var total = p.getTotalLength(), PARK = DASH * 2, shift = len - DASH;
    p.style.strokeDasharray = len + ' ' + (total + len * 4);
    p.animate([
      { strokeDashoffset: PARK + shift, offset: 0 },
      { strokeDashoffset: PARK + shift, offset: win[0] },
      { strokeDashoffset: -(total + PARK) + shift, offset: win[1] },
      { strokeDashoffset: -(total + PARK) + shift, offset: 1 }
    ], timing());
  }


  function build() {
    var live = anims()[0];
    var phase = live ? (live.currentTime || 0) % CYCLE : 0;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    /* build() re-runs whenever the geometry settles. Without this the card
       animations stack — nine copies of the same cycle fighting over one bar. */
    steps.forEach(function (st) {
      st.getAnimations().forEach(function (a) { a.cancel(); });
      st.querySelectorAll('*').forEach(function (n) {
        n.getAnimations().forEach(function (a) { a.cancel(); });
      });
    });
    var g = grid.getBoundingClientRect();
    /* stacked layout: the square is gone, so the wiring describes nothing */
    if (window.innerWidth < 1024) { svg.removeAttribute('viewBox'); return; }
    svg.setAttribute('viewBox', '0 0 ' + g.width + ' ' + g.height);

    var b = box(bull), c = steps.map(box);

    /* No lifting. The left column reads top to bottom the way the fold does:
       the label and its rule, then the mark under it, then the words under that.
       Every attempt to raise the mark to the label put it beside or over the
       words instead, which is worse than plain order. */

    /* One y per row and one x per column, shared by both cards in it. Measured
       separately they differ by a fraction — subpixel layout — and a connector
       drawn between two fractions is a connector that is not quite level. */
    var rowY = [ (c[0].y + c[0].h / 2 + c[1].y + c[1].h / 2) / 2,
                 (c[2].y + c[2].h / 2 + c[3].y + c[3].h / 2) / 2 ];
    var colX = [ (c[0].x + c[0].w / 2 + c[3].x + c[3].w / 2) / 2,
                 (c[1].x + c[1].w / 2 + c[2].x + c[2].w / 2) / 2 ];

    /* entry and exit points, all on edge midpoints */
    /* The current enters Audit at the mark's own height, not at the card's
       middle, so the feed runs dead straight out of the bull and into the box
       instead of stepping down to meet it. Clamped inside the corners so the
       entry never lands on one. */
    var bullY = Math.min(Math.max(b.y + b.h / 2, c[0].y + 26), c[0].y + c[0].h - 26);
    var e0 = [c[0].x, bullY],          x0 = [c[0].x + c[0].w, rowY[0]];
    var e1 = [c[1].x, rowY[0]],        x1 = [colX[1], c[1].y + c[1].h];
    var e2 = [colX[1], c[2].y],        x2 = [c[2].x, rowY[1]];
    var e3 = [c[3].x + c[3].w, rowY[1]], x3 = [colX[0], c[3].y + c[3].h];

    /* the feed: the mark straight into Audit, on the mark's own line */
    var feed = d([[b.x + b.w + 6, b.y + b.h / 2], e0]);
    add('wire', feed); head(e0[0], e0[1], 1, 0);
    light(feed, WIN.feed, false); if (WARM) light(feed, WIN.feed, true);

    steps.forEach(function (st, i) {
      /* the whole box takes the charge — blue ground, blue edge, a soft bloom
         off it — while the only thing that moves is the white light */
      pulse(st, ['backgroundColor', 'borderColor', 'boxShadow'],
            [T('--ink-lift'),  T('--chalk-14'), '0 0 0 0 ' + T('--brand-18')],
            [T('--ink-live'),  T('--brand'),    '0 0 44px 2px ' + T('--brand-18')],
            WIN.card[i]);
      var n = st.querySelector('.step__n');
      if (n) pulse(n, ['color'], [T('--chalk-14')], [T('--spark')], WIN.card[i]);

      /* The readout takes the ember, and only while it is counting. Everything
         else in the circuit is white light on a blue charge; giving the number
         the one warm colour in the palette separates measurement from current,
         which is the distinction the fold is actually making. It has to be
         earned though — four orange zeroes sitting on four dark cards would be
         four accents doing nothing, so it dims back to the same grey as
         everything idle. */
      var pn = st.querySelector('.step__meter b');
      if (pn) pulse(pn, ['color'], [T('--chalk-14')], [T('--ember')], WIN.card[i]);

      /* the transfer: the bar draws and the number counts while the current is on
         this card, holds at 100 until the light has moved on, then resets out of
         sight during the next card's turn */
      var w = WIN.card[i], bar = st.querySelector('.step__meter s'), num = st.querySelector('.step__meter b');
      var hold = Math.min(1, w[1] + .11);
      if (bar) bar.animate([
        { transform: 'scaleX(0)', offset: 0 },
        { transform: 'scaleX(0)', offset: w[0] },
        { transform: 'scaleX(1)', offset: w[1] },
        { transform: 'scaleX(1)', offset: hold },
        { transform: 'scaleX(0)', offset: Math.min(1, hold + .001) },
        { transform: 'scaleX(0)', offset: 1 }
      ], timing());
      if (num) num.animate([
        { '--p': 0, offset: 0 },
        { '--p': 0, offset: w[0] },
        { '--p': 100, offset: w[1] },
        { '--p': 100, offset: hold },
        { '--p': 0, offset: Math.min(1, hold + .001) },
        { '--p': 0, offset: 1 }
      ], timing());
    });

    /* the three arrows between the cards */
    var arrows = [ [x0, e1, 1, 0], [x1, e2, 0, 1], [x2, e3, -1, 0] ];
    arrows.forEach(function (a, i) {
      var ad = d([a[0], a[1]]);
      add('wire', ad); head(a[1][0], a[1][1], a[2], a[3]);
      light(ad, WIN.arrow[i], false); if (WARM) light(ad, WIN.arrow[i], true);
    });

    /* The way home, drawn the way it was marked up: out of the bottom of
       Optimize, down clear of the ring, left along a line under the whole block,
       then up the left column and into the base of the mark. It keeps well away
       from the feed, which runs straight out of the mark's other side. */
    /* It comes back up the outside of the left column and into the mark's flank,
       not up its middle — the words sit at the bottom of that column now, and a
       line up the centre would run straight through them. */
    var underY = Math.max(c[2].y + c[2].h, c[3].y + c[3].h) + 42;
    var lane = 10, bullMidY = b.y + b.h / 2;
    var home = d([x3, [x3[0], underY], [lane, underY], [lane, bullMidY], [b.x - 8, bullMidY]]);
    add('wire', home); head(b.x - 8, bullMidY, 1, 0);
    light(home, WIN.home, false); if (WARM) light(home, WIN.home, true);

    settle();
    apply(phase);
  }

  function anims() {
    var list = svg.getAnimations({ subtree: true });
    steps.forEach(function (st) { list = list.concat(st.getAnimations({ subtree: true })); });
    return list;
  }
  var onScreen = false;

  /* Phase survives a rebuild. This is the bug that made the arrows fire together:
     build() re-runs whenever the geometry settles — a font swapping in, the
     reveals landing, a resize — and it used to hand every new animation a
     currentTime of zero. Rebuild while someone is watching and the whole ring
     snaps back to the start at once, so an arrow that had just fired fires again
     alongside one that had not. The light appeared to be in several places
     because it was being restarted, not because the windows overlapped.

     So a rebuild resumes where the cycle was. Only a genuine arrival — the fold
     coming on screen after being off it — resets to zero, which is the one case
     where starting at the bull is the point. */
  function apply(from) {
    anims().forEach(function (a) {
      a.currentTime = from;
      if (onScreen) a.play(); else a.pause();
    });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      if (e[0].isIntersecting === onScreen) return;
      onScreen = e[0].isIntersecting;
      apply(0);
    }, { rootMargin: '-20% 0px -20% 0px', threshold: 0 }).observe(grid);
  } else {
    onScreen = true;
  }

  var t;
  function rebuild() {
    clearTimeout(t);
    t = setTimeout(function () { if (!reduce.matches) build(); }, 140);
  }

  if (!reduce.matches) build();
  window.addEventListener('resize', rebuild);
  window.addEventListener('load', rebuild);

  /* The viewBox is written from the grid's size at build time, so anything that
     changes that size afterwards — a font swapping in, the reveal transitions
     settling, an image arriving — rescales every coordinate and the light drifts
     off the edge it is supposed to ride. Watching the box itself is the only
     honest fix; window resize alone does not catch any of those. */
  if (window.ResizeObserver) new ResizeObserver(rebuild).observe(grid);

  /* A ResizeObserver sees the grid change size; it does not see the cards move
     inside it, which is what happens while the reveal transitions settle and a
     font swaps in. So after each build the geometry it was drawn from is checked
     against the live boxes for a second, and a single mismatch redraws. That is
     what was leaving an arrow sloped by four pixels between two cards that had
     long since lined up. */
  function signature() {
    return steps.concat([bull]).map(function (el) {
      var r = el.getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)].join();
    }).join('|');
  }
  var settleTimer;
  function settle() {
    clearInterval(settleTimer);
    var was = signature(), n = 0;
    settleTimer = setInterval(function () {
      if (++n > 12) return clearInterval(settleTimer);
      var now = signature();
      if (now !== was) { clearInterval(settleTimer); build(); }
    }, 90);
  }
})();
