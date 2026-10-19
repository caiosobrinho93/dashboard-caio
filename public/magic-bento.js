/* ============================================================
   Magic Bento — efeito vanilla adaptado do React Bits
   (https://reactbits.dev/components/magic-bento)
   Spotlight + borda luminosa + tilt + partículas + onda.
   ============================================================ */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var finePointer = window.matchMedia ? window.matchMedia("(pointer: fine)").matches : true;
  var hoverCapable = window.matchMedia ? window.matchMedia("(hover: hover)").matches : true;

  // Aurora: violeta, ciano, rosa e ambar
  var GLOWS = ["124, 92, 255", "34, 211, 238", "244, 114, 182", "251, 191, 36"];
  var TILT = 5; // graus (max)

  function make(tag, cls) {
    var el = document.createElement(tag);
    el.className = cls;
    el.setAttribute("aria-hidden", "true");
    return el;
  }

  function setup(card, index, opts) {
    if (card.dataset.mbReady) return;
    card.dataset.mbReady = "1";
    card.classList.add("mb-card");
    if (opts.tilt && hoverCapable) card.classList.add("mb-tilt");

    var glow = opts.glow || (opts.colorful ? GLOWS[index % GLOWS.length] : "124, 92, 255");
    card.style.setProperty("--mb-glow-rgb", glow);

    // camadas
    var light = make("span", "mb-light");
    var rim = make("span", "mb-rim");
    var border = make("span", "mb-border");
    card.insertBefore(light, card.firstChild);
    card.appendChild(rim);
    card.appendChild(border);

    // partículas (canvas)
    var canvas = null;
    var ctx = null;
    var particles = [];
    var raf = 0;
    var last = 0;
    var hot = false;
    var w = 0;
    var h = 0;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);

    if (opts.particles && finePointer && !reduceMotion) {
      canvas = make("canvas", "mb-stars");
      card.appendChild(canvas);
      ctx = canvas.getContext("2d");
    }

    function seed() {
      var n = opts.starCount || 16;
      particles = [];
      for (var i = 0; i < n; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 7,
          vy: -5 - Math.random() * 11,
          r: 0.6 + Math.random() * 1.5,
          phase: Math.random() * Math.PI * 2,
          rate: 0.0012 + Math.random() * 0.0018,
        });
      }
    }

    function sizeCanvas() {
      if (!canvas) return;
      var rect = card.getBoundingClientRect();
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!particles.length) seed();
    }

    function draw(now) {
      raf = 0;
      if (!ctx) return;
      var dt = Math.min(48, now - (last || now)) / 1000;
      last = now;
      ctx.clearRect(0, 0, w, h);

      var mx = parseFloat(card.style.getPropertyValue("--mb-x"));
      var my = parseFloat(card.style.getPropertyValue("--mb-y"));
      if (isNaN(mx)) mx = -999;
      if (isNaN(my)) my = -999;

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y < -6) {
          p.y = h + 6;
          p.x = Math.random() * w;
        }
        if (p.x < -6) p.x = w + 6;
        if (p.x > w + 6) p.x = -6;

        var dist = Math.sqrt((p.x - mx) * (p.x - mx) + (p.y - my) * (p.y - my));
        var near = Math.max(0, 1 - dist / 170);
        var twinkle = 0.45 + 0.55 * Math.abs(Math.sin(now * p.rate + p.phase));
        var alpha = (0.1 + near * 0.8) * twinkle;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + near * 0.9, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(" + glow + ", " + alpha.toFixed(3) + ")";
        ctx.fill();
      }

      if (hot) raf = requestAnimationFrame(draw);
    }

    function startStars() {
      if (!ctx) return;
      sizeCanvas();
      last = 0;
      if (!raf) raf = requestAnimationFrame(draw);
    }

    function stopStars() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (ctx) ctx.clearRect(0, 0, w, h);
    }

    function onMove(e) {
      var rect = card.getBoundingClientRect();
      var x = e.clientX - rect.left;
      var y = e.clientY - rect.top;
      card.style.setProperty("--mb-x", x.toFixed(1) + "px");
      card.style.setProperty("--mb-y", y.toFixed(1) + "px");

      if (opts.tilt && finePointer && !reduceMotion) {
        var u = Math.min(1, Math.max(0, x / Math.max(1, rect.width))) - 0.5;
        var v = Math.min(1, Math.max(0, y / Math.max(1, rect.height))) - 0.5;
        card.style.setProperty("--mb-rx", (-v * 2 * TILT).toFixed(2) + "deg");
        card.style.setProperty("--mb-ry", (u * 2 * TILT).toFixed(2) + "deg");
      }
    }

    function onEnter() {
      hot = true;
      card.classList.add("mb-hover");
      card.style.setProperty("--mb-hot", "1");
      card.style.setProperty("--mb-near", "1");
      startStars();
    }

    function onLeave() {
      hot = false;
      card.classList.remove("mb-hover");
      card.style.setProperty("--mb-hot", "0");
      card.style.setProperty("--mb-near", "0");
      card.style.setProperty("--mb-rx", "0deg");
      card.style.setProperty("--mb-ry", "0deg");
      card.style.setProperty("--mb-press", "1");
      stopStars();
    }

    function onDown() {
      card.style.setProperty("--mb-press", "0.985");
    }

    function onUp() {
      card.style.setProperty("--mb-press", "1");
    }

    function onClick(e) {
      if (reduceMotion) return;
      var rect = card.getBoundingClientRect();
      var wave = make("span", "mb-wave");
      wave.style.left = e.clientX - rect.left + "px";
      wave.style.top = e.clientY - rect.top + "px";
      card.appendChild(wave);
      setTimeout(function () {
        if (wave.parentNode) wave.parentNode.removeChild(wave);
      }, 720);
    }

    if (hoverCapable) {
      card.addEventListener("pointerenter", onEnter);
      card.addEventListener("pointerleave", onLeave);
      card.addEventListener("pointermove", onMove, { passive: true });
      card.addEventListener("pointerdown", onDown);
      card.addEventListener("pointerup", onUp);
      card.addEventListener("pointercancel", onUp);
    }
    card.addEventListener("click", onClick);

    if (canvas) {
      window.addEventListener(
        "resize",
        function () {
          if (hot) sizeCanvas();
        },
        { passive: true }
      );
    }
  }

  function init(root, opts) {
    var nodes = (root || document).querySelectorAll(opts.selector);
    for (var i = 0; i < nodes.length; i++) setup(nodes[i], i, opts);
  }

  function boot() {
    // cards de estatísticas da home: efeito completo
    init(document, { selector: ".stats .stat", tilt: true, particles: true, colorful: true });

    // cards de componentes: spotlight + borda (sem tilt, para o preview ficar nítido)
    var gridOpts = { selector: "#grid .card", tilt: false, particles: false, glow: "124, 92, 255" };
    init(document, gridOpts);

    // a grade de componentes é redesenhada a cada filtro/paginação
    var grid = document.getElementById("grid");
    if (grid && window.MutationObserver) {
      var mo = new MutationObserver(function () {
        init(grid, gridOpts);
      });
      mo.observe(grid, { childList: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
