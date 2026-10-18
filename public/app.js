"use strict";

const state = {
  categories: [],
  components: [],
  activeCategory: null,
  search: "",
  sort: "recent",
  selected: new Set(),
  viewing: null,
  selectedView: "grid",
  editorTabs: [{ id: 1, lang: "html", code: "" }],
  activeTab: 1,
  nextTabId: 2,
  page: 0,
  pageSize: 24,
  hasMore: true,
  loadingMore: false,
  searchTimer: null,
};

const $ = (id) => document.getElementById(id);

async function api(path, opts) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

async function loadCategories() {
  state.categories = await api("/api/categories");
  renderCategories();
  populateCatSelect();
}

async function loadComponents() {
  const params = new URLSearchParams();
  if (state.activeCategory) params.set("category", state.activeCategory);
  if (state.search) params.set("q", state.search);
  params.set("sort", state.sort);
  params.set("limit", state.pageSize);
  params.set("offset", 0);
  const res = await api("/api/components?" + params.toString());
  state.components = res.items || [];
  state.page = 0;
  state.hasMore = !!res.hasMore;
  const grid = $("grid");
  grid.innerHTML = "";
  if (state.components.length === 0) {
    grid.innerHTML = `<div class="empty">Nenhum componente ainda. Clique em "+ Novo componente" para adicionar.</div>`;
    return;
  }
  appendCards(state.components);
  updateSelCount();
}

async function loadMore() {
  if (state.loadingMore || !state.hasMore) return;
  state.loadingMore = true;
  const params = new URLSearchParams();
  if (state.activeCategory) params.set("category", state.activeCategory);
  if (state.search) params.set("q", state.search);
  params.set("sort", state.sort);
  params.set("limit", state.pageSize);
  params.set("offset", state.components.length);
  try {
    const res = await api("/api/components?" + params.toString());
    const items = res.items || [];
    state.components = state.components.concat(items);
    appendCards(items);
    state.hasMore = !!res.hasMore;
  } catch (e) {}
  state.loadingMore = false;
}

function appendCards(list) {
  const grid = $("grid");
  for (const c of list) {
    const card = document.createElement("div");
    card.className = "card" + (state.selected.has(c.id) ? " selected" : "");
    const cat = state.categories.find((x) => x.id === c.category);
    card.innerHTML = `
      <div class="card-preview" data-preview="${c.id}"></div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(c.name)}</div>
        <div class="card-cat">${cat ? cat.icon + " " + cat.name : c.category}</div>
      </div>
    `;
    card.dataset.id = c.id;
    grid.appendChild(card);
    loadPreview(c.id, card);
    card.classList.toggle("selected", state.selected.has(c.id));
    card.style.cursor = "pointer";
    card.addEventListener("click", () => openView(c.id));
  }
}

function renderCategories() {
  const sel = $("catSelect");
  if (sel) {
    sel.innerHTML = `<option value="">Todos</option>` + state.categories.map((c) => `<option value="${c.id}">${c.icon} ${c.name} (${c.count})</option>`).join("");
    sel.value = state.activeCategory || "";
  }
  const chips = $("catChips");
  if (chips) {
    const totalCount = state.categories.reduce((a, c) => a + c.count, 0);
    chips.innerHTML = `<button class="btn btn-ghost ${state.activeCategory === null ? 'active' : ''}" data-cat="">Todos (${totalCount})</button>` +
      state.categories.map((c) => `<button class="btn btn-ghost ${state.activeCategory === c.id ? 'active' : ''}" data-cat="${c.id}">${c.icon} ${c.name} (${c.count})</button>`).join("");
    chips.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => { state.activeCategory = btn.dataset.cat || null; loadComponents(); renderCategories(); });
    });
  }
}
function updateTitle() {}

function updateTitle() {
  const cat = state.categories.find((c) => c.id === state.activeCategory);
  $("viewTitle").textContent = cat ? cat.name : "Todos os componentes";
}

