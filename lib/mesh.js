/* THE MESH WASH — portable.
   ----------------------------------------------------------------------------
   Drop-in for any Reptify page or microsite. Include lib/mesh.css and this
   file; no build step, no dependencies, no configuration object.

   The markup contract, and it is the whole contract:

     <div data-mesh>  … whatever the fold already contains …  </div>

   Ported from a React component built on @paper-design/shaders-react. The task
   it arrived with assumed a shadcn tree, Tailwind and TypeScript; this site has
   none of the three and no package.json to add them to, which is the product
   rather than an omission. So the shader is written out rather than installed.

   What changed from the original, and why at each point:

   1. IT IS LIGHT. The original is #000000 with violet and white churning
      through it and white type over the top. Here the ground stays the page's
      chalk and the type stays near-black, so the five colours are the site's
      own tints. Measured against the ink the fold already carries, the darkest
      of them reads 12.46:1 where the lede needs 4.5 — the palette is bounded by
      restraint, not by contrast.

   2. ONE DOMINANT COLOUR, NOT FIVE EQUAL ONES. See the note in mesh.css. An
      even blend of five near-neighbours is a flat average with no ground to
      return to.

   3. TWO SHADER PASSES BECOME ONE. The original stacks a solid MeshGradient and
      a second wireframe one at 60% over it. The wireframe pass exists to put
      structure back into a churn that is otherwise shapeless — this fold
      already has structure, a ray field and a kinetic grid drawn over the wash,
      so a second pass would be a third lattice competing with two that are
      already there. One pass, and the fold's own devices do that job.

   4. IT RENDERS SMALL AND IS SCALED UP. A mesh gradient is low-frequency by
      construction; there is nothing in it that needs a device pixel. The
      backing store is --mesh-res of CSS pixels, .55 by default, which is a
      third of the fill of a 1x canvas and indistinguishable at rest.

   5. IT IS DITHERED. A wash this flat and this light bands hard on an 8-bit
      display — broad, visible steps right across the widest part of the page.
      One LSB of hash noise per fragment costs nothing and removes all of them.

   6. IT STOPS. The original's animation loop runs forever. This one runs only
      while the fold is on screen, and not at all where there is no pointer or
      where reduced motion is asked for: those get one frame and no loop.

   7. TOKENS, FROM THE HOST. Five colours, a speed, a scale and a resolution
      factor, all ordinary inherited custom properties read off the host
      element, so two folds can carry different washes.

   House device — Reptify's own pages and microsites only. Never carried into a
   client build; a signature move that appears on two clients is a template.
   ---------------------------------------------------------------------------- */
