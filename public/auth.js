/* Converte rotas aninhadas (/api/recurso/id) em rota plana (/api/dyn?p=recurso/id),
   necessaria para funcionar na Vercel (funcao serverless cobre /api/* com 1 segmento). */
(function () {
  if (!window.fetch) return;
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.slice(0, 5) === "/api/") {
      var q = input.indexOf("?");
      var path = q >= 0 ? input.slice(0, q) : input;
      var query = q >= 0 ? input.slice(q + 1) : "";
      var parts = path.split("/").filter(function (p) { return p.length > 0; });
      if (parts.length > 2) {
        var rest = parts.slice(1).join("/");
        input = "/api/dyn?p=" + encodeURIComponent(rest) + (query ? "&" + query : "");
      }
    }
    return origFetch(input, init);
  };
})();

(async function () {
  try {
    const res = await fetch("/api/me", { headers: { Accept: "application/json" } });
    if (res.status === 401 || res.status === 503) {
      location.replace("/login.html");
    }
  } catch (e) {
    // offline: deixa a pagina seguir o fluxo normal
  }
})();
