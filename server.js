"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const express = require("express");

const storage = require("./lib/storage");
const auth = require("./lib/auth");

const PORT = Number(process.env.PORT || 3000);
const ROOT = storage.isCloud ? storage.root : path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(ROOT, "components");
const DESIGNS_DIR = path.join(ROOT, "designs");
const BACKUP_DIR = path.join(ROOT, "backups");
const INDEX_KEY = "components/index.json";

const CATEGORIES = [
  { id: "buttons", name: "Botoes", icon: "🔘" },
  { id: "backgrounds", name: "Backgrounds animados", icon: "✨" },
  { id: "texts", name: "Textos animados", icon: "⌨️" },
  { id: "fonts", name: "Fontes", icon: "🔤" },
  { id: "colors", name: "Paletas de cores", icon: "🎨" },
  { id: "cards", name: "Cards", icon: "🃏" },
  { id: "inputs", name: "Inputs / Forms", icon: "📝" },
  { id: "loaders", name: "Loaders / Spinners", icon: "⏳" },
  { id: "navbars", name: "Navbars / Menus", icon: "🧭" },
  { id: "modals", name: "Modals / Dialogs", icon: "🪟" },
  { id: "other", name: "Outros", icon: "📦" },
];

/* ---------------- helpers ---------------- */
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function ensureDirs() {
  if (storage.isCloud) return; // na nuvem nao existe disco
  if (!fs.existsSync(COMPONENTS_DIR)) fs.mkdirSync(COMPONENTS_DIR, { recursive: true });
  for (const c of CATEGORIES) {
    const d = path.join(COMPONENTS_DIR, c.id);
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }
  if (!fs.existsSync(DESIGNS_DIR)) fs.mkdirSync(DESIGNS_DIR, { recursive: true });
  if (!fs.existsSync(path.join(ROOT, "data"))) fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  if (!fs.existsSync(path.join(ROOT, INDEX_KEY))) {
    fs.writeFileSync(path.join(ROOT, INDEX_KEY), JSON.stringify({ components: [] }, null, 2));
  }
}
ensureDirs();

async function readIndex() {
  const raw = await storage.readText(INDEX_KEY);
  if (raw == null) return { components: [] };
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.components)) data.components = [];
    return data;
  } catch (e) {
    return { components: [] };
  }
}
async function writeIndex(data) {
  await storage.writeText(INDEX_KEY, JSON.stringify(data, null, 2));
}

function slugify(s) {
  return (
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "component"
  );
}
function validateCategory(id) {
  return CATEGORIES.some((c) => c.id === id);
}
function safeFileName(name) {
  return String(name || "")
    .replace(/[\\/]+/g, "_")
    .replace(/\.\./g, "_")
    .trim();
}

function normalizeBlocks(body, existing) {
  if (Array.isArray(body.blocks)) {
    return body.blocks
      .filter((b) => b && typeof b.code === "string" && b.code.trim() !== "")
      .map((b) => ({ lang: b.lang || "html", code: b.code }));
  }
  if (typeof body.code === "string") {
    return [{ lang: body.language || (existing && existing.language) || "html", code: body.code }];
  }
  if (existing && Array.isArray(existing.blocks)) return existing.blocks;
  if (existing && existing.code) return [{ lang: existing.language || "html", code: existing.code }];
  return [];
}

async function readCompData(comp) {
  const raw = await storage.readText(comp.file);
  if (raw == null) {
    comp.blocks = [];
    comp.code = "";
  } else if (comp.file.endsWith(".json")) {
    try {
      const data = JSON.parse(raw);
      comp.blocks = Array.isArray(data.blocks) ? data.blocks : [];
      if (Array.isArray(data.tags)) comp.tags = data.tags;
    } catch (e) {
      comp.blocks = [];
    }
  } else {
    // componente legado em .txt
    comp.blocks = [{ lang: comp.language || "html", code: raw }];
    comp.code = raw;
  }
  if (!Array.isArray(comp.blocks)) comp.blocks = [];
  if (!comp.blocks.length && comp.code) comp.blocks = [{ lang: comp.language || "html", code: comp.code }];
  comp.code = comp.blocks.length ? comp.blocks[0].code : "";
  comp.language = comp.blocks.length ? comp.blocks[0].lang : comp.language || "html";
  return comp;
}

