"use strict";

/**
 * Login simples por senha unica para o dashboard publicado.
 *
 * - Sem DASHBOARD_PASSWORD definida: login desativado (uso local).
 * - Com DASHBOARD_PASSWORD: todas as rotas /api e paginas exigem o cookie.
 * - Na nuvem (Vercel), se a senha nao estiver definida o app fica bloqueado.
 */

const crypto = require("crypto");

const PASSWORD = process.env.DASHBOARD_PASSWORD || "";
const SECRET = process.env.AUTH_SECRET || `dash-secret-${process.env.VERCEL_URL || "local"}`;
const COOKIE_NAME = "dash_auth";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 dias

function enabled() {
  return PASSWORD.length > 0;
}
function token() {
  return crypto.createHmac("sha256", SECRET).update(`dash:${PASSWORD}`).digest("hex");
}
function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function verify(req) {
  if (!enabled()) return true;
  const cookies = parseCookies(req.headers.cookie);
  const got = cookies[COOKIE_NAME];
  if (!got) return false;
  const expected = token();
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function checkPassword(pw) {
  const a = Buffer.from(String(pw == null ? "" : pw));
  const b = Buffer.from(PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function setCookie(res) {
  const secure = process.env.VERCEL ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=${token()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure}`
  );
}
function clearCookie(res) {
  res.setHeader("Set-Cookie", `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

const PUBLIC_PATHS = new Set(["/login.html", "/login", "/api/login", "/api/me", "/api/logout", "/favicon.ico"]);
const PUBLIC_ASSET = /\.(css|js|mjs|png|jpe?g|gif|svg|ico|webp|woff2?|ttf|otf|map|txt)$/i;

function middleware(req, res, next) {
  if (!enabled()) return next();
  if (verify(req)) return next();
  const p = req.path;
  if (PUBLIC_PATHS.has(p) || PUBLIC_ASSET.test(p)) return next();
  if (p.startsWith("/api/")) return res.status(401).json({ error: "nao autenticado" });
  return res.redirect("/login.html");
}

module.exports = {
  enabled,
  verify,
  checkPassword,
  setCookie,
  clearCookie,
  middleware,
};
