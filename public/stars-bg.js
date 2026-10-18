(function() {
  const canvas = document.createElement('canvas');
  canvas.id = 'stars-bg';
  canvas.style.position = 'fixed';
  canvas.style.inset = '0';
  canvas.style.zIndex = '0';
  canvas.style.pointerEvents = 'none';
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let stars = [];
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    initStars();
  }
  function initStars() {
    stars = [];
    const n = Math.floor((canvas.width * canvas.height) / 6000);
    for (let i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.2 + 0.3,
        base: Math.random() * 0.4 + 0.1,
        glow: 0,
        speed: Math.random() * 0.005 + 0.001,
        phase: Math.random() * Math.PI * 2,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        hue: Math.random() < 0.5 ? '124,92,255' : '34,211,238',
      });
    }
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // deep-space gradient bg with subtle aurora
    const bg = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bg.addColorStop(0, '#06070f');
    bg.addColorStop(0.55, '#080a16');
    bg.addColorStop(1, '#0a0d1e');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const neb1 = ctx.createRadialGradient(canvas.width * 0.82, canvas.height * 0.12, 0, canvas.width * 0.82, canvas.height * 0.12, canvas.width * 0.5);
    neb1.addColorStop(0, 'rgba(124,92,255,0.1)');
    neb1.addColorStop(1, 'rgba(124,92,255,0)');
    ctx.fillStyle = neb1;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const neb2 = ctx.createRadialGradient(canvas.width * 0.12, canvas.height * 0.9, 0, canvas.width * 0.12, canvas.height * 0.9, canvas.width * 0.5);
    neb2.addColorStop(0, 'rgba(34,211,238,0.07)');
    neb2.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = neb2;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.x += s.vx;
      s.y += s.vy;
      if (s.x < 0) s.x = canvas.width;
      if (s.x > canvas.width) s.x = 0;
      if (s.y < 0) s.y = canvas.height;
      if (s.y > canvas.height) s.y = 0;
      s.phase += s.speed;
      const twinkle = (Math.sin(s.phase) + 1) / 2;
      const alpha = s.base + twinkle * 0.6;
      // random occasional glow burst
      if (Math.random() < 0.0003) s.glow = 1;
      s.glow *= 0.96;
      const a = Math.min(1, alpha + s.glow);
      const radius = s.r + s.glow * 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${a})`;
      ctx.fill();
      if (s.glow > 0.1) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, radius * 3, 0, Math.PI * 2);
        const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, radius * 3);
        g.addColorStop(0, `rgba(${s.hue},${s.glow * 0.6})`);
        g.addColorStop(1, `rgba(${s.hue},0)`);
        ctx.fillStyle = g;
        ctx.fill();
      }
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener('resize', resize);
  resize();
  draw();
})();
