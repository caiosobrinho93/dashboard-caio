"use strict";

/**
 * Importa componentes do React Bits para o vault local.
 * Uso: node scripts/import-reactbits.js
 * Requer o servidor rodando em http://localhost:3000.
 */

const API = process.env.API_URL || "http://localhost:3000";

const ITEMS = [
  { slug: "SwipeRow", name: "Swipe Row", category: "other", tags: ["reactbits", "micro", "swipe", "lista", "gesto"] },
  { slug: "CircularCarousel", name: "Circular Carousel", category: "other", tags: ["reactbits", "carousel", "3d", "neon"] },
  { slug: "DepthCarousel", name: "Depth Carousel", category: "other", tags: ["reactbits", "carousel", "profundidade", "3d"] },
  { slug: "Lightning", name: "Lightning", category: "backgrounds", tags: ["reactbits", "background", "neon", "raio", "canvas"] },
  { slug: "LightRays", name: "Light Rays", category: "backgrounds", tags: ["reactbits", "background", "neon", "raios", "shader"] },
  { slug: "ProfileCard", name: "Profile Card", category: "cards", tags: ["reactbits", "card", "perfil", "neon", "3d"] },
  { slug: "CardNav", name: "Card Nav", category: "navbars", tags: ["reactbits", "nav", "menu", "cards", "neon"] },
  { slug: "ReflectiveCard", name: "Reflective Card", category: "cards", tags: ["reactbits", "card", "reflexo", "vidro", "neon"] },
  { slug: "SoftAurora", name: "Soft Aurora", category: "backgrounds", tags: ["reactbits", "background", "aurora", "neon", "shader"] },
];

async function importOne(item) {
  const url = `https://reactbits.dev/r/${item.slug}-JS-CSS.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`registry ${res.status}`);
  const data = await res.json();
  const files = data.files || [];

  const main = files.find((f) => /\.(jsx|tsx|js|ts)$/.test(f.path) && !/demo/i.test(f.path));
  const css = files.find((f) => /\.css$/.test(f.path));
  if (!main) throw new Error("arquivo principal nao encontrado");

  const blocks = [{ lang: "jsx", code: main.content }];
  if (css) blocks.push({ lang: "css", code: css.content });

  const payload = {
    name: item.name,
    category: item.category,
    tags: item.tags,
    blocks,
  };
  const save = await fetch(`${API}/api/components`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!save.ok) {
    const err = await save.text();
    throw new Error(`salvar ${save.status}: ${err.slice(0, 140)}`);
  }
  const comp = await save.json();
  return { name: comp.name, category: comp.category, bytes: main.content.length + (css ? css.content.length : 0) };
}

(async () => {
  let ok = 0;
  for (const item of ITEMS) {
    try {
      const r = await importOne(item);
      ok++;
      console.log(`OK  ${r.name}  (${r.category}, ${Math.round(r.bytes / 1024)} KB)`);
    } catch (e) {
      console.error(`ERRO ${item.name}: ${e.message}`);
    }
  }
  console.log(`\n${ok}/${ITEMS.length} componentes salvos no vault.`);
  if (ok !== ITEMS.length) process.exit(1);
})();
