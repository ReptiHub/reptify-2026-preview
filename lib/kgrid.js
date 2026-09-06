/* THE KINETIC GRID — portable.
   ----------------------------------------------------------------------------
   Drop-in for any Reptify page or microsite. Include lib/kgrid.css and this
   file; no build step, no dependencies, no configuration object.

   The markup contract, and it is the whole contract:

     <div data-kgrid>  … whatever the fold already contains …  </div>

   That is it. The canvas is created here rather than written into the page,
   because it is decorative and does nothing without script: an empty <canvas>
   in the HTML is weight for a reader who will never see it drawn.

   A grid of lines and nodes that bends toward the pointer and rings out from a
   click. Ported from a React/Tailwind component; the canvas maths is faithful
   to it and everything around the maths is not, for reasons written at each
   change:

   1. TRANSPARENT. The original paints an opaque #000 or #161618 over the whole
      canvas every frame. Here it clears instead, so the fold keeps the two
      layers it already had — a treated sky and a vignette — and the grid is a
      third thing drawn over them rather than a replacement for them.

   2. SIZED TO THE FOLD, NOT THE WINDOW. The original is fixed inset-0 at
      window.innerWidth/innerHeight, which is a full-page background. This one
      is absolute inside its host and measures the canvas's own box, so it is
      correct in both of .cta's states — 100svh below the pin gate and a 100vh
      sticky pin above it — without knowing which one it is in.

   3. DEVICE PIXELS. The original draws at 1x, which is soft on every phone and
      most laptops. Backing store is scaled by devicePixelRatio, capped at 2:
      past that the cost is real and the gain is not.

   4. POINTER, NOT MOUSE, and only where there is one. Gated on
      (hover: hover) and (pointer: fine). On a touch screen there is no cursor
      to bend toward, so the whole device is a battery bill for a still image;
      those readers get one resting frame and no loop.

   5. IT STOPS. The original's requestAnimationFrame chain never ends — it
      redraws an identical frame sixty times a second forever. This one runs
      only while the fold is on screen, and inside that only while something is
      actually changing: the pointer still converging, or a ripple still alive.
      Everything settled means the loop parks until the next event.

   6. RIPPLES IGNORE THE BUTTON. The original binds click to window, so pressing
      the fold's call to action fires a ripple under it. Clicks on a link or a
      button are skipped.

   7. ONE COLOUR, FROM THE HOST. --kgrid-ink in kgrid.css, read once at start.

   prefers-reduced-motion draws the resting grid once and binds nothing.

   House device — Reptify's own pages and microsites only. Never carried into a
   client build; a signature move that appears on two clients is a template.
   ---------------------------------------------------------------------------- */
