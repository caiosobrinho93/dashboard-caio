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