function buildPreviewDoc(comp) {
  const blocks = comp.blocks || (comp.code ? [{ lang: comp.language || "html", code: comp.code }] : []);
  const htmlBlock = blocks.find((b) => b.lang === "html");
  const cssBlock = blocks.find((b) => b.lang === "css");
  const jsBlock = blocks.find((b) => b.lang === "js");
  const otherBlock = blocks.find((b) => b.lang && b.lang !== "html" && b.lang !== "css" && b.lang !== "js");
  const htmlCode = htmlBlock ? htmlBlock.code : "";
  const cssCode = cssBlock ? cssBlock.code : "";
  const jsCode = jsBlock ? jsBlock.code : "";
  const otherCode = otherBlock ? otherBlock.code : "";
  const otherLang = otherBlock ? otherBlock.lang : "";
  const code = htmlCode || otherCode || cssCode || jsCode || "";
  const language = htmlCode ? "html" : (otherCode ? otherLang : (cssCode ? "css" : "js"));
  // colors: render swatches
  if (comp.category === "colors") {
    const matches = [...code.matchAll(/--[\w-]+\s*:\s*([^;]+)/g)];
    const swatches = matches.map((m) => {
      const val = m[1].trim();
      const name = m[0].split(":")[0].trim();
      return `<div class="swatch" style="background:${val}">${name.replace("--", "")}<br>${val}</div>`;
    }).join("");
    return `<!DOCTYPE html><html><head><style>html,body{margin:0;height:100%}.swatches{display:flex;height:100%}.swatch{flex:1;display:flex;align-items:flex-end;justify-content:center;font-size:10px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.7);padding:6px;font-family:monospace;word-break:break-all}</style></head><body><div class="swatches">${swatches || "<div style='padding:12px'>sem cores</div>"}</div></body></html>`;
  }
  // fonts: sample text
  if (comp.category === "fonts") {
    return `<!DOCTYPE html><html><head>${code.includes("<link") ? code.match(/<link[^>]*>/g)?.join("") || "" : ""}<style>html,body{height:100%;margin:0;overflow:hidden}body{padding:16px;font-family:system-ui,sans-serif;background:#fff;color:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100%} .sample{font-size:24px;font-weight:600} ${code.replace(/<[^>]+>/g, "")}</style></head><body><div class="sample">Aa Bb Cc 0123</div><div style="margin-top:8px;font-size:14px">O rato roeu a roupa do rei de Roma.</div></body></html>`;
  }
  let head = `<style>html,body{height:100%;margin:0;overflow:hidden}body{padding:8px;font-family:system-ui,sans-serif;background:#f7f7fb;color:#111;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:8px}</style>`;
  if (cssCode) head += `<style>${cssCode}</style>`;
  let body = "";
  if (htmlCode && /<[a-z]/i.test(htmlCode)) {
    body = htmlCode;
    if (jsCode) body += `<script>${jsCode}</script>`;
  } else if (cssCode && !htmlCode) {
    body = `<div class="preview-box" style="padding:16px;border-radius:10px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.08)">Preview</div>`;
  } else if (jsCode && !htmlCode) {
    body = `<div id="app" style="padding:16px">Preview</div><script>${jsCode}</script>`;
  } else if (otherCode) {
    body = `<pre style="white-space:pre-wrap;font-family:monospace;font-size:12px">${escapeHtml(otherCode).slice(0, 400)}</pre>`;
  } else {
    body = `<pre style="white-space:pre-wrap;font-family:monospace;font-size:12px">${escapeHtml(code).slice(0, 400)}</pre>`;
  }
  return `<!DOCTYPE html><html><head>${head}</head><body>${body}</body></html>`;
}

function renderGrid() {
  const grid = $("grid");
  grid.innerHTML = "";
  if (state.components.length === 0) {
    grid.innerHTML = `<div class="empty">Nenhum componente ainda. Clique em "+ Novo componente" para adicionar.</div>`;
    return;
  }
  for (const c of state.components) {
    const card = document.createElement("div");
    card.className = "card" + (state.selected.has(c.id) ? " selected" : "");
    const cat = state.categories.find((x) => x.id === c.category);
    card.innerHTML = `
      <div class="card-preview" data-preview="${c.id}"></div>
      <div class="card-body">
        <div class="card-title">${escapeHtml(c.name)}</div>
        <div class="card-cat">${cat ? cat.icon + " " + cat.name : c.category}</div>
      </div>
    `;
    card.dataset.id = c.id;
    grid.appendChild(card);
    loadPreview(c.id, card);
    card.classList.toggle("selected", state.selected.has(c.id));
    card.style.cursor = "pointer";
    card.addEventListener("click", () => openView(c.id));
  }
}

async function loadPreview(id, card) {
  try {
    const comp = await api("/api/components/" + id);
    const container = card.querySelector(`[data-preview="${id}"]`);
    if (!container) return;
    const iframe = document.createElement("iframe");
    iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("scrolling", "no");
    iframe.style.pointerEvents = "auto";
    iframe.srcdoc = buildPreviewDoc(comp);
    container.appendChild(iframe);
    iframe.addEventListener("load", () => {
      try {
        iframe.contentDocument.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          openView(comp.id);
        });
      } catch (e) {}
    });
  } catch (e) {}
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function openModal(id) { $(id).classList.remove("hidden"); }
function closeModal(id) { $(id).classList.add("hidden"); }

function renderEditorTabs() {
  const bar = $("editorTabs");
  if (!bar) return;
  bar.innerHTML = "";
  for (const t of state.editorTabs) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ctab" + (t.id === state.activeTab ? " active" : "");
    const label = document.createElement("span");
    label.contentEditable = "true";
    label.textContent = t.lang;
    label.addEventListener("blur", (e) => { t.lang = (e.target.textContent || "txt").trim().toLowerCase() || "txt"; renderEditorTabs(); renderEditorArea(); });
    label.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); label.blur(); } });
    btn.appendChild(label);
    if (state.editorTabs.length > 1) {
      const rm = document.createElement("span");
      rm.textContent = " ×";
      rm.style.cursor = "pointer";
      rm.addEventListener("click", (e) => {
        e.stopPropagation();
        destroyEditor(t.id);
        state.editorTabs = state.editorTabs.filter((x) => x.id !== t.id);
        if (state.activeTab === t.id) state.activeTab = state.editorTabs[0].id;
        renderEditorTabs();
        renderEditorArea();
      });
      btn.appendChild(rm);
    }
    btn.addEventListener("click", () => { state.activeTab = t.id; renderEditorTabs(); renderEditorArea(); });
    bar.appendChild(btn);
  }
}
/* ---------- Editor (CodeMirror + fallback) ---------- */
const cmStore = new Map(); // tabId -> { host, cm }
const lastVals = new Map(); // tabId -> valor antes da ultima mudanca