(function () {
  var host = document.querySelector('[data-kgrid]');
  if (!host || !window.requestAnimationFrame) return;

  var CELL = 55;            /* target grid pitch; the real one divides evenly  */
  var REACH = 260;          /* how far the pointer's pull is felt              */
  var MAX_WARP = 24;        /* deepest displacement at the centre of that pull */
  var DOT = 28;             /* the still texture behind the grid               */
  var EASE = 0.08;          /* pointer follow, per frame                       */
  var WAVE = 55;            /* width of a ripple's displacement band           */
  var R_BASE = 1.8, R_ACTIVE = 3.2;
  var A_LINE = 0.13, A_LINE_HOT = 0.9;
  var A_NODE = 0.20, A_NODE_HOT = 1.0;

  var ink = (getComputedStyle(document.documentElement)
              .getPropertyValue('--kgrid-ink') || '255,255,255').trim();

  var canvas = document.createElement('canvas');
  canvas.className = 'kgrid';
  canvas.setAttribute('aria-hidden', 'true');
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  host.appendChild(canvas);

  var W = 0, H = 0, dpr = 1;
  var mx = -9999, my = -9999;          /* where the pull is now                */
  var tx = -9999, ty = -9999;          /* where the pointer put it             */
  var ripples = [];
  /* true to start, and the observer only ever corrects it. Starting false makes
     the whole module depend on IntersectionObserver having fired before anything
     can happen — and IO delivery rides the rendering lifecycle, so a document
     that has not rendered yet leaves the grid inert with no way back. Observing
     fires a callback immediately, long before a pointer could be over the fold,
     so nothing runs that should not. */
  var raf = 0, onScreen = true;

  var still = !matchMedia('(hover: hover) and (pointer: fine)').matches ||
              matchMedia('(prefers-reduced-motion: reduce)').matches;

  function lerp(a, b, t) { return a + (b - a) * t; }
  function line(t) { return 'rgba(' + ink + ',' + lerp(A_LINE, A_LINE_HOT, t).toFixed(3) + ')'; }
  function node(t) { return 'rgba(' + ink + ',' + lerp(A_NODE, A_NODE_HOT, t).toFixed(3) + ')'; }

  function size() {
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = r.width; H = r.height;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  /* Where one grid intersection ends up, and how lit it is.

     The edge pin is the load-bearing part: without it the boundary row and
     column bend inward and the grid visibly detaches from the fold's edges.
     Squaring each factor makes the release quadratic, so the second row in is
     already almost free while the first barely moves. */
  var pt = { x: 0, y: 0, p: 0 };
  function warp(gx, gy, col, row, cols, rows) {
    var m = 1.5;
    var cp = Math.min(col / m, (cols - 1 - col) / m, 1);
    var rp = Math.min(row / m, (rows - 1 - row) / m, 1);
    var pin = cp * cp * rp * rp;

    var dx = gx - mx, dy = gy - my;
    var d = Math.sqrt(dx * dx + dy * dy);
    var rx = 0, ry = 0;

    for (var i = 0; i < ripples.length; i++) {
      var r = ripples[i];
      var ex = gx - r.x, ey = gy - r.y;
      var ed = Math.sqrt(ex * ex + ey * ey) - r.radius;
      if (Math.abs(ed) < WAVE) {
        var s = (1 - Math.abs(ed) / WAVE) * r.opacity * 18 * pin * (ed < 0 ? 1 : -1);
        var a = Math.atan2(ey, ex);
        rx += Math.cos(a) * s;
        ry += Math.sin(a) * s;
      }
    }

    pt.p = Math.max(0, 1 - d / REACH) * pin;

    if (d < REACH && d > 0 && pin > 0) {
      var t = d / REACH;
      /* the inner Math.min flattens the very centre: without it every node
         within 60px collapses onto the cursor and the grid tears */
      var amt = (t < 0.01 ? 0 : (1 - t) * (1 - t) * Math.min(1, d / 60)) * MAX_WARP * pin;
      var ang = Math.atan2(dy, dx);
      pt.x = gx - Math.cos(ang) * amt + rx;
      pt.y = gy - Math.sin(ang) * amt + ry;
    } else {
      pt.x = gx + rx;
      pt.y = gy + ry;
    }
    return pt;
  }

  var px = [], py = [], pp = [];       /* hoisted: one allocation, not one per frame */

  function draw(now) {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(' + ink + ',0.05)';
    for (var x = DOT / 2; x < W; x += DOT) {
      for (var y = DOT / 2; y < H; y += DOT) {
        ctx.beginPath();
        ctx.arc(x, y, 0.7, 0, 6.283185);
        ctx.fill();
      }
    }

    for (var i = ripples.length - 1; i >= 0; i--) {
      var age = (now - ripples[i].born) / 1000;
      ripples[i].radius = Math.max(0, age * 400);
      ripples[i].opacity = Math.max(0, 1 - age * 1.2);
      if (ripples[i].opacity <= 0) ripples.splice(i, 1);
    }

    var cols = Math.max(2, Math.ceil(W / CELL)) + 1;
    var rows = Math.max(2, Math.ceil(H / CELL)) + 1;
    var cw = W / (cols - 1), ch = H / (rows - 1);
    var row, col, k;

    for (row = 0; row < rows; row++) {
      for (col = 0; col < cols; col++) {
        k = row * cols + col;
        var p = warp(col * cw, row * ch, col, row, cols, rows);
        px[k] = p.x; py[k] = p.y; pp[k] = p.p;
      }
    }

    /* smoothstep on the average of a segment's two ends, so a line lights as a
       line rather than as two half-lit halves meeting in the middle */
    function seg(a, b) {
      var v = (pp[a] + pp[b]) / 2, t = v * v * (3 - 2 * v);
      ctx.beginPath();
      ctx.moveTo(px[a], py[a]);
      ctx.lineTo(px[b], py[b]);
      ctx.strokeStyle = line(t);
      ctx.lineWidth = lerp(0.8, 1.5, t);
      ctx.stroke();
    }

    ctx.lineCap = 'butt';
    for (row = 0; row < rows; row++)
      for (col = 0; col < cols - 1; col++) seg(row * cols + col, row * cols + col + 1);
    for (col = 0; col < cols; col++)
      for (row = 0; row < rows - 1; row++) seg(row * cols + col, (row + 1) * cols + col);

    for (row = 0; row < rows; row++) {
      for (col = 0; col < cols; col++) {
        k = row * cols + col;
        var v = pp[k], t = v * v * (3 - 2 * v);
        var rad = lerp(R_BASE, R_ACTIVE, t);

        if (t > 0.3) {
          var gr = rad + lerp(0, 6, (t - 0.3) / 0.7);
          var g = ctx.createRadialGradient(px[k], py[k], rad * 0.5, px[k], py[k], gr);
          g.addColorStop(0, 'rgba(' + ink + ',' + (t * 0.3).toFixed(3) + ')');
          g.addColorStop(1, 'rgba(' + ink + ',0)');
          ctx.beginPath();
          ctx.arc(px[k], py[k], gr, 0, 6.283185);
          ctx.fillStyle = g;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(px[k], py[k], rad, 0, 6.283185);
        ctx.fillStyle = node(t);
        ctx.fill();
      }
    }

    for (i = 0; i < ripples.length; i++) {
      ctx.beginPath();
      ctx.arc(ripples[i].x, ripples[i].y, Math.max(0, ripples[i].radius), 0, 6.283185);
      ctx.strokeStyle = 'rgba(' + ink + ',' + (ripples[i].opacity * 0.28).toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  /* Runs only while something is moving. Converged pointer and no live ripple
     means the next frame would be identical to this one, so the loop parks and
     the next pointer event starts it again. */
  function frame(now) {
    mx = lerp(mx, tx, EASE);
    my = lerp(my, ty, EASE);
    draw(now);
    if (!onScreen ||
        (ripples.length === 0 && Math.abs(mx - tx) < 0.5 && Math.abs(my - ty) < 0.5)) {
      raf = 0;
      return;
    }
    raf = requestAnimationFrame(frame);
  }

  function run() {
    if (raf || still || !onScreen) return;
    raf = requestAnimationFrame(frame);
  }

  if (!size()) return;
  draw(performance.now());        /* the resting grid is there before anything moves */

  /* On the document, not on the host. The host is .cta__pin, which is
     display:contents below its gate and so generates no box of its own —
     pointerleave in particular has nothing to fire on. Everything is gated on
     onScreen anyway, and this fold is a full viewport tall, so by the time it
     is on screen the pointer is over it. */
  if (!still) {
    document.addEventListener('pointermove', function (e) {
      if (!onScreen) return;
      var r = canvas.getBoundingClientRect();
      tx = e.clientX - r.left;
      ty = e.clientY - r.top;
      run();
    }, { passive: true });

    document.addEventListener('click', function (e) {
      if (!onScreen) return;
      /* .closest guarded, not assumed: a click can be retargeted to the document
         itself, which has no such method, and an exception here would kill the
         handler silently for the rest of the page's life. */
      if (e.target && e.target.closest &&
          e.target.closest('a, button, input, label, summary')) return;
      var r = canvas.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      if (x < 0 || y < 0 || x > r.width || y > r.height) return;
      ripples.push({ x: x, y: y, radius: 0, opacity: 1, born: performance.now() });
      run();
    });
  }

  addEventListener('resize', function () {
    if (!size()) return;
    if (still) draw(performance.now()); else run();
  }, { passive: true });

  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      onScreen = es[0].isIntersecting;
      /* snapped home rather than eased, because easing it out would be a
         hundred frames of drawing something nobody is looking at */
      if (!onScreen) { tx = ty = mx = my = -9999; }
      run();
    }, { rootMargin: '10%' }).observe(canvas);
  }
})();
