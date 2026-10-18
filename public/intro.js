(function () {
  try { if (sessionStorage.getItem("introSeen")) return; sessionStorage.setItem("introSeen", "1"); } catch (e) {}
  const el = document.createElement("div");
  el.id = "intro";
  el.innerHTML = `
    <div class="intro-ring"></div>
    <div class="intro-ring r2"></div>
    <div class="intro-inner">
      <div class="intro-logo">🧩</div>
      <div class="intro-title">Dashboard Caio 2.0</div>
      <div class="intro-sub">Component Vault</div>
      <div class="intro-bar"><i></i></div>
    </div>`;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("gone"), 1500);
  setTimeout(() => el.remove(), 2400);
})();
