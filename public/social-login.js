"use strict";

/* Entrar / criar conta na rede (Supabase Auth) */
(async function () {
  const sb = Social.sb;
  const $ = (id) => document.getElementById(id);
  const msg = $("msg");
  let mode = "login";

  function show(text, kind) {
    msg.textContent = text;
    msg.className = "social-msg show " + (kind || "err");
  }
  function hide() {
    msg.className = "social-msg";
  }

  function traduz(m) {
    const s = String(m || "");
    if (/Invalid login credentials/i.test(s)) return "E-mail ou senha incorretos.";
    if (/Email not confirmed/i.test(s)) return "Confirme seu e-mail antes de entrar (olhe a caixa de entrada).";
    if (/User already registered/i.test(s)) return "Esse e-mail ja tem conta. Use a aba Entrar.";
    if (/Password should be at least/i.test(s)) return "A senha precisa de pelo menos 6 caracteres.";
    if (/rate limit|too many/i.test(s)) return "Muitas tentativas. Espere um pouco e tente de novo.";
    return s;
  }

  // profissoes
  $("trade").innerHTML =
    '<option value="">Selecione...</option>' +
    (Social.cfg.trades || []).map((t) => "<option>" + Social.esc(t) + "</option>").join("");

  const params = new URLSearchParams(location.search);
  const next = params.get("next") || "feed.html";

  // ja logado?
  const { data } = await sb.auth.getSession();
  if (data && data.session) {
    location.replace(next);
    return;
  }

  document.querySelectorAll("#modeTabs .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      mode = btn.dataset.mode;
      document.querySelectorAll("#modeTabs .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
      $("signupFields").hidden = mode !== "signup";
      $("btnSubmit").textContent = mode === "signup" ? "Criar conta →" : "Entrar →";
      $("authSub").textContent =
        mode === "signup"
          ? "Crie sua conta para entrar na rede dos trabalhadores."
          : "Entre para ver o feed, comunidades e contatos da regiao.";
      $("pw").autocomplete = mode === "signup" ? "new-password" : "current-password";
      hide();
    });
  });

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    hide();

    const email = $("email").value.trim();
    const password = $("pw").value;
    if (!email || !password) return show("Preencha e-mail e senha.");

    $("btnSubmit").disabled = true;
    try {
      if (mode === "signup") {
        const full_name = $("name").value.trim();
        const username = $("user").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
        const trade = $("trade").value;
        const city = $("city").value.trim();

        if (full_name.length < 2) return show("Digite seu nome completo.");
        if (username.length < 3) return show("O usuario precisa de pelo menos 3 letras (a-z, 0-9, _).");
        if (password.length < 6) return show("A senha precisa de pelo menos 6 caracteres.");

        const { data: up, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: { full_name, username, trade, city } }
        });
        if (error) return show(traduz(error.message));
        if (up && up.session) {
          location.replace(next);
          return;
        }
        show("Conta criada! Confirme seu e-mail para entrar. Depois e so fazer login aqui.", "ok");
        return;
      }

      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) return show(traduz(error.message));
      location.replace(next);
    } catch (err) {
      show("Nao foi possivel conectar. Tente novamente.");
    } finally {
      $("btnSubmit").disabled = false;
    }
  });
})();