/* ---------------- store de dados (notes, tasks, etc.) ---------------- */
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
async function readStore(name, fallback) {
  const raw = await storage.readText("data/" + name);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return fallback;
  }
}
async function writeStore(name, data) {
  await storage.writeText("data/" + name, JSON.stringify(data, null, 2));
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

/* ---------------- XP / conquistas ---------------- */
const ACHIEVEMENTS = [
  { id: "first_component", name: "Primeiro passo", icon: "🌱", desc: "Salvou seu primeiro componente" },
  { id: "components_10", name: "Colecionador", icon: "📦", desc: "10 componentes no vault" },
  { id: "components_50", name: "Arquiteto", icon: "🏗️", desc: "50 componentes no vault" },
  { id: "components_100", name: "Lendario", icon: "👑", desc: "100 componentes no vault" },
  { id: "first_design", name: "Designer", icon: "📐", desc: "Gerou o primeiro design.md" },
  { id: "designs_5", name: "Diretor de arte", icon: "🎬", desc: "5 designs.md gerados" },
  { id: "first_note", name: "Ideia no papel", icon: "📝", desc: "Criou a primeira nota" },
  { id: "notes_10", name: "Mural cheio", icon: "🗒️", desc: "10 notas criadas" },
  { id: "first_task", name: "Planejador", icon: "✅", desc: "Criou a primeira tarefa" },
  { id: "tasks_done_10", name: "Maquina de fazer", icon: "⚡", desc: "Concluiu 10 tarefas" },
  { id: "first_pomodoro", name: "Foco total", icon: "🍅", desc: "Completou o primeiro pomodoro" },
  { id: "pomodoros_10", name: "Modo turbo", icon: "🚀", desc: "10 pomodoros completos" },
  { id: "streak_3", name: "Constancia", icon: "🔥", desc: "3 dias seguidos ativo" },
  { id: "streak_7", name: "Semana perfeita", icon: "💎", desc: "7 dias seguidos ativo" },
  { id: "first_goal", name: "Meta batida", icon: "🎯", desc: "Completou uma meta de economia" },
];

const XP_TABLE = {
  component: 10,
  component_update: 5,
  design: 30,
  note: 3,
  task: 5,
  task_done: 8,
  pomodoro: 15,
  goal_add: 10,
};

function defaultProfile() {
  return { xp: 0, counters: {}, achievements: {}, lastActive: null, streakDays: 0 };
}
async function loadProfile() {
  const p = (await readStore("profile.json", null)) || defaultProfile();
  if (!p.counters) p.counters = {};
  if (!p.achievements) p.achievements = {};
  return p;
}
async function saveProfile(p) {
  await writeStore("profile.json", p);
}
async function countDesigns() {
  const list = await storage.list("designs/");
  return list.filter((f) => f.name.endsWith(".md")).length;
}
async function checkAchievements(p) {
  const unlocked = [];
  const compCount = (await readIndex()).components.length;
  const notes = (await readStore("notes.json", { items: [] })).items || [];
  const tasks = (await readStore("tasks.json", { items: [] })).items || [];
  const goals = (await readStore("goals.json", { items: [] })).items || [];
  const designs = await countDesigns();
  const c = p.counters;
  const conds = {
    first_component: compCount >= 1,
    components_10: compCount >= 10,
    components_50: compCount >= 50,
    components_100: compCount >= 100,
    first_design: designs >= 1,
    designs_5: designs >= 5,
    first_note: notes.length >= 1,
    notes_10: (c.note || 0) >= 10,
    first_task: tasks.length >= 1,
    tasks_done_10: (c.task_done || 0) >= 10,
    first_pomodoro: (c.pomodoro || 0) >= 1,
    pomodoros_10: (c.pomodoro || 0) >= 10,
    streak_3: (p.streakDays || 0) >= 3,
    streak_7: (p.streakDays || 0) >= 7,
    first_goal: goals.some((g) => g.achieved),
  };
  for (const a of ACHIEVEMENTS) {
    if (conds[a.id] && !p.achievements[a.id]) {
      p.achievements[a.id] = new Date().toISOString();
      unlocked.push(a);
    }
  }
  return unlocked;
}
function touchStreak(p) {
  const t = today();
  if (p.lastActive === t) return;
  const y = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  p.streakDays = p.lastActive === y ? (p.streakDays || 0) + 1 : 1;
  p.lastActive = t;
}
async function awardXp(reason) {
  const amount = XP_TABLE[reason] || 0;
  const p = await loadProfile();
  p.xp = (p.xp || 0) + amount;
  p.counters[reason] = (p.counters[reason] || 0) + 1;
  touchStreak(p);
  const unlocked = await checkAchievements(p);
  await saveProfile(p);
  return { amount, unlocked };
}
async function profilePayload() {
  const p = await loadProfile();
  const level = 1 + Math.floor((p.xp || 0) / 100);
  return {
    xp: p.xp || 0,
    level,
    xpInLevel: (p.xp || 0) % 100,
    xpNeeded: 100,
    streakDays: p.streakDays || 0,
    lastActive: p.lastActive,
    counters: p.counters,
    achievements: ACHIEVEMENTS.map((a) => ({ ...a, unlockedAt: p.achievements[a.id] || null })),
  };
}

/* ---------------- app ---------------- */
const app = express();
app.use(express.json({ limit: "5mb" }));

// bloqueio de seguranca: na nuvem sem senha configurada ninguem entra
app.use((req, res, next) => {
  if (storage.isCloud && !auth.enabled()) {
    if (req.path.startsWith("/api/")) {
      return res.status(503).json({ error: "Dashboard bloqueado: defina DASHBOARD_PASSWORD na Vercel." });
    }
    return res.status(503).type("text/plain").send("Dashboard bloqueado: defina DASHBOARD_PASSWORD na Vercel.");
  }
  next();
});
app.use(auth.middleware);

/* ---------------- login ---------------- */
app.get("/api/me", (req, res) => {
  if (!auth.enabled() || auth.verify(req)) return res.json({ authed: true, authEnabled: auth.enabled() });
  return res.status(401).json({ authed: false });
});
app.post("/api/login", (req, res) => {
  if (!auth.enabled()) return res.json({ ok: true });
  if (!auth.checkPassword((req.body || {}).password)) {
    return res.status(401).json({ error: "Senha incorreta" });
  }
  auth.setCookie(res);
  res.json({ ok: true });
});
app.post("/api/logout", (_req, res) => {
  auth.clearCookie(res);
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, "public")));

