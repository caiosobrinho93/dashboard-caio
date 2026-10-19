"use strict";

/* Pessoas — diretorio de profissionais com busca e seguir/deixar de seguir */
(async function () {
  const sb = Social.sb;
  const $ = (id) => document.getElementById(id);
  const ready = Social.authOnce();
  let following = new Set();

  /* a busca ja responde, mesmo se digitarem antes do login terminar */
  let timer = null;
  $("q").addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const ctx = await ready;
      if (!ctx) return;
      load($("q").value);
    }, 300);
  });

  const ctx = await ready;
  if (!ctx) return;

  Social.shell(ctx, {
    title: "Pessoas",
    sub: "Encontre profissionais da sua regiao",
    active: "people.html"
  });

  const grid = $("peopleGrid");
  following = new Set(await Social.myFollowingIds());

  function personCard(p) {
    const isFollowing = following.has(p.id);
    return (
      '<article class="person-card" data-id="' + p.id + '">' +
        '<span class="person-avatar">' + Social.avatarHtml(p, 46) + "</span>" +
        '<div class="person-info">' +
          '<b><a href="profile.html?id=' + p.id + '">' + Social.esc(p.full_name || "Trabalhador") + "</a></b>" +
          "<small>" + Social.esc(p.trade || "trabalhador") + (p.city ? " · " + Social.esc(p.city) : "") + "</small>" +
          (p.username ? "<small>@" + Social.esc(p.username) + "</small>" : "") +
        "</div>" +
        '<div class="person-actions">' +
          '<button class="mini-btn js-follow' + (isFollowing ? " on" : "") + '">' + (isFollowing ? "Seguindo" : "Seguir") + "</button>" +
          '<a class="mini-btn" href="profile.html?id=' + p.id + '">Perfil</a>' +
        "</div>" +
      "</article>"
    );
  }

  async function load(term) {
    let q = sb
      .from("profiles")
      .select("id,username,full_name,trade,city,avatar_url")
      .order("created_at", { ascending: false })
      .limit(60);

    const t = String(term || "").replace(/[,()%]/g, "").trim();
    if (t) {
      q = q.or(
        "full_name.ilike.%" + t + "%,trade.ilike.%" + t + "%,city.ilike.%" + t + "%,username.ilike.%" + t + "%"
      );
    }

    const { data, error } = await q;
    if (error) {
      if (Social.setupNeeded(error)) Social.showSetupBanner();
      else Social.toast(error.message, true);
      grid.innerHTML = "";
      return;
    }

    const list = (data || []).filter((p) => p.id !== ctx.user.id);
    grid.innerHTML = list.length
      ? list.map(personCard).join("")
      : '<div class="empty-state">Ninguem encontrado por aqui ainda. 👀</div>';
  }

  grid.addEventListener("click", async (e) => {
    const btn = e.target.closest(".js-follow");
    if (!btn) return;
    const id = btn.closest(".person-card").dataset.id;
    const on = btn.classList.contains("on");
    btn.disabled = true;

    const err = on ? await Social.unfollow(id) : await Social.follow(id);
    btn.disabled = false;
    if (err) return Social.toast(err.message, true);

    if (on) following.delete(id);
    else following.add(id);
    btn.classList.toggle("on", !on);
    btn.textContent = on ? "Seguir" : "Seguindo";
  });

  await load("");
})();
