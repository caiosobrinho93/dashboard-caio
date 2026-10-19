"use strict";

/* Comunidades — listar, criar, entrar/sair */
(async function () {
  const ctx = await Social.auth();
  if (!ctx) return;
  const sb = Social.sb;
  const $ = (id) => document.getElementById(id);

  Social.shell(ctx, {
    title: "Comunidades",
    sub: "Grupos por profissao, cidade ou assunto",
    active: "communities.html"
  });

  const grid = $("commGrid");

  function slugify(name) {
    return (
      String(name)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40) || "grupo"
    );
  }

  async function load() {
    const { data: comms, error } = await sb.from("communities").select("*").order("created_at", { ascending: true });
    if (error) {
      if (Social.setupNeeded(error)) Social.showSetupBanner();
      else Social.toast(error.message, true);
      return;
    }

    const ids = (comms || []).map((c) => c.id);
    const [countRes, myRes] = await Promise.all([
      Social.selectIn("community_members", "community_id", "community_id", ids),
      sb.from("community_members").select("community_id").eq("user_id", ctx.user.id)
    ]);

    const counts = {};
    (countRes.data || []).forEach((m) => { counts[m.community_id] = (counts[m.community_id] || 0) + 1; });
    const mine = new Set((myRes.data || []).map((m) => m.community_id));

    grid.innerHTML = (comms || []).length
      ? comms
          .map(
            (c) =>
              '<article class="community-card" data-id="' + c.id + '">' +
                '<span class="community-ico">👥</span>' +
                "<b>" + Social.esc(c.name) + "</b>" +
                "<p>" + Social.esc(c.description || "Sem descricao.") + "</p>" +
                '<div class="community-foot">' +
                  "<small>" + (c.city ? Social.esc(c.city) + " · " : "") + (counts[c.id] || 0) + " membro(s)</small>" +
                  '<span style="display:flex;gap:6px;">' +
                    '<button class="mini-btn js-join' + (mine.has(c.id) ? " on" : "") + '">' + (mine.has(c.id) ? "Sair" : "Entrar") + "</button>" +
                    '<a class="mini-btn" href="community.html?slug=' + encodeURIComponent(c.slug) + '">Abrir</a>' +
                  "</span>" +
                "</div>" +
              "</article>"
          )
          .join("")
      : '<div class="empty-state">Nenhuma comunidade ainda. Crie a primeira! 👥</div>';
  }

  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest(".js-join");
    if (!btn) return;
    const id = btn.closest(".community-card").dataset.id;
    const joined = btn.classList.contains("on");
    btn.disabled = true;

    if (joined) {
      const { error } = await sb.from("community_members").delete().eq("community_id", id).eq("user_id", ctx.user.id);
      if (error) Social.toast(error.message, true);
    } else {
      const { error } = await sb.from("community_members").insert({ community_id: id, user_id: ctx.user.id });
      if (error) Social.toast(error.message, true);
    }
    btn.disabled = false;
    await load();
  });

  $("btnCreateComm").addEventListener("click", async () => {
    const name = $("cName").value.trim();
    if (name.length < 3) return Social.toast("Digite um nome com pelo menos 3 letras.", true);

    const base = slugify(name);
    let slug = base;
    for (let i = 0; i < 3; i++) {
      const { data: exists } = await sb.from("communities").select("id").eq("slug", slug).maybeSingle();
      if (!exists) break;
      slug = base + "-" + Math.random().toString(36).slice(2, 6);
    }

    const { data: created, error } = await sb
      .from("communities")
      .insert({
        slug,
        name,
        description: $("cDesc").value.trim() || null,
        city: $("cCity").value.trim() || null,
        created_by: ctx.user.id
      })
      .select()
      .single();

    if (error) {
      if (Social.setupNeeded(error)) Social.showSetupBanner();
      else Social.toast("Nao deu para criar: " + error.message, true);
      return;
    }

    await sb.from("community_members").insert({ community_id: created.id, user_id: ctx.user.id, role: "admin" });
    $("cName").value = "";
    $("cDesc").value = "";
    $("cCity").value = "";
    Social.toast("Comunidade criada! 🎉");
    await load();
  });

  await load();
})();
