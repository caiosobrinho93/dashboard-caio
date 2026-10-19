"use strict";
const $ = (id) => document.getElementById(id);

async function api(path, opts) {
  const res = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.statusText);
  return res.json();
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
const todayStr = () => new Date().toISOString().slice(0, 10);

/* ================= Profile / XP ================= */
function renderProfile(p) {
  if (!p) return;
  $("xpLevel").textContent = p.level;
  $("xpText").textContent = `${p.xpInLevel} / ${p.xpNeeded} XP`;
  $("xpTotal").textContent = `${p.xp} XP total`;
  $("xpFill").style.width = Math.min(100, (p.xpInLevel / p.xpNeeded) * 100) + "%";
  $("xpStreak").textContent = p.streakDays;
  if (window.DashNeonProfile) window.DashNeonProfile(p);
  $("xpAch").innerHTML = p.achievements
    .map((a) => `<span class="ach ${a.unlockedAt ? "" : "locked"}" title="${esc(a.name)} — ${esc(a.desc)}">${a.icon}</span>`)
    .join("");
}
async function refreshProfile() {
  try { renderProfile(await api("/api/profile")); } catch (e) {}
}
async function ping() {
  try {
    const r = await api("/api/ping", { method: "POST" });
    renderProfile(r);
    DashToast({ unlocked: r.unlockedNow });
  } catch (e) {}
}
function handleAward(award) {
  if (award && award.unlocked) DashToast({ unlocked: award.unlocked });
  refreshProfile();
}

/* ================= Relogio + clima ================= */
const WMO = {
  0: ["☀️", "Ceu limpo"], 1: ["🌤️", "Quase limpo"], 2: ["⛅", "Parcialmente nublado"], 3: ["☁️", "Nublado"],
  45: ["🌫️", "Nevoeiro"], 48: ["🌫️", "Nevoeiro"], 51: ["🌦️", "Garoa"], 53: ["🌦️", "Garoa"], 55: ["🌦️", "Garoa forte"],
  61: ["🌧️", "Chuva fraca"], 63: ["🌧️", "Chuva"], 65: ["🌧️", "Chuva forte"], 71: ["🌨️", "Neve fraca"], 73: ["🌨️", "Neve"], 75: ["🌨️", "Neve forte"],
  80: ["🌦️", "Pancadas"], 81: ["🌧️", "Pancadas"], 82: ["⛈️", "Pancadas fortes"],
  95: ["⛈️", "Tempestade"], 96: ["⛈️", "Tempestade"], 99: ["⛈️", "Tempestade forte"],
};
function tickClock() {
  const d = new Date();
  $("wTime").textContent = d.toLocaleTimeString("pt-BR");
  $("wDate").textContent = d.toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}
