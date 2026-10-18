"use strict";

/**
 * Camada de armazenamento do Dashboard Caio 2.0.
 *
 * - Local (padrao): le/grava arquivos no disco (mesmo comportamento de sempre).
 * - Nuvem (Vercel): le/grava numa tabela chave-valor do Supabase, via PostgREST.
 *
 * Toda a API e assincrona para funcionar nos dois mundos.
 */

const fs = require("fs");
const path = require("path");

const LOCAL_ROOT = path.resolve(__dirname, "..", "..");
const CLOUD = process.env.STORAGE === "supabase" || !!process.env.VERCEL;

const SB_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
const SB_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";
const TABLE = process.env.SUPABASE_TABLE || "kv";
const KEY_PREFIX = "dash:";

function normalizeKey(key) {
  return String(key).replace(/\\/g, "/").replace(/^\/+/, "");
}
function localPath(key) {
  return path.join(LOCAL_ROOT, normalizeKey(key));
}

/* ---------------- Supabase (PostgREST) ---------------- */
async function sb(query, opts = {}) {
  if (!SB_URL || !SB_KEY) {
    throw new Error("Supabase nao configurado: defina SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  const res = await fetch(`${SB_URL}/rest/v1/${query}`, {
    ...opts,
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      "Content-Type": "application/json",
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${res.status}: ${text.slice(0, 220)}`);
  }
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("json") || res.status === 204) return null;
  return res.json();
}
const enc = (s) => encodeURIComponent(s);

async function cloudReadText(key) {
  const rows = await sb(`${TABLE}?select=value&key=eq.${enc(KEY_PREFIX + normalizeKey(key))}&limit=1`);
  return rows && rows[0] ? rows[0].value : null;
}
async function cloudWriteText(key, text) {
  await sb(`${TABLE}?on_conflict=key`, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      key: KEY_PREFIX + normalizeKey(key),
      value: String(text),
      updated_at: new Date().toISOString(),
    }),
  });
}
async function cloudRemove(key) {
  await sb(`${TABLE}?key=eq.${enc(KEY_PREFIX + normalizeKey(key))}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
}
async function cloudExists(key) {
  const rows = await sb(`${TABLE}?select=key&key=eq.${enc(KEY_PREFIX + normalizeKey(key))}&limit=1`);
  return !!(rows && rows.length);
}
async function cloudList(prefix) {
  const relPrefix = normalizeKey(prefix);
  const rows = await sb(`${TABLE}?select=key,value&key=like.${enc(KEY_PREFIX + relPrefix)}*`);
  const out = [];
  for (const row of rows || []) {
    const full = String(row.key || "").slice(KEY_PREFIX.length);
    if (!full.startsWith(relPrefix)) continue;
    const rel = full.slice(relPrefix.length);
    if (!rel || rel.includes("/")) continue; // apenas filhos diretos
    out.push({ name: rel, size: (row.value || "").length });
  }
  return out;
}

/* ---------------- Local (fs) ---------------- */
async function localReadText(key) {
  try {
    return fs.readFileSync(localPath(key), "utf8");
  } catch (e) {
    return null;
  }
}
async function localWriteText(key, text) {
  const p = localPath(key);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, String(text));
}
async function localRemove(key) {
  try {
    fs.unlinkSync(localPath(key));
  } catch (e) {}
}
async function localExists(key) {
  return fs.existsSync(localPath(key));
}
async function localList(prefix) {
  const dir = localPath(prefix);
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => {
        try {
          return !fs.statSync(path.join(dir, f)).isDirectory();
        } catch (e) {
          return false;
        }
      })
      .map((f) => ({ name: f, size: fs.statSync(path.join(dir, f)).size }));
  } catch (e) {
    return [];
  }
}

/* ---------------- API publica ---------------- */
module.exports = {
  isCloud: CLOUD,
  root: LOCAL_ROOT,
  normalizeKey,
  readText: CLOUD ? cloudReadText : localReadText,
  writeText: CLOUD ? cloudWriteText : localWriteText,
  remove: CLOUD ? cloudRemove : localRemove,
  exists: CLOUD ? cloudExists : localExists,
  list: CLOUD ? cloudList : localList,
  displayPath(key) {
    return CLOUD ? `${normalizeKey(key)} (Supabase)` : localPath(key);
  },
};
