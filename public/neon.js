"use strict";

/* ============================================================
   NEON UI 2.0 — comportamento
   Fundo animado, perfil na sidebar, status online e swipe row
   ============================================================ */

(function () {
  function el(tag, cls, html) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (html != null) node.innerHTML = html;
    return node;
  }

  /* ---------- fundo neon ---------- */
  function addBackground() {
    if (document.querySelector(".neon-bg")) return;
    const bg = el("div", "neon-bg");
    bg.setAttribute("aria-hidden", "true");
    bg.innerHTML =
      '<div class="aurora"></div>' +
      '<div class="rays"></div>' +
      '<div class="grid-floor"></div>' +
      '<div class="flash"></div>';
    document.body.insertBefore(bg, document.body.firstChild);
  }

  /* ---------- status online no topbar ---------- */
  function addStatus() {
    const topbar = document.querySelector(".topbar");
    if (!topbar) return;
    let actions = topbar.querySelector(".topbar-actions");
    if (actions && actions.querySelector(".neon-status")) return;

    if (actions && actions.children.length > 2) return; // topbar cheio: nao aperta

    if (!actions) {
      actions = el("div", "topbar-actions");
      topbar.appendChild(actions);
    }
    const status = el("div", "neon-status", "<i></i> online");
    actions.insertBefore(status, actions.firstChild);
  }

  /* ---------- perfil compacto na sidebar ---------- */
  function addSideProfile() {
    const side = document.querySelector(".sidebar");
    if (!side || side.querySelector(".side-profile")) return;

    const card = el("div", "side-profile");
    card.innerHTML =
      '<div class="sp-top">' +
        '<div class="sp-avatar">C<span></span></div>' +
        '<div class="sp-id"><b>Caio Sobrinho</b><small>Nivel <span id="spLevel">1</span> · <span id="spXp">0</span> XP</small></div>' +
        '<button class="sp-logout" id="spLogout" title="Sair" aria-label="Sair">sair</button>' +
      "</div>" +
      '<div class="sp-bar"><i id="spFill" style="width:0%"></i></div>' +
      '<div class="sp-foot"><span class="pc-online"><i></i> online</span><span>🔥 <span id="spStreak">0</span>d</span></div>';

    const footer = side.querySelector(".sidebar-footer");
    if (footer) side.insertBefore(card, footer);
    else side.appendChild(card);

    const logout = card.querySelector("#spLogout");
    if (logout) {
      logout.addEventListener("click", async function () {
        try { await fetch("/api/logout", { method: "POST" }); } catch (e) {}
        window.location.href = "/login.html";
      });
    }
  }

  /* ---------- dados do perfil ---------- */
  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }
  function setWidth(id, pct) {
    const node = document.getElementById(id);
    if (node) node.style.width = Math.max(0, Math.min(100, pct)) + "%";
  }

  function applyProfile(p) {
    if (!p) return;
    const pct = p.xpNeeded ? (p.xpInLevel / p.xpNeeded) * 100 : 0;
    setText("pcLevel", p.level);
    setText("pcXp", p.xp);
    setText("pcStreak", p.streakDays);
    setWidth("pcFill", pct);
    setText("spLevel", p.level);
    setText("spXp", p.xp);
    setText("spStreak", p.streakDays);
    setWidth("spFill", pct);
  }
  window.DashNeonProfile = applyProfile;

  function hasProfileTargets() {
    return !!(
      document.getElementById("pcLevel") ||
      document.getElementById("spLevel") ||
      document.querySelector(".side-profile")
    );
  }

  async function loadProfile() {
    if (!hasProfileTargets()) return;
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      applyProfile(await res.json());
    } catch (e) {}
  }

  /* ---------- swipe row nas tarefas ---------- */
  function wrapRows(list) {
    const rows = list.querySelectorAll(".task-row");
    rows.forEach(function (row) {
      if (row.parentElement && row.parentElement.classList.contains("swipe-shell")) return;

      const shell = el("div", "swipe-shell");
      shell.innerHTML =
        '<div class="swipe-action left">✓ <span>concluir</span></div>' +
        '<div class="swipe-action right"><span>excluir</span> ✕</div>';
      row.parentNode.insertBefore(shell, row);
      shell.appendChild(row);

      enableDrag(row);
    });
  }

  function enableDrag(row) {
    let startX = 0;
    let startY = 0;
    let dx = 0;
    let active = false;
    let dragging = false;
    let pointerId = null;

    row.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (e.target.closest("button")) return;
      startX = e.clientX;
      startY = e.clientY;
      dx = 0;
      active = true;
      dragging = false;
      pointerId = e.pointerId;
    });

    row.addEventListener("pointermove", function (e) {
      if (!active || e.pointerId !== pointerId) return;

      const mx = e.clientX - startX;
      const my = e.clientY - startY;

      if (!dragging) {
        if (Math.abs(my) > Math.abs(mx)) {
          active = false;
          return;
        }
        if (Math.abs(mx) < 8) return;
        dragging = true;
        try { row.setPointerCapture(pointerId); } catch (err) {}
      }

      dx = Math.max(-120, Math.min(120, mx));
      row.style.transition = "none";
      row.style.transform = "translateX(" + dx + "px)";
    });

    function end() {
      if (!active) return;
      active = false;
      row.style.transition = "transform .24s cubic-bezier(.22,1,.36,1)";
      row.style.transform = "translateX(0)";

      if (dragging && dx > 72) {
        const check = row.querySelector(".task-check");
        if (check) check.click();
      } else if (dragging && dx < -72) {
        const del = row.querySelector(".task-del") || row.querySelector('[data-act="delete"]');
        if (del) del.click();
      }

      dx = 0;
      dragging = false;
      pointerId = null;
    }

    row.addEventListener("pointerup", end);
    row.addEventListener("pointercancel", end);
  }

  function initSwipe() {
    const list = document.getElementById("taskList");
    if (!list) return;

    wrapRows(list);
    const observer = new MutationObserver(function () {
      wrapRows(list);
    });
    observer.observe(list, { childList: true });
  }

  /* ---------- card nav: spotlight seguindo o mouse ---------- */
  function initCardNav() {
    document.querySelectorAll(".cn-item").forEach(function (card) {
      card.addEventListener("mousemove", function (e) {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", e.clientX - r.left + "px");
        card.style.setProperty("--my", e.clientY - r.top + "px");
      });
    });
  }

  function boot() {
    addBackground();
    addStatus();
    addSideProfile();
    loadProfile();
    initSwipe();
    initCardNav();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