/* ---------------- categorias ---------------- */
app.get(
  "/api/categories",
  wrap(async (_req, res) => {
    const idx = await readIndex();
    const counts = {};
    for (const c of idx.components) counts[c.category] = (counts[c.category] || 0) + 1;
    res.json(CATEGORIES.map((c) => ({ ...c, count: counts[c.id] || 0 })));
  })
);

/* ---------------- componentes ---------------- */
app.get(
  "/api/components",
  wrap(async (req, res) => {
    const idx = await readIndex();
    let list = idx.components.map((c) => ({ ...c }));
    const cat = req.query.category;
    const q = (req.query.q || "").toString().toLowerCase().trim();
    if (cat) list = list.filter((c) => c.category === cat);
    if (q) {
      list = list.filter(
        (c) =>
          (c.name || "").toLowerCase().includes(q) ||
          (c.tags || []).join(" ").toLowerCase().includes(q) ||
          (c.language || "").toLowerCase().includes(q)
      );
    }
    const sort = req.query.sort || "recent";
    list = list.slice().sort((a, b) => {
      if (sort === "recent" || sort === "popular")
        return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
      if (sort === "oldest") return String(a.createdAt || "").localeCompare(String(b.createdAt || ""));
      if (sort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
      if (sort === "name_desc") return String(b.name || "").localeCompare(String(a.name || ""));
      return 0;
    });
    const limit = Math.min(Math.max(Number(req.query.limit) || 24, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const total = list.length;
    const page = list.slice(offset, offset + limit);
    res.json({ items: page, total, offset, limit, hasMore: offset + limit < total });
  })
);

app.get(
  "/api/components/:id",
  wrap(async (req, res) => {
    const idx = await readIndex();
    const comp = idx.components.find((c) => c.id === req.params.id);
    if (!comp) return res.status(404).json({ error: "Nao encontrado" });
    res.json(await readCompData({ ...comp }));
  })
);

app.post(
  "/api/components",
  wrap(async (req, res) => {
    const { name, category, code, language, tags, blocks } = req.body || {};
    if (!name || !category) return res.status(400).json({ error: "name e category obrigatorios" });
    if (!validateCategory(category)) return res.status(400).json({ error: "categoria invalida" });
    const idx = await readIndex();
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const slug = slugify(name);
    const relFile = `components/${category}/${slug}-${id}.json`;
    const nb = normalizeBlocks({ blocks, code, language }, null);
    const comp = {
      id,
      name: String(name).trim(),
      category,
      language: nb.length ? nb[0].lang : language || "html",
      tags: Array.isArray(tags)
        ? tags.map(String)
        : tags
        ? String(tags)
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      blocks: nb,
      file: relFile,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await storage.writeText(
      relFile,
      JSON.stringify({ name: comp.name, category: comp.category, tags: comp.tags, blocks: comp.blocks }, null, 2)
    );
    idx.components.push(comp);
    await writeIndex(idx);
    await awardXp("component");
    res.json(await readCompData({ ...comp }));
  })
);

app.put(
  "/api/components/:id",
  wrap(async (req, res) => {
    const idx = await readIndex();
    const i = idx.components.findIndex((c) => c.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "Nao encontrado" });
    const comp = idx.components[i];
    const { name, category, code, language, tags, blocks } = req.body || {};
    if (category && !validateCategory(category)) return res.status(400).json({ error: "categoria invalida" });
    const newCat = category || comp.category;
    const nb = normalizeBlocks({ blocks, code, language }, comp);
    const nextTags =
      tags !== undefined
        ? Array.isArray(tags)
          ? tags.map(String)
          : String(tags)
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
        : comp.tags;
    const payload = JSON.stringify(
      { name: name || comp.name, category: newCat, tags: nextTags, blocks: nb },
      null,
      2
    );

    let newFile = comp.file;
    if (category && category !== comp.category) {
      newFile = `components/${category}/${slugify(name || comp.name)}-${comp.id}.json`;
      await storage.writeText(newFile, payload);
      await storage.remove(comp.file);
    } else if (!comp.file.endsWith(".json")) {
      newFile = `components/${comp.category}/${slugify(name || comp.name)}-${comp.id}.json`;
      await storage.writeText(newFile, payload);
      await storage.remove(comp.file);
    } else {
      await storage.writeText(comp.file, payload);
    }

    if (name !== undefined) comp.name = String(name).trim();
    comp.category = newCat;
    comp.file = newFile;
    comp.blocks = nb;
    comp.language = nb.length ? nb[0].lang : language || comp.language || "html";
    if (tags !== undefined) comp.tags = nextTags;
    comp.updatedAt = new Date().toISOString();
    idx.components[i] = comp;
    await writeIndex(idx);
    await awardXp("component_update");
    res.json(await readCompData({ ...comp }));
  })
);

app.delete(
  "/api/components/:id",
  wrap(async (req, res) => {
    const idx = await readIndex();
    const i = idx.components.findIndex((c) => c.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: "Nao encontrado" });
    const comp = idx.components[i];
    await storage.remove(comp.file);
    idx.components.splice(i, 1);
    await writeIndex(idx);
    res.json({ ok: true });
  })
);

/* ---------------- gerar design.md ---------------- */
app.post(
  "/api/generate",
  wrap(async (req, res) => {
    const { selectedIds = [], projectName = "Meu Projeto", description = "" } = req.body || {};
    const idx = await readIndex();
    let selected = idx.components;
    selected = selected.filter((c) => selectedIds.includes(c.id));
    const byCat = {};
    for (const c of selected) {
      if (!byCat[c.category]) byCat[c.category] = [];
      const comp = await readCompData({ ...c });
      const code = (comp.blocks || [])
        .map((b) => `### ${b.lang}\n\n\`\`\`${b.lang}\n${b.code}\n\`\`\``)
        .join("\n\n");
      byCat[c.category].push({ ...comp, code });
    }
    const catName = (id) => (CATEGORIES.find((c) => c.id === id) || { name: id }).name;
    const lines = [];
    lines.push(`# Design System — ${projectName}`);
    lines.push("");
    lines.push(`> Gerado em ${new Date().toISOString()} pelo Design Vault.`);
    lines.push("");
    if (description) {
      lines.push("## Visao geral");
      lines.push("");
      lines.push(description);
      lines.push("");
    }
    lines.push("## Como usar");
    lines.push("");
    lines.push("Este documento descreve o design system escolhido. A IA deve seguir estas especificacoes ao criar o app.");
    lines.push("");

    if (byCat.colors && byCat.colors.length) {
      lines.push("## Paletas de cores");
      lines.push("");
      for (const c of byCat.colors) {
        lines.push(`### ${c.name}`);
        lines.push("");
        lines.push(c.code);
        lines.push("");
      }
    }
    if (byCat.fonts && byCat.fonts.length) {
      lines.push("## Fontes");
      lines.push("");
      for (const c of byCat.fonts) {
        lines.push(`### ${c.name}`);
        lines.push("");
        lines.push(c.code);
        lines.push("");
      }
    }
    const otherCats = Object.keys(byCat).filter((k) => k !== "colors" && k !== "fonts");
    for (const cat of otherCats) {
      lines.push(`## ${catName(cat)}`);
      lines.push("");
      for (const c of byCat[cat]) {
        lines.push(`### ${c.name}`);
        if (c.tags && c.tags.length) lines.push(`_tags: ${c.tags.join(", ")}_`);
        lines.push("");
        lines.push(c.code);
        lines.push("");
      }
    }
    lines.push("## Regras de estilo");
    lines.push("");
    lines.push("- Use os componentes acima como base; mantenha consistencia visual.");
    lines.push("- Respeite as paletas de cores e fontes definidas.");
    lines.push("- Mantenha acessibilidade (contraste, foco visivel, semantica).");
    lines.push("");
    const content = lines.join("\n");
    const safeName = slugify(projectName) || "design";
    const fileName = `${safeName}-design.md`;
    const key = `designs/${fileName}`;
    await storage.writeText(key, content);
    await awardXp("design");
    res.json({ fileName, path: storage.displayPath(key), content });
  })
);

app.get(
  "/api/designs",
  wrap(async (_req, res) => {
    const list = await storage.list("designs/");
    res.json(list.filter((f) => f.name.endsWith(".md")).map((f) => ({ name: f.name })));
  })
);

/* ---------------- financas ---------------- */
const FINANCES_KEY = "data/finances.json";
async function readFinances() {
  const raw = await storage.readText(FINANCES_KEY);
  if (raw == null) return { items: [] };
  try {
    const d = JSON.parse(raw);
    if (!Array.isArray(d.items)) d.items = [];
    return d;
  } catch (e) {
    return { items: [] };
  }
}
async function writeFinances(d) {
  await storage.writeText(FINANCES_KEY, JSON.stringify(d, null, 2));
}

app.get(
  "/api/finances",
  wrap(async (_req, res) => res.json((await readFinances()).items))
);
app.post(
  "/api/finances",
  wrap(async (req, res) => {
    const { type, amount, description, date } = req.body || {};
    if (!type || !amount) return res.status(400).json({ error: "type e amount obrigatorios" });
    const d = await readFinances();
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type,
      amount: Number(amount),
      description: description || "",
      date: date || new Date().toISOString().slice(0, 10),
      createdAt: new Date().toISOString(),
    };
    d.items.unshift(item);
    await writeFinances(d);
    res.json(item);
  })
);
app.delete(
  "/api/finances/:id",
  wrap(async (req, res) => {
    const d = await readFinances();
    d.items = d.items.filter((i) => i.id !== req.params.id);
    await writeFinances(d);
    res.json({ ok: true });
  })
);

/* ---------------- backup ---------------- */
app.get(
  "/api/backup",
  wrap(async (_req, res) => {
    const files = await storage.list("backups/");
    res.json(files.map((f) => ({ name: f.name, size: f.size })));
  })
);
app.post(
  "/api/backup",
  wrap(async (req, res) => {
    const { name, content } = req.body || {};
    if (!name) return res.status(400).json({ error: "name obrigatorio" });
    await storage.writeText("backups/" + safeFileName(name), content || "");
    res.json({ ok: true });
  })
);
app.delete(
  "/api/backup/:name",
  wrap(async (req, res) => {
    await storage.remove("backups/" + safeFileName(req.params.name));
    res.json({ ok: true });
  })
);

/* ---------------- arquivos (somente local) ---------------- */
function safePath(rel) {
  const abs = path.resolve(ROOT, rel || "");
  if (!abs.startsWith(path.resolve(ROOT))) return null;
  return abs;
}
app.get("/api/files", (req, res) => {
  if (storage.isCloud) {
    return res.status(501).json({
      error:
        "O explorador de arquivos funciona apenas na versao local (no PC). Na nuvem ele fica indisponivel.",
    });
  }
  const rel = req.query.path || "";
  const abs = safePath(rel);
  if (!abs) return res.status(400).json({ error: "caminho invalido" });
  if (!fs.existsSync(abs)) return res.status(404).json({ error: "nao encontrado" });
  const stat = fs.statSync(abs);
  if (stat.isDirectory()) {
    const entries = fs.readdirSync(abs).map((f) => {
      const s = fs.statSync(path.join(abs, f));
      return { name: f, type: s.isDirectory() ? "dir" : "file", size: s.size };
    });
    res.json({ type: "dir", path: rel, entries });
  } else {
    let content = "";
    try {
      content = fs.readFileSync(abs, "utf8");
    } catch (e) {
      content = "";
    }
    res.json({ type: "file", path: rel, content, size: stat.size });
  }
});

/* ---------------- perfil / xp ---------------- */
app.get(
  "/api/profile",
  wrap(async (_req, res) => res.json(await profilePayload()))
);
app.post(
  "/api/ping",
  wrap(async (_req, res) => {
    const p = await loadProfile();
    touchStreak(p);
    const unlocked = await checkAchievements(p);
    await saveProfile(p);
    res.json({ ...(await profilePayload()), unlockedNow: unlocked });
  })
);
app.post(
  "/api/pomodoro/complete",
  wrap(async (_req, res) => {
    const award = await awardXp("pomodoro");
    res.json({ ok: true, award, profile: await profilePayload() });
  })
);

/* ---------------- notas ---------------- */
app.get(
  "/api/notes",
  wrap(async (_req, res) => res.json((await readStore("notes.json", { items: [] })).items))
);
app.post(
  "/api/notes",
  wrap(async (req, res) => {
    const { text, color, x, y } = req.body || {};
    if (!text || !String(text).trim()) return res.status(400).json({ error: "text obrigatorio" });
    const store = await readStore("notes.json", { items: [] });
    const item = {
      id: uid(),
      text: String(text).trim(),
      color: color || "violet",
      x: Number(x) || 0,
      y: Number(y) || 0,
      createdAt: new Date().toISOString(),
    };
    store.items.unshift(item);
    await writeStore("notes.json", store);
    const award = await awardXp("note");
    res.json({ ...item, award });
  })
);
app.put(
  "/api/notes/:id",
  wrap(async (req, res) => {
    const store = await readStore("notes.json", { items: [] });
    const n = store.items.find((i) => i.id === req.params.id);
    if (!n) return res.status(404).json({ error: "nao encontrada" });
    const { text, color, x, y } = req.body || {};
    if (text !== undefined) n.text = String(text).trim();
    if (color !== undefined) n.color = color;
    if (x !== undefined) n.x = Number(x);
    if (y !== undefined) n.y = Number(y);
    await writeStore("notes.json", store);
    res.json(n);
  })
);
app.delete(
  "/api/notes/:id",
  wrap(async (req, res) => {
    const store = await readStore("notes.json", { items: [] });
    store.items = store.items.filter((i) => i.id !== req.params.id);
    await writeStore("notes.json", store);
    res.json({ ok: true });
  })
);

/* ---------------- tarefas ---------------- */
app.get(
  "/api/tasks",
  wrap(async (_req, res) => res.json((await readStore("tasks.json", { items: [] })).items))
);
app.post(
  "/api/tasks",
  wrap(async (req, res) => {
    const { title, due } = req.body || {};
    if (!title || !String(title).trim()) return res.status(400).json({ error: "title obrigatorio" });
    const store = await readStore("tasks.json", { items: [] });
    const item = {
      id: uid(),
      title: String(title).trim(),
      due: due || "",
      done: false,
      createdAt: new Date().toISOString(),
      doneAt: null,
    };
    store.items.unshift(item);
    await writeStore("tasks.json", store);
    const award = await awardXp("task");
    res.json({ ...item, award });
  })
);
app.put(
  "/api/tasks/:id",
  wrap(async (req, res) => {
    const store = await readStore("tasks.json", { items: [] });
    const t = store.items.find((i) => i.id === req.params.id);
    if (!t) return res.status(404).json({ error: "nao encontrada" });
    const { title, due, done } = req.body || {};
    const wasDone = t.done;
    if (title !== undefined) t.title = String(title).trim();
    if (due !== undefined) t.due = due;
    if (done !== undefined) {
      t.done = !!done;
      t.doneAt = done ? new Date().toISOString() : null;
    }
    await writeStore("tasks.json", store);
    let award = null;
    if (!wasDone && t.done) award = await awardXp("task_done");
    res.json({ ...t, award });
  })
);
app.delete(
  "/api/tasks/:id",
  wrap(async (req, res) => {
    const store = await readStore("tasks.json", { items: [] });
    store.items = store.items.filter((i) => i.id !== req.params.id);
    await writeStore("tasks.json", store);
    res.json({ ok: true });
  })
);

/* ---------------- eventos ---------------- */
app.get(
  "/api/events",
  wrap(async (_req, res) => res.json((await readStore("events.json", { items: [] })).items))
);
app.post(
  "/api/events",
  wrap(async (req, res) => {
    const { date, title } = req.body || {};
    if (!date || !title) return res.status(400).json({ error: "date e title obrigatorios" });
    const store = await readStore("events.json", { items: [] });
    const item = { id: uid(), date, title: String(title).trim(), createdAt: new Date().toISOString() };
    store.items.push(item);
    await writeStore("events.json", store);
    res.json(item);
  })
);
app.delete(
  "/api/events/:id",
  wrap(async (req, res) => {
    const store = await readStore("events.json", { items: [] });
    store.items = store.items.filter((i) => i.id !== req.params.id);
    await writeStore("events.json", store);
    res.json({ ok: true });
  })
);

/* ---------------- metas ---------------- */
app.get(
  "/api/goals",
  wrap(async (_req, res) => res.json((await readStore("goals.json", { items: [] })).items))
);
app.post(
  "/api/goals",
  wrap(async (req, res) => {
    const { name, target, saved } = req.body || {};
    if (!name || !target) return res.status(400).json({ error: "name e target obrigatorios" });
    const store = await readStore("goals.json", { items: [] });
    const item = {
      id: uid(),
      name: String(name).trim(),
      target: Number(target),
      saved: Number(saved) || 0,
      achieved: false,
      achievedAt: null,
      createdAt: new Date().toISOString(),
    };
    if (item.saved >= item.target) {
      item.achieved = true;
      item.achievedAt = new Date().toISOString();
    }
    store.items.push(item);
    await writeStore("goals.json", store);
    res.json(item);
  })
);
app.put(
  "/api/goals/:id",
  wrap(async (req, res) => {
    const store = await readStore("goals.json", { items: [] });
    const g = store.items.find((i) => i.id === req.params.id);
    if (!g) return res.status(404).json({ error: "meta nao encontrada" });
    const { name, target, add } = req.body || {};
    if (name !== undefined) g.name = String(name).trim();
    if (target !== undefined) g.target = Number(target);
    let award = null;
    if (add !== undefined && Number(add) > 0) {
      g.saved = Number(g.saved || 0) + Number(add);
      award = await awardXp("goal_add");
    }
    if (!g.achieved && g.saved >= g.target) {
      g.achieved = true;
      g.achievedAt = new Date().toISOString();
    }
    await writeStore("goals.json", store);
    res.json({ ...g, award });
  })
);
app.delete(
  "/api/goals/:id",
  wrap(async (req, res) => {
    const store = await readStore("goals.json", { items: [] });
    store.items = store.items.filter((i) => i.id !== req.params.id);
    await writeStore("goals.json", store);
    res.json({ ok: true });
  })
);

/* ---------------- gastos fixos ---------------- */
app.get(
  "/api/recurring",
  wrap(async (_req, res) => res.json((await readStore("recurring.json", { items: [] })).items))
);
app.post(
  "/api/recurring",
  wrap(async (req, res) => {
    const { name, amount, day } = req.body || {};
    if (!name || !amount) return res.status(400).json({ error: "name e amount obrigatorios" });
    const store = await readStore("recurring.json", { items: [] });
    const item = {
      id: uid(),
      name: String(name).trim(),
      amount: Number(amount),
      day: Number(day) || 1,
      createdAt: new Date().toISOString(),
    };
    store.items.push(item);
    await writeStore("recurring.json", store);
    res.json(item);
  })
);
app.put(
  "/api/recurring/:id",
  wrap(async (req, res) => {
    const store = await readStore("recurring.json", { items: [] });
    const r = store.items.find((i) => i.id === req.params.id);
    if (!r) return res.status(404).json({ error: "nao encontrado" });
    const { name, amount, day } = req.body || {};
    if (name !== undefined) r.name = String(name).trim();
    if (amount !== undefined) r.amount = Number(amount);
    if (day !== undefined) r.day = Number(day);
    await writeStore("recurring.json", store);
    res.json(r);
  })
);
app.delete(
  "/api/recurring/:id",
  wrap(async (req, res) => {
    const store = await readStore("recurring.json", { items: [] });
    store.items = store.items.filter((i) => i.id !== req.params.id);
    await writeStore("recurring.json", store);
    res.json({ ok: true });
  })
);

/* ---------------- QR / URL publica ---------------- */
app.get("/api/lan-url", (_req, res) => {
  if (storage.isCloud) {
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
    return res.json({ url: host ? `https://${host}` : "", ip: null });
  }
  const ifaces = os.networkInterfaces();
  let ip = null;
  for (const name of Object.keys(ifaces)) {
    for (const info of ifaces[name] || []) {
      if (info.family === "IPv4" && !info.internal) {
        ip = info.address;
        break;
      }
    }
    if (ip) break;
  }
  res.json({ url: ip ? `http://${ip}:${PORT}` : `http://localhost:${PORT}`, ip });
});

/* ---------------- erros ---------------- */
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "erro interno" });
});

/* ---------------- boot ---------------- */
if (require.main === module && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Design Vault em http://localhost:${PORT}`);
    console.log(`  armazenamento: ${storage.isCloud ? "Supabase (nuvem)" : "disco local"}`);
    if (auth.enabled()) console.log("  login: ativado (DASHBOARD_PASSWORD definido)");
  });
}

module.exports = app;