function cmMode(lang) {
  const l = (lang || "").toLowerCase();
  if (["html", "xml", "svg", "htm"].includes(l)) return "htmlmixed";
  if (["css", "scss", "less"].includes(l)) return "css";
  if (["js", "javascript", "jsx", "ts", "tsx"].includes(l)) return "javascript";
  if (l === "json") return { name: "javascript", json: true };
  return null;
}
function destroyEditor(tabId) {
  const rec = cmStore.get(tabId);
  if (rec) { rec.host.remove(); cmStore.delete(tabId); }
  lastVals.delete(tabId);
}
function resetEditors() {
  for (const [, rec] of cmStore) rec.host.remove();
  cmStore.clear();
  lastVals.clear();
}
function showHint(msg) {
  const el = $("detectHint");
  if (!el) return;
  el.textContent = msg;
  clearTimeout(showHint._t);
  showHint._t = setTimeout(() => (el.textContent = ""), 3200);
}
function detectLang(code) {
  const c = String(code).trim();
  if (c.length < 30) return null;
  try { JSON.parse(c); return "json"; } catch (e) {}
  const looksHtml = /<\/?[a-z][\w-]*(\s[^<>]*)?>/i.test(c);
  const realTag = /<(div|span|button|html|body|section|header|main|nav|a|p|ul|ol|li|input|img|h1|h2|h3|form|label|table|svg|style|script)\b/i.test(c);
  const cssPairs = (c.match(/[\w-]+\s*:\s*[^;{}]+;/g) || []).length;
  const hasSelector = /(^|\n)\s*[.#@]?[a-zA-Z][\w\-\[\]="':. >]*\{/.test(c);
  const jsHits = (c.match(/\b(function|const|let|var|=>|document\.|window\.|console\.|prompt\(|alert\(|class\s+\w+|import\s.+\sfrom|export\s|addEventListener|querySelector)/g) || []).length;
  if ((looksHtml && realTag) || /<style[\s>]/i.test(c) || /<script[\s>]/i.test(c)) return "html";
  if (hasSelector && cssPairs >= 1 && !looksHtml) return "css";
  if (jsHits >= 2 && !looksHtml) return "js";
  if (cssPairs >= 2 && !looksHtml) return "css";
  return null;
}
function langGroup(l) {
  l = (l || "").toLowerCase();
  if (["html", "xml", "htm", "svg"].includes(l)) return "html";
  if (["css", "scss", "less"].includes(l)) return "css";
  if (["js", "javascript", "jsx", "ts", "tsx"].includes(l)) return "js";
  if (l === "json") return "json";
  return "";
}
function smartPaste(cm, t) {
  const code = cm.getValue();
  const prev = (lastVals.get(t.id) || "").trim();
  if (code.trim().length < 30 || prev.length > 10) return;
  const det = detectLang(code);
  if (!det) return;
  if (langGroup(det) === langGroup(t.lang) && langGroup(det) !== "") return;
  // mover conteudo para a aba da linguagem detectada
  t.code = "";
  cm.setValue("");
  let target = state.editorTabs.find((x) => langGroup(x.lang) === langGroup(det) && x.id !== t.id);
  if (!target) {
    const id = state.nextTabId++;
    target = { id, lang: det, code };
    state.editorTabs.push(target);
    state.activeTab = id;
  } else {
    state.activeTab = target.id;
    target.code = code;
  }
  renderEditorTabs();
  renderEditorArea();
  const rec = cmStore.get(target.id);
  if (rec) { rec.cm.setValue(code); lastVals.set(target.id, code); rec.cm.focus(); }
  showHint(`✨ Detectado ${det.toUpperCase()} → movido para a aba "${target.lang}"`);
}
function renderEditorArea() {
  const area = $("editorArea");
  if (!area) return;
  const t = state.editorTabs.find((x) => x.id === state.activeTab);
  if (!t) return;
  Array.from(area.children).forEach((el) => { el.style.display = "none"; });
  const plainLang = t.lang === "url" || t.lang === "npm";
  if (plainLang || !window.CodeMirror) {
    let plain = area.querySelector(`[data-plain="${t.id}"]`);
    if (!plain) {
      plain = document.createElement("div");
      plain.dataset.plain = t.id;
      plain.style.display = "flex";
      plain.style.flexDirection = "column";
      plain.style.gap = "8px";
      if (plainLang) {
        const inp = document.createElement("input");
        inp.type = "text";
        inp.placeholder = t.lang === "url" ? "https://..." : "npm install ...";
        inp.addEventListener("input", (e) => { t.code = e.target.value; });
        plain.appendChild(inp);
        const note = document.createElement("div");
        note.className = "muted small";
        note.textContent = t.lang === "url" ? "URL do componente/codigo" : "Comando npm";
        plain.appendChild(note);
      } else {
        const ta = document.createElement("textarea");
        ta.style.minHeight = "300px";
        ta.placeholder = t.lang.toUpperCase() + " code...";
        ta.addEventListener("input", (e) => { t.code = e.target.value; });
        plain.appendChild(ta);
        const note = document.createElement("div");
        note.className = "muted small";
        note.textContent = "Editor simples (CodeMirror nao carregou)";
        plain.appendChild(note);
      }
      area.appendChild(plain);
    }
    plain.style.display = "flex";
    const field = plain.querySelector("input, textarea");
    if (field && field.value !== t.code) field.value = t.code;
    return;
  }
  let rec = cmStore.get(t.id);
  if (!rec) {
    const host = document.createElement("div");
    host.style.borderRadius = "12px";
    host.style.overflow = "hidden";
    const cm = CodeMirror(host, {
      value: t.code || "",
      mode: cmMode(t.lang),
      theme: "aurora",
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
    });
    cm.on("change", (inst, chg) => {
      const code = inst.getValue();
      t.code = code;
      if (chg.origin === "paste") smartPaste(inst, t);
      lastVals.set(t.id, inst.getValue());
    });
    lastVals.set(t.id, t.code || "");
    area.appendChild(host);
    rec = { host, cm };
    cmStore.set(t.id, rec);
  }
  rec.host.style.display = "block";
  rec.cm.setOption("mode", cmMode(t.lang));
  if (rec.cm.getValue() !== (t.code || "")) rec.cm.setValue(t.code || "");
  setTimeout(() => { try { rec.cm.refresh(); } catch (e) {} }, 60);
}
function addNewTab(lang) {
  const id = state.nextTabId++;
  state.editorTabs.push({ id, lang: lang || "untitled", code: "" });
  state.activeTab = id;
  renderEditorTabs();
  renderEditorArea();
  // focus the new tab label for renaming
  setTimeout(() => {
    const btns = document.querySelectorAll("#editorTabs .ctab");
    const last = btns[btns.length - 1];
    const label = last ? last.querySelector("[contenteditable]") : null;
    if (label) { label.focus(); document.execCommand("selectAll"); }
  }, 50);
}

$("btnNew").addEventListener("click", () => {
  $("modalTitle").textContent = "Novo componente";
  $("compId").value = "";
  $("compName").value = "";
  $("compCategory").value = state.activeCategory || (state.categories[0] && state.categories[0].id) || "other";
  $("compTags").value = "";
  resetEditors();
  state.editorTabs = [{ id: 1, lang: "html", code: "" }];
  state.activeTab = 1;
  state.nextTabId = 2;
  renderEditorTabs();
  renderEditorArea();
  openModal("modal");
});

const addTabBtn = $("addTabBtn");
if (addTabBtn) {
  addTabBtn.addEventListener("click", () => {
    addNewTab("untitled");
  });
}

function populateCatSelect() {
  const sel = $("compCategory");
  if (!sel) return;
  sel.innerHTML = state.categories.map((c) => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join("");
}

async function openEdit(id) {
  const comp = await api("/api/components/" + id);
  $("modalTitle").textContent = "Editar componente";
  $("compId").value = comp.id;
  $("compName").value = comp.name;
  $("compCategory").value = comp.category;
  $("compTags").value = (comp.tags || []).join(", ");
  const blocks = comp.blocks || (comp.code ? [{ lang: comp.language || "html", code: comp.code }] : []);
  resetEditors();
  state.editorTabs = blocks.length ? blocks.map((b, i) => ({ id: i + 1, lang: b.lang || "html", code: b.code || "" })) : [{ id: 1, lang: "html", code: "" }];
  state.activeTab = state.editorTabs[0].id;
  state.nextTabId = state.editorTabs.length + 1;
  renderEditorTabs();
  renderEditorArea();
  openModal("modal");
}

$("compForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("compId").value;
  const blocks = state.editorTabs
    .map((t) => ({ lang: t.lang, code: t.code }))
    .filter((b) => b.code && b.code.trim() !== "");
  const body = {
    name: $("compName").value,
    category: $("compCategory").value,
    tags: $("compTags").value,
    blocks: blocks,
  };
  try {
    if (id) await api("/api/components/" + id, { method: "PUT", body: JSON.stringify(body) });
    else await api("/api/components", { method: "POST", body: JSON.stringify(body) });
    closeModal("modal");
    await loadCategories();
    await loadComponents();
    renderCategories();
    toastNewAchievements();
  } catch (err) { alert("Erro: " + err.message); }
});

$("modalClose").addEventListener("click", () => closeModal("modal"));
$("modalCancel").addEventListener("click", () => closeModal("modal"));

async function openView(id) {
  const comp = await api("/api/components/" + id);
  state.viewing = comp;
  const vs = $("viewSelect");
  if (vs) {
    const isSel = state.selected.has(comp.id);
    vs.textContent = isSel ? "Remover selecao" : "Selecionar";
    vs.className = isSel ? "btn btn-ghost" : "btn btn-accent";
  }
  $("viewCompTitle").textContent = comp.name;
  $("viewCompMeta").textContent = `${comp.category} · ${comp.language} · ${(comp.tags || []).join(", ")}`;
  const codeText = (comp.blocks || []).map((b) => `/* ${b.lang} */\n${b.code}`).join("\n\n") || comp.code || "";
  $("viewCompCode").textContent = codeText;
  // preview in view modal
  const pv = $("viewPreview");
  if (pv) {
    pv.innerHTML = "";
    if (comp.category === "colors") {
      const matches = [...(comp.code || "").matchAll(/--[\w-]+\s*:\s*([^;]+)/g)];
      const swatches = matches.map((m) => {
        const val = m[1].trim();
        const name = m[0].split(":")[0].trim().replace("--", "");
        return `<div class="swatch" style="background:${val}">${name}<br>${val}</div>`;
      }).join("");
      pv.innerHTML = `<div class="swatches" style="height:120px">${swatches}</div>`;
    } else {
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("scrolling", "no");
      iframe.srcdoc = buildPreviewDoc(comp);
      iframe.style.height = "260px";
      pv.appendChild(iframe);
    }
  }
  openModal("viewModal");
}
$("viewClose").addEventListener("click", () => closeModal("viewModal"));
$("viewSelect").addEventListener("click", () => {
  if (!state.viewing) return;
  if (state.selected.has(state.viewing.id)) state.selected.delete(state.viewing.id);
  else state.selected.add(state.viewing.id);
  const isSel = state.selected.has(state.viewing.id);
  $("viewSelect").textContent = isSel ? "Remover selecao" : "Selecionar";
  $("viewSelect").className = isSel ? "btn btn-ghost" : "btn btn-accent";
  updateSelCount();
  refreshSelection();
});
$("viewEdit").addEventListener("click", () => { closeModal("viewModal"); if (state.viewing) openEdit(state.viewing.id); });
$("viewDelete").addEventListener("click", async () => {
  if (!state.viewing) return;
  if (!confirm("Excluir este componente?")) return;
  await api("/api/components/" + state.viewing.id, { method: "DELETE" });
  state.selected.delete(state.viewing.id);
  closeModal("viewModal");
  state.viewing = null;
  await loadCategories();
  await loadComponents();
  renderCategories();
});
$("viewCopy").addEventListener("click", async () => {
  if (!state.viewing) return;
  await navigator.clipboard.writeText(state.viewing.code || "");
  $("viewCopy").textContent = "Copiado!";
  setTimeout(() => ($("viewCopy").textContent = "Copiar codigo"), 1200);
});

function updateSelCount() {
  const el = $("selCount");
  if (el) el.textContent = state.selected.size;
}
function refreshSelection() {
  document.querySelectorAll("#grid .card").forEach((card) => {
    card.classList.toggle("selected", state.selected.has(card.dataset.id));
  });
  updateSelCount();
}
function renderSelectedGrid() {
  const grid = $("selectedGrid");
  if (!grid) return;
  grid.innerHTML = "";
  grid.className = state.selectedView === "list" ? "selected-list" : "grid";
  const selectedComps = state.components.filter((c) => state.selected.has(c.id));
  if (selectedComps.length === 0) {
    grid.innerHTML = `<div class="empty">Nenhum item selecionado ainda.</div>`;
    return;
  }
  for (const c of selectedComps) {
    const cat = state.categories.find((x) => x.id === c.category);
    if (state.selectedView === "list") {
      const row = document.createElement("div");
      row.className = "sel-row";
      row.innerHTML = `
        <div class="sel-thumb" data-preview="sel-${c.id}"></div>
        <div class="sel-info">
          <div class="card-title">${escapeHtml(c.name)}</div>
          <div class="card-cat">${cat ? cat.icon + " " + cat.name : c.category}</div>
          <div class="card-tags">${(c.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join("")}</div>
        </div>
        <button class="btn btn-ghost" data-remove="${c.id}">Remover</button>
      `;
      grid.appendChild(row);
      api("/api/components/" + c.id).then((comp) => {
        const container = row.querySelector(`[data-preview="sel-${c.id}"]`);
        if (!container) return;
        const iframe = document.createElement("iframe");
        iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("scrolling", "no");
        iframe.srcdoc = buildPreviewDoc(comp);
        container.appendChild(iframe);
      }).catch(() => {});
      row.querySelector(`[data-remove="${c.id}"]`).addEventListener("click", (e) => {
        e.stopPropagation();
        state.selected.delete(c.id);
        updateSelCount();
        renderGrid();
        renderSelectedGrid();
      });
      row.addEventListener("click", (e) => {
        if (e.target.closest("button")) return;
        closeModal("selectedModal");
        openView(c.id);
      });
    } else {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <div class="card-preview" data-preview="sel-${c.id}"></div>
        <div class="card-body">
          <div class="card-title">${escapeHtml(c.name)}</div>
          <div class="card-cat">${cat ? cat.icon + " " + cat.name : c.category}</div>
        </div>
      `;
      grid.appendChild(card);
      api("/api/components/" + c.id).then((comp) => {
        const container = card.querySelector(`[data-preview="sel-${c.id}"]`);
        if (!container) return;
        const iframe = document.createElement("iframe");
        iframe.setAttribute("sandbox", "allow-scripts");
    iframe.setAttribute("scrolling", "no");
        iframe.srcdoc = buildPreviewDoc(comp);
        container.appendChild(iframe);
      }).catch(() => {});
      card.style.cursor = "pointer";
      card.addEventListener("click", () => { closeModal("selectedModal"); openView(c.id); });
    }
  }
}
$("btnSelected").addEventListener("click", () => {
  renderSelectedGrid();
  openModal("selectedModal");
});
$("selectedClose").addEventListener("click", () => closeModal("selectedModal"));
$("selViewGrid").addEventListener("click", () => { state.selectedView = "grid"; renderSelectedGrid(); });
$("selViewList").addEventListener("click", () => { state.selectedView = "list"; renderSelectedGrid(); });
$("selectedClear").addEventListener("click", () => {
  state.selected.clear();
  updateSelCount();
  refreshSelection();
  renderSelectedGrid();
});
$("selectedGen").addEventListener("click", () => {
  closeModal("selectedModal");
  $("genCount").textContent = state.selected.size;
  $("genResult").classList.add("hidden");
  openModal("genModal");
});

$("search").addEventListener("input", (e) => {
  state.search = e.target.value;
  clearTimeout(state.searchTimer);
  state.searchTimer = setTimeout(() => loadComponents(), 300);
});
const catSelect = $("catSelect");
if (catSelect) {
  catSelect.addEventListener("change", (e) => {
    state.activeCategory = e.target.value || null;
    loadComponents();
  });
}
$("sortSelect").addEventListener("change", (e) => {
  state.sort = e.target.value === "popular" ? "recent" : e.target.value;
  loadComponents();
});

$("btnGenerate").addEventListener("click", () => {
  $("genCount").textContent = state.selected.size;
  $("genResult").classList.add("hidden");
  openModal("genModal");
});
$("genClose").addEventListener("click", () => closeModal("genModal"));
$("genCancel").addEventListener("click", () => closeModal("genModal"));
$("genDo").addEventListener("click", async () => {
  try {
    const res = await api("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        selectedIds: Array.from(state.selected),
        projectName: $("genName").value,
        description: $("genDesc").value,
      }),
    });
    $("genPath").textContent = res.path;
    $("genContent").value = res.content;
    $("genResult").classList.remove("hidden");
    toastNewAchievements();
  } catch (err) { alert("Erro: " + err.message); }
});
$("genDownload").addEventListener("click", () => {
  const content = $("genContent").value;
  const name = ($("genName").value || "design").toLowerCase().replace(/\s+/g, "-") + "-design.md";
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
});

(async () => {
  await loadCategories();
  await loadComponents();
  const grid = $("grid");
  grid.addEventListener("scroll", () => {
    if (grid.scrollTop + grid.clientHeight >= grid.scrollHeight - 200) {
      loadMore();
    }
  });
})();

/* ================= Conquistas / XP ================= */
async function toastNewAchievements() {
  try {
    const p = await api("/api/profile");
    const now = Date.now();
    const recent = p.achievements.filter((a) => a.unlockedAt && now - new Date(a.unlockedAt).getTime() < 12000);
    if (recent.length && window.DashToast) DashToast({ unlocked: recent });
  } catch (e) {}
}

/* ================= Formatar codigo ================= */
const fmtBtn = $("fmtBtn");
if (fmtBtn) {
  fmtBtn.addEventListener("click", async () => {
    const t = state.editorTabs.find((x) => x.id === state.activeTab);
    if (!t || !t.code || !t.code.trim()) { showHint("Nada para formatar"); return; }
    if (!window.prettier || !window.prettierPlugins) { showHint("Formatador offline no momento :("); return; }
    const l = (t.lang || "").toLowerCase();
    const parser = ["css", "scss", "less"].includes(l) ? "css"
      : ["html", "xml"].includes(l) ? "html"
      : l === "json" ? "json"
      : ["js", "javascript", "jsx", "ts", "tsx", "babel"].includes(l) ? "babel"
      : "babel";
    try {
      const plugins = [window.prettierPlugins.babel, window.prettierPlugins.estree, window.prettierPlugins.postcss, window.prettierPlugins.html].filter(Boolean);
      const out = await window.prettier.format(t.code, { parser, plugins, printWidth: 100 });
      t.code = out;
      const rec = cmStore.get(t.id);
      if (rec) { rec.cm.setValue(out); lastVals.set(t.id, out); }
      else renderEditorArea();
      showHint("✨ Codigo formatado");
    } catch (e) {
      showHint("Nao deu: " + String(e.message || e).split("\n")[0].slice(0, 70));
    }
  });
}

/* ================= Modo apresentacao ================= */
const pres = { list: [], i: 0, timer: null, playing: false };
async function openPres() {
  const params = new URLSearchParams();
  if (state.activeCategory) params.set("category", state.activeCategory);
  if (state.search) params.set("q", state.search);
  params.set("sort", state.sort);
  params.set("limit", "100");
  params.set("offset", "0");
  try {
    const res = await api("/api/components?" + params.toString());
    pres.list = res.items || [];
  } catch (e) { pres.list = []; }
  if (!pres.list.length) { alert("Nenhum componente para apresentar com os filtros atuais."); return; }
  pres.i = 0;
  pres.playing = false;
  $("pres").classList.remove("hidden");
  presRender();
}
function presRender() {
  const c = pres.list[pres.i];
  if (!c) return;
  $("presTitle").textContent = c.name;
  $("presCount").textContent = `${pres.i + 1} / ${pres.list.length}`;
  const frame = $("presFrame");
  frame.style.animation = "none";
  void frame.offsetWidth;
  frame.style.animation = "";
  api("/api/components/" + c.id)
    .then((comp) => {
      frame.innerHTML = "";
      const iframe = document.createElement("iframe");
      iframe.setAttribute("sandbox", "allow-scripts");
      iframe.srcdoc = buildPreviewDoc(comp);
      frame.appendChild(iframe);
    })
    .catch(() => {});
  const dots = $("presDots");
  dots.innerHTML = pres.list.map((_, idx) => `<i class="${idx === pres.i ? "on" : ""}"></i>`).join("");
  Array.from(dots.children).forEach((d, idx) => d.addEventListener("click", () => { pres.i = idx; presRender(); }));
}
function presGo(d) {
  pres.i = (pres.i + d + pres.list.length) % pres.list.length;
  presRender();
}
function presStop() {
  pres.playing = false;
  clearInterval(pres.timer);
  const b = $("presPlay");
  if (b) b.textContent = "▶ Auto";
}
function closePres() {
  presStop();
  $("pres").classList.add("hidden");
  $("presFrame").innerHTML = "";
}
if ($("btnPres")) {
  $("btnPres").addEventListener("click", openPres);
  $("presClose").addEventListener("click", closePres);
  $("presPrev").addEventListener("click", () => presGo(-1));
  $("presNext").addEventListener("click", () => presGo(1));
  $("presPlay").addEventListener("click", () => {
    if (pres.playing) presStop();
    else {
      pres.playing = true;
      $("presPlay").textContent = "⏸ Pausar";
      pres.timer = setInterval(() => presGo(1), 4000);
    }
  });
  document.addEventListener("keydown", (e) => {
    if ($("pres").classList.contains("hidden")) return;
    if (e.key === "Escape") closePres();
    if (e.key === "ArrowLeft") presGo(-1);
    if (e.key === "ArrowRight") presGo(1);
    if (e.key === " ") { e.preventDefault(); $("presPlay").click(); }
  });
}

/* ================= Estudios ================= */
// tabs
document.querySelectorAll("[data-studio]").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("[data-studio]").forEach((b) => b.classList.toggle("active", b === btn));
    const which = btn.dataset.studio;
    $("studioGrad").style.display = which === "grad" ? "grid" : "none";
    $("studioBtn").style.display = which === "btn" ? "grid" : "none";
    $("studioFont").style.display = which === "font" ? "grid" : "none";
    if (which === "font") renderFontList($("fSearch").value);
  });
});
if ($("btnStudio")) $("btnStudio").addEventListener("click", () => { openModal("studioModal"); gradUpdate(); btnUpdate(); });
if ($("studioClose")) $("studioClose").addEventListener("click", () => closeModal("studioModal"));

async function saveStudioComponent(name, category, tags, blocks) {
  const comp = await api("/api/components", {
    method: "POST",
    body: JSON.stringify({ name, category, tags, blocks }),
  });
  await loadCategories();
  await loadComponents();
  renderCategories();
  toastNewAchievements();
  return comp;
}

// ---- Gradiente ----
function gradCss() {
  const angle = $("gAngle").value;
  const c1 = $("gC1").value;
  const c2 = $("gC2").value;
  const anim = $("gAnim").checked;
  const base = `background: linear-gradient(${angle}deg, ${c1} 0%, ${c2} 100%);`;
  if (!anim) return `.grad-box {\n  width: 100%;\n  min-height: 200px;\n  border-radius: 16px;\n  ${base}\n}`;
  return `.grad-box {\n  width: 100%;\n  min-height: 200px;\n  border-radius: 16px;\n  ${base}\n  background-size: 300% 300%;\n  animation: gradShift 7s ease infinite;\n}\n\n@keyframes gradShift {\n  0% { background-position: 0% 50%; }\n  50% { background-position: 100% 50%; }\n  100% { background-position: 0% 50%; }\n}`;
}
function gradUpdate() {
  $("gAngleOut").textContent = $("gAngle").value + "°";
  $("gC1Out").textContent = $("gC1").value;
  $("gC2Out").textContent = $("gC2").value;
  const css = gradCss();
  $("gPreview").innerHTML = `<style>${css}</style><div class="grad-box"></div>`;
  $("gCode").textContent = css;
}
["gAngle", "gC1", "gC2", "gAnim"].forEach((id) => {
  const el = $(id);
  if (el) el.addEventListener("input", gradUpdate);
});
if ($("gSave")) {
  $("gSave").addEventListener("click", async () => {
    const name = $("gName").value.trim() || `Gradiente ${$("gC1").value} → ${$("gC2").value}`;
    try {
      await saveStudioComponent(name, "backgrounds", ["gradiente", "estudio"], [
        { lang: "html", code: `<div class="grad-box"></div>` },
        { lang: "css", code: gradCss() },
      ]);
      closeModal("studioModal");
      showHint(`💾 "${name}" salvo nos componentes!`);
    } catch (e) { alert("Erro ao salvar: " + e.message); }
  });
}

// ---- Botao CSS ----
function btnCss() {
  const r = $("bRadius").value;
  const px = $("bPadX").value;
  const py = $("bPadY").value;
  const fs = $("bFont").value;
  const sh = $("bShadow").value;
  const c1 = $("bC1").value;
  const c2 = $("bC2").value;
  const tx = $("bText").value;
  const grad = $("bGrad").checked;
  const bg = grad ? `background: linear-gradient(135deg, ${c1}, ${c2});` : `background: ${c1};`;
  return `.btn-custom {\n  padding: ${py}px ${px}px;\n  font-size: ${fs}px;\n  font-weight: 700;\n  font-family: inherit;\n  color: ${tx};\n  border: none;\n  border-radius: ${r}px;\n  ${bg}\n  cursor: pointer;\n  box-shadow: 0 ${Math.round(sh / 2)}px ${sh}px rgba(0, 0, 0, 0.35);\n  transition: transform 0.15s ease, filter 0.15s ease;\n}\n\n.btn-custom:hover {\n  transform: translateY(-2px);\n  filter: brightness(1.1);\n}`;
}
function btnUpdate() {
  $("bRadiusOut").textContent = $("bRadius").value + "px";
  $("bPadXOut").textContent = $("bPadX").value + "px";
  $("bPadYOut").textContent = $("bPadY").value + "px";
  $("bFontOut").textContent = $("bFont").value + "px";
  $("bShadowOut").textContent = $("bShadow").value + "px";
  $("bC1Out").textContent = $("bC1").value;
  $("bC2Out").textContent = $("bC2").value;
  $("bTextOut").textContent = $("bText").value;
  const css = btnCss();
  $("bPreview").innerHTML = `<style>${css}</style><button class="btn-custom">Botao</button>`;
  $("bCode").textContent = css;
}
["bRadius", "bPadX", "bPadY", "bFont", "bShadow", "bC1", "bC2", "bText", "bGrad"].forEach((id) => {
  const el = $(id);
  if (el) el.addEventListener("input", btnUpdate);
});
if ($("bSave")) {
  $("bSave").addEventListener("click", async () => {
    const name = $("bName").value.trim() || `Botao ${$("bC1").value} → ${$("bC2").value}`;
    try {
      await saveStudioComponent(name, "buttons", ["botao", "estudio", "css"], [
        { lang: "html", code: `<button class="btn-custom">Botao</button>` },
        { lang: "css", code: btnCss() },
      ]);
      closeModal("studioModal");
      showHint(`💾 "${name}" salvo nos componentes!`);
    } catch (e) { alert("Erro ao salvar: " + e.message); }
  });
}

// ---- Google Fonts ----
const GFONTS = ["Inter", "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Raleway", "Nunito", "Ubuntu", "Playfair Display", "Merriweather", "Work Sans", "Rubik", "Manrope", "Sora", "Space Grotesk", "Outfit", "Quicksand", "Josefin Sans", "DM Sans", "DM Serif Display", "Bebas Neue", "Oswald", "Anton", "Archivo", "Archivo Black", "Barlow", "Cabin", "Cairo", "Chakra Petch", "Cinzel", "Comfortaa", "Cormorant Garamond", "Crimson Text", "Dancing Script", "EB Garamond", "Exo 2", "Fira Sans", "Fira Code", "Fjalla One", "Fredoka", "Gelasio", "Great Vibes", "Heebo", "Hind", "IBM Plex Sans", "IBM Plex Mono", "IBM Plex Serif", "Inconsolata", "Indie Flower", "Inter Tight", "Jost", "Kanit", "Karla", "Kaushan Script", "Kalam", "Lexend", "Libre Baskerville", "Libre Franklin", "Lobster", "Lora", "M PLUS Rounded 1c", "Merienda", "Michroma", "Mulish", "Noto Sans", "Noto Serif", "Nunito Sans", "Orbitron", "Pacifico", "Patrick Hand", "Permanent Marker", "Philosopher", "Plus Jakarta Sans", "Prompt", "PT Sans", "PT Serif", "Rajdhani", "Red Hat Display", "Roboto Mono", "Roboto Slab", "Rock Salt", "Rokkitt", "Ruda", "Sarabun", "Shadows Into Light", "Signika", "Silkscreen", "Sofia Sans", "Sono", "Source Code Pro", "Source Sans 3", "Space Mono", "Spectral", "Syne", "Tajawal", "Teko", "Titillium Web", "Ubuntu Mono", "Unbounded", "Urbanist", "Varela Round", "VT323", "Yanone Kaffeesatz", "Zilla Slab"];
const loadedFonts = new Set();
let fSelected = null;
function loadFont(name) {
  if (loadedFonts.has(name)) return;
  loadedFonts.add(name);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}:wght@400;700&display=swap`;
  document.head.appendChild(link);
}
function renderFontList(filter) {
  const box = $("fList");
  if (!box) return;
  const q = (filter || "").toLowerCase().trim();
  const list = GFONTS.filter((f) => f.toLowerCase().includes(q)).slice(0, 60);
  box.innerHTML = list
    .map((f) => `<div class="font-row ${fSelected === f ? "selected" : ""}" data-font="${f}"><div><div class="fname">${f}</div><div class="fmeta">Aa Bb Cc 0123</div></div><span class="muted small">›</span></div>`)
    .join("") || '<div class="empty" style="padding:24px;">Nenhuma fonte encontrada.</div>';
  box.querySelectorAll(".font-row").forEach((row) => {
    const name = row.dataset.font;
    row.addEventListener("mouseenter", () => {
      loadFont(name);
      setTimeout(() => { row.querySelector(".fname").style.fontFamily = `"${name}", sans-serif`; row.querySelector(".fmeta").style.fontFamily = `"${name}", sans-serif`; }, 400);
    });
    row.addEventListener("click", () => {
      fSelected = name;
      loadFont(name);
      fUpdate();
      renderFontList($("fSearch").value);
    });
  });
}
function fontUrl(name) { return `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}:wght@400;700&display=swap`; }
function fontCss(name, size) {
  return `.font-sample {\n  font-family: "${name}", sans-serif;\n  font-size: ${size}px;\n  font-weight: 600;\n}`;
}
function fUpdate() {
  if (!fSelected) return;
  const size = $("fSize").value;
  $("fSizeOut").textContent = size + "px";
  $("fSample").style.fontFamily = `"${fSelected}", sans-serif`;
  $("fSample2").style.fontFamily = `"${fSelected}", sans-serif`;
  $("fSample").style.fontSize = size + "px";
  const name = fSelected;
  const code = `<link href="${fontUrl(name)}" rel="stylesheet">\n\n<div class="font-sample">Aa Bb Cc 0123 — O rato roeu a roupa do rei de Roma.</div>\n\n/* CSS */\n${fontCss(name, size)}`;
  $("fCode").textContent = code;
}
if ($("fSearch")) $("fSearch").addEventListener("input", (e) => renderFontList(e.target.value));
if ($("fSize")) $("fSize").addEventListener("input", fUpdate);
if ($("fSave")) {
  $("fSave").addEventListener("click", async () => {
    if (!fSelected) { alert("Escolha uma fonte na lista primeiro."); return; }
    const name = $("fName").value.trim() || `Fonte ${fSelected}`;
    const size = $("fSize").value;
    try {
      await saveStudioComponent(name, "fonts", ["fonte", "google-fonts", "estudio"], [
        { lang: "html", code: `<link href="${fontUrl(fSelected)}" rel="stylesheet">\n\n<div class="font-sample">Aa Bb Cc 0123 — O rato roeu a roupa do rei de Roma.</div>` },
        { lang: "css", code: fontCss(fSelected, size) },
      ]);
      closeModal("studioModal");
      showHint(`💾 "${name}" salva nos componentes!`);
    } catch (e) { alert("Erro ao salvar: " + e.message); }
  });
}
renderFontList("");

// helpers de debug/teste
window.__dash = { state, detectLang, smartPaste, cmStore, lastVals };