(function mesh(host) {
  /* Named, and it calls itself once per host — same shape as kgrid.js, and for
     the same reason: querySelector is singular, and a second fold wanting a
     wash would otherwise take it away from the first with nothing in the diff
     to explain why. */
  if (host === undefined) {
    var all = document.querySelectorAll('[data-mesh]');
    for (var h = 0; h < all.length; h++) mesh(all[h]);
    return;
  }
  if (!window.requestAnimationFrame) return;

  var VERT =
    'attribute vec2 a;' +
    'void main(){ gl_Position = vec4(a, 0.0, 1.0); }';

  var FRAG = [
    /* highp is not guaranteed in a fragment shader on older mobile GPUs, and a
       shader that fails to compile there would leave the fold blank rather than
       chalk. Ask, and take mediump when the answer is no. */
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'uniform vec2  u_res;',
    'uniform float u_t;',
    'uniform float u_scale;',
    'uniform vec3  u_c[5];',

    'vec2 hash2(vec2 p){',
    '  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
    '  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;',
    '}',

    /* Gradient noise rather than value noise. Value noise is cheaper and it is
       visibly blocky at this scale — the wash is one enormous smooth field, so
       the artefact would be the only thing in it. */
    'float gnoise(vec2 p){',
    '  vec2 i = floor(p), f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(dot(hash2(i),                f),',
    '                 dot(hash2(i + vec2(1., 0.)), f - vec2(1., 0.)), u.x),',
    '             mix(dot(hash2(i + vec2(0., 1.)), f - vec2(0., 1.)),',
    '                 dot(hash2(i + vec2(1., 1.)), f - vec2(1., 1.)), u.x), u.y);',
    '}',

    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / u_res;',
    /* aspect-corrected, or the blobs are ovals on a wide fold */
    '  vec2 p  = vec2(uv.x * (u_res.x / u_res.y), uv.y) * u_scale;',

    /* One octave of domain warp. Two looked better in isolation and worse here:
       the second octave adds detail at a frequency the ray field already owns,
       so the two read as noise rather than as two things. */
    '  vec2 w = p + 0.62 * vec2(gnoise(p + vec2(0.0, u_t * 0.11)),',
    '                           gnoise(p + vec2(4.7, 2.3) + vec2(u_t * 0.09, 0.0)));',

    '  vec3 col = vec3(0.0);',
    '  float sum = 0.0;',
    '  for (int i = 0; i < 5; i++){',
    '    float fi = float(i);',
    '    float n = gnoise(w + vec2(fi * 11.3, fi * 6.7)',
    '              + 0.5 * vec2(cos(u_t * 0.13 + fi * 1.9), sin(u_t * 0.10 + fi * 2.7)));',
    /* THE POWER IS THE WHOLE EFFECT, and it was wrong at first. Gradient noise
       lands in roughly +/-0.7, so the raw weights sit in a narrow band; at a
       power of 2.6 with a floor of .015 every colour contributes meaningfully
       at every pixel and five near-neighbours summed at similar weights is
       their mean. Measured, that gave a span of 7 levels per channel and a mean
       chroma of 3.66 against palette colours carrying 35 to 72 — a flat wash
       with noise on it, which is exactly the failure written up in mesh.css.

       At 5.0 the ratio between the weakest and strongest contribution is about
       5800x, so a colour owns its region and the others drop out of it. The
       floor is what keeps the boundary between two regions soft rather than a
       hard edge; .0025 is low enough to stay out of the middle of a region and
       high enough that nothing ever divides by nothing.

       The 0.72 widens the noise into the full 0..1 before the curve, so the
       power is spending its range on the signal instead of on the dead band at
       either end. */
    '    float a = pow(clamp(n * 0.72 + 0.5, 0.0, 1.0), 5.0) + 0.0025;',
    '    if (i == 0) a *= 1.9;',
    '    col += u_c[i] * a;',
    '    sum += a;',
    '  }',
    '  col /= sum;',

    '  float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);',
    '  col += (d - 0.5) / 255.0;',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var canvas = document.createElement('canvas');
  canvas.className = 'mesh';
  canvas.setAttribute('aria-hidden', 'true');

  var gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false })
        || canvas.getContext('experimental-webgl', { alpha: true, antialias: false, depth: false, stencil: false });
  /* No WebGL means no wash, and the fold is chalk — which is what it was before
     this file existed. Nothing to fall back to and nothing to apologise for. */
  if (!gl) return;

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  var prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  /* One triangle, not two. It covers the clip volume on its own and skips the
     diagonal seam where two triangles meet, which a derivative-free shader
     would not show — but it is also one fewer vertex and one fewer draw. */
  var buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  var loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  var uRes = gl.getUniformLocation(prog, 'u_res');
  var uT = gl.getUniformLocation(prog, 'u_t');
  var uScale = gl.getUniformLocation(prog, 'u_scale');

  host.appendChild(canvas);

  /* Any CSS colour the author cares to write, parsed by the thing that already
     knows how: a 2d context normalises whatever it is handed and keeps its last
     good value when handed nonsense, so an unparseable token falls back to the
     ground rather than to black. */
  var probe = document.createElement('canvas').getContext('2d');
  function rgb(css, fallback) {
    probe.fillStyle = fallback;
    probe.fillStyle = css;
    var m = probe.fillStyle;
    if (m.charAt(0) === '#') {
      return [parseInt(m.substr(1, 2), 16) / 255,
              parseInt(m.substr(3, 2), 16) / 255,
              parseInt(m.substr(5, 2), 16) / 255];
    }
    var n = m.match(/[\d.]+/g) || [240, 239, 234];
    return [n[0] / 255, n[1] / 255, n[2] / 255];
  }

  var cs = getComputedStyle(host);
  var num = function (name, dflt) {
    var v = parseFloat(cs.getPropertyValue(name));
    return isNaN(v) ? dflt : v;
  };
  var speed = num('--mesh-speed', 0.06);
  var scale = num('--mesh-scale', 1.15);
  var res = Math.max(0.2, Math.min(num('--mesh-res', 0.55), 2));

  var flat = [];
  for (var i = 0; i < 5; i++) {
    var c = rgb((cs.getPropertyValue('--mesh-' + (i + 1)) || '').trim(), '#F0EFEA');
    flat.push(c[0], c[1], c[2]);
  }
  gl.uniform3fv(gl.getUniformLocation(prog, 'u_c'), new Float32Array(flat));
  gl.uniform1f(uScale, scale);

  var W = 0, H = 0, raf = 0, onScreen = true, t0 = 0;

  var still = !matchMedia('(hover: hover) and (pointer: fine)').matches ||
              matchMedia('(prefers-reduced-motion: reduce)').matches;

  function size() {
    var r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    var w = Math.max(1, Math.round(r.width * res));
    var h = Math.max(1, Math.round(r.height * res));
    if (w === W && h === H) return true;
    W = w; H = h;
    canvas.width = W; canvas.height = H;
    gl.viewport(0, 0, W, H);
    gl.uniform2f(uRes, W, H);
    return true;
  }

  function draw(now) {
    gl.uniform1f(uT, (now - t0) / 1000 * speed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    draw(now);
    raf = onScreen ? requestAnimationFrame(frame) : 0;
  }

  function run() {
    if (raf || still || !onScreen) return;
    raf = requestAnimationFrame(frame);
  }

  if (!size()) return;
  t0 = performance.now();
  draw(t0);                       /* the wash is there before anything moves */

  addEventListener('resize', function () {
    if (!size()) return;
    if (still) draw(performance.now()); else run();
  }, { passive: true });

  /* Same starting value and same reason as kgrid: IntersectionObserver delivery
     rides the rendering lifecycle, so a document that has not rendered yet
     would leave this inert with no way back if it started false. */
  if (window.IntersectionObserver) {
    new IntersectionObserver(function (es) {
      onScreen = es[0].isIntersecting;
      run();
    }, { rootMargin: '10%' }).observe(canvas);
  }
  run();
})();