async function loadWeather() {
  try {
    let lat = -23.55, lon = -46.63, city = "Sao Paulo";
    const pos = await new Promise((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition((p) => res(p), () => res(null), { timeout: 4000, maximumAge: 600000 });
    });
    if (pos) { lat = pos.coords.latitude; lon = pos.coords.longitude; city = "Sua regiao"; }
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=auto`).then((x) => x.json());
    const [ico, cond] = WMO[r.current.weather_code] || ["🌡️", "Clima"];
    $("wWeather").innerHTML = `<div class="ico">${ico}</div><div class="temp">${Math.round(r.current.temperature_2m)}°C</div><div class="cond">${cond} · ${city}</div>`;
  } catch (e) {
    $("wWeather").innerHTML = '<div class="cond">Clima indisponivel offline</div>';
  }
}

/* ================= Pomodoro ================= */
const pomo = {
  mode: "work", running: false, remaining: 25 * 60, timer: null,
  sessions: (() => {
    try { const s = JSON.parse(localStorage.getItem("pomoSessions") || "{}"); return s.date === todayStr() ? s.count || 0 : 0; } catch (e) { return 0; }
  })(),
};
const POMO_LEN = { work: 25 * 60, break: 5 * 60 };
function pomoRender() {
  const m = Math.floor(pomo.remaining / 60).toString().padStart(2, "0");
  const s = (pomo.remaining % 60).toString().padStart(2, "0");
  $("pomoTime").textContent = `${m}:${s}`;
  $("pomoPhase").textContent = pomo.mode === "work" ? "Foco · 25 min" : "Pausa · 5 min";
  $("pomoPhase").className = "pomo-phase " + (pomo.mode === "work" ? "work" : "break");
  $("pomoStart").textContent = pomo.running ? "⏸ Pausar" : "▶ Iniciar";
  const dots = $("pomoDots").children;
  for (let i = 0; i < dots.length; i++) dots[i].className = i < (pomo.sessions % 4 === 0 && pomo.sessions > 0 ? 4 : pomo.sessions % 4) ? "on" : "";
}
function pomoSwitch(next) {
  pomo.mode = next;
  pomo.remaining = POMO_LEN[next];
  pomo.running = false;
  clearInterval(pomo.timer);
  pomoRender();
}
async function pomoFinish() {
  clearInterval(pomo.timer);
  if (pomo.mode === "work") {
    pomo.sessions++;
    try { localStorage.setItem("pomoSessions", JSON.stringify({ date: todayStr(), count: pomo.sessions })); } catch (e) {}
    DashNotify("Pomodoro concluido! 🍅", "Muito bem! Hora de uma pausa de 5 minutos.");
    try { const r = await api("/api/pomodoro/complete", { method: "POST" }); handleAward(r.award); } catch (e) {}
    pomoSwitch("break");
  } else {
    DashNotify("Pausa acabou ⚡", "De volta ao foco! Novo pomodoro de 25 minutos.");
    pomoSwitch("work");
  }
}
function initPomodoro() {
  const dots = $("pomoDots");
  for (let i = 0; i < 4; i++) dots.appendChild(document.createElement("i"));
  $("pomoStart").addEventListener("click", () => {
    DashAskNotify();
    if (pomo.running) {
      clearInterval(pomo.timer);
      pomo.running = false;
    } else {
      pomo.running = true;
      pomo.timer = setInterval(() => {
        pomo.remaining--;
        if (pomo.remaining <= 0) pomoFinish();
        else pomoRender();
      }, 1000);
    }
    pomoRender();
  });
  $("pomoReset").addEventListener("click", () => pomoSwitch(pomo.mode));
  pomoRender();
}

/* ================= Mural de notas ================= */
const NOTE_COLORS = ["violet", "cyan", "pink", "amber", "green"];
let notes = [];
function notePos(i) {
  return { x: 18 + (i % 5) * 205, y: 18 + Math.floor(i / 5) * 165 };
}
function renderNotes() {
  const mural = $("mural");
  mural.querySelectorAll(".sticky").forEach((n) => n.remove());
  const hint = mural.querySelector(".mural-hint");
  if (hint) hint.style.display = notes.length ? "none" : "grid";
  notes.forEach((n, i) => {
    const pos = n.x || n.y ? { x: n.x, y: n.y } : notePos(i);
    const el = document.createElement("div");
    el.className = "sticky " + (n.color || "violet");
    el.style.left = pos.x + "px";
    el.style.top = pos.y + "px";
    el.dataset.id = n.id;
    el.innerHTML = `
      <div class="sticky-head">
        <span class="dots">${NOTE_COLORS.map((c) => `<b data-c="${c}" style="background:${{ violet: "#7c5cff", cyan: "#22d3ee", pink: "#f472b6", amber: "#fbbf24", green: "#34d399" }[c]}"></b>`).join("")}</span>
        <button class="sticky-del" title="Excluir">✕</button>
      </div>
      <textarea spellcheck="false">${esc(n.text)}</textarea>
      <div class="sticky-date">${(n.createdAt || "").slice(0, 10).split("-").reverse().join("/")}</div>`;
    mural.appendChild(el);

    const ta = el.querySelector("textarea");
    ta.addEventListener("input", () => { n.text = ta.value; });
    ta.addEventListener("blur", async () => {
      if (!n.text.trim()) { n.text = ta.value = "Escreva aqui..."; }
      try { await api("/api/notes/" + n.id, { method: "PUT", body: JSON.stringify({ text: n.text }) }); } catch (e) {}
    });
    el.querySelector(".sticky-del").addEventListener("click", async (e) => {
      e.stopPropagation();
      el.remove();
      notes = notes.filter((x) => x.id !== n.id);
      renderNotes();
      try { await api("/api/notes/" + n.id, { method: "DELETE" }); } catch (err) {}
    });
    el.querySelectorAll(".dots b").forEach((dot) => {
      dot.addEventListener("click", async (e) => {
        e.stopPropagation();
        n.color = dot.dataset.c;
        el.className = "sticky " + n.color;
        try { await api("/api/notes/" + n.id, { method: "PUT", body: JSON.stringify({ color: n.color }) }); } catch (err) {}
      });
    });
    // drag
    let drag = null;
    el.addEventListener("pointerdown", (e) => {
      if (e.target.closest("textarea") || e.target.closest("button") || e.target.closest("b")) return;
      const rect = mural.getBoundingClientRect();
      drag = { dx: e.clientX - el.offsetLeft, dy: e.clientY - el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, mw: rect.width, mh: rect.height };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!drag) return;
      const x = Math.max(4, Math.min(drag.mw - drag.w - 4, e.clientX - drag.dx));
      const y = Math.max(4, Math.min(drag.mh - drag.h - 4, e.clientY - drag.dy));
      el.style.left = x + "px";
      el.style.top = y + "px";
    });
    el.addEventListener("pointerup", async (e) => {
      if (!drag) return;
      drag = null;
      n.x = el.offsetLeft;
      n.y = el.offsetTop;
      try { await api("/api/notes/" + n.id, { method: "PUT", body: JSON.stringify({ x: n.x, y: n.y }) }); } catch (err) {}
    });
  });
}
async function loadNotes() {
  try { notes = await api("/api/notes"); } catch (e) { notes = []; }
  renderNotes();
}
function initNotes() {
  $("noteAdd").addEventListener("click", async () => {
    try {
      const n = await api("/api/notes", { method: "POST", body: JSON.stringify({ text: "Escreva aqui...", color: NOTE_COLORS[notes.length % 5] }) });
      handleAward({ unlocked: n.award && n.award.unlocked });
      delete n.award;
      notes.unshift(n);
      renderNotes();
    } catch (e) { alert("Erro ao criar nota: " + e.message); }
  });
}

/* ================= Tarefas ================= */
let tasks = [];
function fmtDate(d) { return d ? d.split("-").reverse().slice(0, 2).join("/") : ""; }
function renderTasks() {
  const box = $("taskList");
  const sorted = tasks.slice().sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const ad = a.due || "9999-12-31", bd = b.due || "9999-12-31";
    return ad.localeCompare(bd);
  });
  if (!sorted.length) {
    box.innerHTML = '<div class="empty" style="padding:34px 16px;">Nenhuma tarefa ainda. Anote a primeira abaixo.</div>';
    return;
  }
  box.innerHTML = sorted
    .map((t) => {
      const late = !t.done && t.due && t.due < todayStr();
      const isToday = t.due === todayStr();
      return `<div class="task-row ${t.done ? "done" : ""}" data-id="${t.id}">
        <button class="task-check" title="Concluir">✓</button>
        <span class="task-title">${esc(t.title)}</span>
        ${t.due ? `<span class="task-due ${late ? "late" : isToday ? "today" : ""}">📅 ${fmtDate(t.due)}${late ? " · atrasada" : isToday ? " · hoje" : ""}</span>` : ""}
        <button class="icon-btn task-del" style="width:28px;height:28px;font-size:12px;" title="Excluir">✕</button>
      </div>`;
    })
    .join("");
  box.querySelectorAll(".task-row").forEach((row) => {
    const t = tasks.find((x) => x.id === row.dataset.id);
    row.querySelector(".task-check").addEventListener("click", async () => {
      try {
        const r = await api("/api/tasks/" + t.id, { method: "PUT", body: JSON.stringify({ done: !t.done }) });
        t.done = r.done;
        if (r.award) handleAward(r.award);
        renderTasks();
      } catch (e) {}
    });
    row.querySelector(".task-del").addEventListener("click", async () => {
      row.style.opacity = "0";
      tasks = tasks.filter((x) => x.id !== t.id);
      setTimeout(renderTasks, 150);
      try { await api("/api/tasks/" + t.id, { method: "DELETE" }); } catch (e) {}
    });
  });
}
async function loadTasks() {
  try { tasks = await api("/api/tasks"); } catch (e) { tasks = []; }
  renderTasks();
  // lembrete de tarefas para hoje / atrasadas
  const due = tasks.filter((t) => !t.done && t.due && t.due <= todayStr()).length;
  if (due > 0 && !sessionStorage.getItem("taskNotified")) {
    try { sessionStorage.setItem("taskNotified", "1"); } catch (e) {}
    DashNotify("Tarefas pendentes 📋", `Voce tem ${due} tarefa(s) para hoje ou atrasada(s).`);
  }
}
function initTasks() {
  const add = async () => {
    const title = $("taskTitle").value.trim();
    if (!title) return;
    DashAskNotify();
    try {
      const t = await api("/api/tasks", { method: "POST", body: JSON.stringify({ title, due: $("taskDue").value }) });
      handleAward({ unlocked: t.award && t.award.unlocked });
      delete t.award;
      tasks.unshift(t);
      $("taskTitle").value = "";
      $("taskDue").value = "";
      renderTasks();
    } catch (e) { alert("Erro: " + e.message); }
  };
  $("taskAdd").addEventListener("click", add);
  $("taskTitle").addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
}

/* ================= Calendario ================= */
let events = [];
let calView = new Date();
let calSel = todayStr();
const MONTHS = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
function pad(n) { return String(n).padStart(2, "0"); }
function dstr(y, m, d) { return `${y}-${pad(m + 1)}-${pad(d)}`; }
function renderCalendar() {
  const y = calView.getFullYear(), m = calView.getMonth();
  $("calTitle").textContent = `${MONTHS[m]} ${y}`;
  const grid = $("calGrid");
  const dows = ["D", "S", "T", "Q", "Q", "S", "S"];
  let html = dows.map((d) => `<div class="cal-dow">${d}</div>`).join("");
  const first = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const prevDays = new Date(y, m, 0).getDate();
  for (let i = first - 1; i >= 0; i--) html += `<div class="cal-day other">${prevDays - i}</div>`;
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = dstr(y, m, d);
    const hasEv = events.some((e) => e.date === ds);
    html += `<div class="cal-day ${ds === todayStr() ? "today" : ""} ${ds === calSel ? "sel" : ""}" data-date="${ds}">${d}${hasEv ? '<span class="ev"><i></i></span>' : ""}</div>`;
  }
  const total = first + daysInMonth;
  for (let i = 0; i < (7 - (total % 7)) % 7; i++) html += `<div class="cal-day other">${i + 1}</div>`;
  grid.innerHTML = html;
  grid.querySelectorAll(".cal-day[data-date]").forEach((cell) => {
    cell.addEventListener("click", () => {
      calSel = cell.dataset.date;
      renderCalendar();
    });
  });
  renderCalEvents();
}
function renderCalEvents() {
  const box = $("calEvents");
  const list = events.filter((e) => e.date === calSel);
  $("calSelLabel").textContent = calSel.split("-").reverse().join("/");
  if (!list.length) {
    box.innerHTML = '<div class="muted small" style="padding:4px 2px;">Nenhum evento nesse dia.</div>';
    return;
  }
  box.innerHTML = list
    .map((e) => `<div class="cal-ev-row"><span>📌</span><span>${esc(e.title)}</span><button class="icon-btn x" data-id="${e.id}" style="width:26px;height:26px;font-size:11px;">✕</button></div>`)
    .join("");
  box.querySelectorAll(".cal-ev-row .x").forEach((b) => {
    b.addEventListener("click", async () => {
      events = events.filter((e) => e.id !== b.dataset.id);
      renderCalendar();
      try { await api("/api/events/" + b.dataset.id, { method: "DELETE" }); } catch (e) {}
    });
  });
}
async function loadEvents() {
  try { events = await api("/api/events"); } catch (e) { events = []; }
  renderCalendar();
}
function initCalendar() {
  $("calPrev").addEventListener("click", () => { calView.setMonth(calView.getMonth() - 1); renderCalendar(); });
  $("calNext").addEventListener("click", () => { calView.setMonth(calView.getMonth() + 1); renderCalendar(); });
  $("calToday").addEventListener("click", () => { calView = new Date(); calSel = todayStr(); renderCalendar(); });
  const add = async () => {
    const title = $("calInput").value.trim();
    if (!title) return;
    try {
      const e = await api("/api/events", { method: "POST", body: JSON.stringify({ date: calSel, title }) });
      events.push(e);
      $("calInput").value = "";
      renderCalendar();
    } catch (err) { alert("Erro: " + err.message); }
  };
  $("calAdd").addEventListener("click", add);
  $("calInput").addEventListener("keydown", (e) => { if (e.key === "Enter") add(); });
}

/* ================= QR code (celular) ================= */
async function initQR() {
  const btn = $("qrBtn");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const modal = $("qrModal");
    modal.classList.remove("hidden");
    const box = $("qrBox");
    box.innerHTML = '<span class="muted small">gerando...</span>';
    try {
      const r = await api("/api/lan-url");
      box.innerHTML = "";
      new QRCode(box, { text: r.url, width: 210, height: 210, colorDark: "#0b0e1c", colorLight: "#ffffff" });
      $("qrUrl").textContent = r.url;
    } catch (e) {
      box.innerHTML = '<span class="muted small">nao foi possivel gerar</span>';
    }
  });
  $("qrClose").addEventListener("click", () => $("qrModal").classList.add("hidden"));
  $("qrCopy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText($("qrUrl").textContent); $("qrCopy").textContent = "Copiado!"; setTimeout(() => ($("qrCopy").textContent = "Copiar link"), 1200); } catch (e) {}
  });
}

/* ================= Boot ================= */
tickClock();
setInterval(tickClock, 1000);
renderProfile(null);
ping();
loadWeather();
initPomodoro();
initNotes();
loadNotes();
initTasks();
loadTasks();
initCalendar();
loadEvents();
initQR();
