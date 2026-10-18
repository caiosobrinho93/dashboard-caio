"use strict";
const fs = require("fs");
const path = require("path");
const ROOT = path.resolve(__dirname, "..");
const COMPONENTS_DIR = path.join(ROOT, "components");
const INDEX_FILE = path.join(COMPONENTS_DIR, "index.json");

const seeds = [
  {
    name: "Botao primario",
    category: "buttons",
    language: "html",
    tags: ["button", "primary", "gradient"],
    code: `<button class="btn-primary">
  Clique aqui
</button>

<style>
.btn-primary {
  padding: 12px 24px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(135deg, #7c5cff, #00d4aa);
  color: #fff;
  font-weight: 600;
  cursor: pointer;
  transition: transform .15s, box-shadow .15s;
}
.btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(124,92,255,.35); }
</style>`,
  },
  {
    name: "Background gradiente animado",
    category: "backgrounds",
    language: "css",
    tags: ["background", "animated", "gradient"],
    code: `.animated-bg {
  min-height: 100vh;
  background: linear-gradient(270deg, #7c5cff, #00d4aa, #ff5c7a, #7c5cff);
  background-size: 800% 800%;
  animation: gradientShift 12s ease infinite;
}
@keyframes gradientShift {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}`,
  },
  {
    name: "Texto digitando (typewriter)",
    category: "texts",
    language: "js",
    tags: ["text", "animated", "typewriter"],
    code: `<h1 id="typewriter"></h1>
<script>
const phrases = ["Design Vault", "Componentes reutilizaveis", "Gere seu design.md"];
let i = 0, j = 0, deleting = false;
const el = document.getElementById("typewriter");
function tick() {
  const current = phrases[i];
  el.textContent = deleting ? current.slice(0, j--) : current.slice(0, j++);
  if (!deleting && j > current.length) { deleting = true; setTimeout(tick, 1200); return; }
  if (deleting && j < 0) { deleting = false; i = (i + 1) % phrases.length; j = 0; }
  setTimeout(tick, deleting ? 60 : 100);
}
tick();
</script>`,
  },
  {
    name: "Paleta Neon",
    category: "colors",
    language: "css",
    tags: ["palette", "neon", "colors"],
    code: `:root {
  --color-bg: #0a0a0f;
  --color-primary: #7c5cff;
  --color-secondary: #00d4aa;
  --color-accent: #ff5c7a;
  --color-text: #e6e8ef;
  --color-muted: #8a90a8;
  --color-border: #2a3045;
}`,
  },
  {
    name: "Inter (Google Fonts)",
    category: "fonts",
    language: "html",
    tags: ["font", "google", "inter"],
    code: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">

<style>
body { font-family: "Inter", system-ui, sans-serif; }
</style>`,
  },
  {
    name: "Card glassmorphism",
    category: "cards",
    language: "html",
    tags: ["card", "glass", "blur"],
    code: `<div class="glass-card">
  <h3>Titulo</h3>
  <p>Conteudo do card com efeito glass.</p>
</div>

<style>
.glass-card {
  background: rgba(255,255,255,.08);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,.15);
  border-radius: 14px;
  padding: 20px;
  color: #fff;
}
</style>`,
  },
  {
    name: "Spinner",
    category: "loaders",
    language: "css",
    tags: ["loader", "spinner", "animated"],
    code: `.spinner {
  width: 40px; height: 40px;
  border: 4px solid rgba(255,255,255,.15);
  border-top-color: #7c5cff;
  border-radius: 50%;
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }`,
  },
];

function slugify(s) {
  return String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "component";
}

const idx = { components: [] };
for (const s of seeds) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const slug = slugify(s.name);
  const relFile = path.join("components", s.category, `${slug}-${id}.txt`).replace(/\\/g, "/");
  const absFile = path.join(ROOT, relFile);
  fs.mkdirSync(path.dirname(absFile), { recursive: true });
  fs.writeFileSync(absFile, s.code, "utf8");
  idx.components.push({
    id,
    name: s.name,
    category: s.category,
    language: s.language,
    tags: s.tags,
    file: relFile,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
}
fs.writeFileSync(INDEX_FILE, JSON.stringify(idx, null, 2));
console.log("Seeded", idx.components.length, "components");
