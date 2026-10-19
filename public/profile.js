"use strict";

/* Perfil — publicacoes, seguidores, seguindo e editar perfil */
(async function () {
  const ctx = await Social.auth();
  if (!ctx) return;
  const sb = Social.sb;
  const $ = (id) => document.getElementById(id);

  Social.shell(ctx, { title: "Perfil", sub: "Informacoes do profissional", active: "profile.html" });

  const params = new URLSearchParams(location.search);
  const targetId = params.get("id");
  const targetUser = params.get("u");

  let profile = null;
  if (!targetId && !targetUser) {
    profile = ctx.profile;
  } else if (targetId) {
    const { data, error } = await sb.from("profiles").select("*").eq("id", targetId).maybeSingle();
    if (error && Social.setupNeeded(error)) Social.showSetupBanner();
    profile = data;
  } else {
    const { data, error } = await sb.from("profiles").select("*").eq("username", targetUser).maybeSingle();
    if (error && Social.setupNeeded(error)) Social.showSetupBanner();
    profile = data;
  }

  if (!profile) {
    $("profileBox").innerHTML =
      '<div class="empty-state">Perfil nao encontrado. <a href="people.html" style="color:var(--accent-2)">Ver pessoas</a></div>';
    return;
  }

  const isMe = profile.id === ctx.user.id;
  const following = new Set(await Social.myFollowingIds());
  let amFollowing = following.has(profile.id);
  let tab = "posts";
  let stats = { postsCount: 0, followersCount: 0, followingCount: 0 };

  async function refreshStats() {
    const [postsCount, followersCount, followingCount] = await Promise.all([
      Social.countRows("posts", "author", profile.id),
      Social.countRows("follows", "following_id", profile.id),
      Social.countRows("follows", "follower_id", profile.id)
    ]);
    stats = { postsCount, followersCount, followingCount };
  }

  function headHtml() {
    const cover = '<div class="profile-cover"></div>';
    const avatar = profile.avatar_url
      ? '<img src="' + Social.esc(profile.avatar_url) + '" alt="">'
      : Social.esc(Social.initials(profile.full_name));

    const actions = isMe
      ? '<button class="btn btn-ghost" id="btnEdit">✏️ Editar perfil</button>'
      : '<button class="mini-btn js-follow-profile ' + (amFollowing ? "on" : "") + '" id="btnFollowProfile">' +
          (amFollowing ? "Seguindo" : "Seguir") + "</button>";

    return (
      cover +
      '<div class="profile-card">' +
        '<div class="profile-head">' +
          '<div class="profile-avatar">' + avatar + "</div>" +
          '<div class="profile-id">' +
            "<h2>" + Social.esc(profile.full_name || "Trabalhador") + "</h2>" +
            "<p>" +
              Social.esc(profile.trade || "trabalhador") +
              (profile.city ? " · " + Social.esc(profile.city) : "") +
              (profile.username ? " · @" + Social.esc(profile.username) : "") +
            "</p>" +
            (profile.bio ? '<p class="profile-bio">' + Social.esc(profile.bio) + "</p>" : "") +
          "</div>" +
          '<div class="profile-actions">' + actions + "</div>" +
        "</div>" +
        '<div class="profile-stats">' +
          '<div><b>' + stats.postsCount + "</b><span>publicacoes</span></div>" +
          '<button type="button" data-goto="followers"><b>' + stats.followersCount + "</b><span>seguidores</span></button>" +
          '<button type="button" data-goto="following"><b>' + stats.followingCount + "</b><span>seguindo</span></button>" +
        "</div>" +
      "</div>"
    );
  }

  function personRow(p) {
    const on = following.has(p.id);
    return (
      '<div class="person-card" data-id="' + p.id + '" style="margin-bottom:10px;">' +
        "<span>" + Social.avatarHtml(p, 44) + "</span>" +
        '<div class="person-info">' +
          '<b><a href="profile.html?id=' + p.id + '">' + Social.esc(p.full_name || "Trabalhador") + "</a></b>" +
          "<small>" + Social.esc(p.trade || "trabalhador") + (p.city ? " · " + Social.esc(p.city) : "") + "</small>" +
        "</div>" +
        (p.id === ctx.user.id ? "" :
          '<div class="person-actions">' +
            '<button class="mini-btn js-follow-row' + (on ? " on" : "") + '">' + (on ? "Seguindo" : "Seguir") + "</button>" +
          "</div>") +
      "</div>"
    );
  }

  const content = $("profileContent");

  async function renderTab() {
    content.innerHTML = '<div class="empty-state">Carregando...</div>';

    if (tab === "posts") {
      const posts = await Social.fetchPosts({ authorId: profile.id, limit: 10 });
      content.innerHTML = posts.length
        ? posts.map((p) => Social.postCard(p, ctx.user.id)).join("")
        : '<div class="empty-state">Nenhuma publicacao ainda. 🛠️</div>';
      Social.bindFeed(content, ctx.user);
      return;
    }

    const column = tab === "followers" ? "following_id" : "follower_id";
    const idColumn = tab === "followers" ? "follower_id" : "following_id";
    const { data: rows, error } = await sb.from("follows").select(idColumn).eq(column, profile.id);
    if (error) {
      if (Social.setupNeeded(error)) Social.showSetupBanner();
      content.innerHTML = '<div class="empty-state">Nao deu para carregar.</div>';
      return;
    }

    const ids = (rows || []).map((r) => r[idColumn]);
    if (!ids.length) {
      content.innerHTML =
        '<div class="empty-state">' +
        (tab === "followers" ? "Nenhum seguidor ainda." : "Nao esta seguindo ninguem ainda.") +
        "</div>";
      return;
    }

    const { data: profs } = await sb
      .from("profiles")
      .select("id,username,full_name,trade,city,avatar_url")
      .in("id", ids);
    content.innerHTML = (profs || []).map(personRow).join("") || '<div class="empty-state">Nada por aqui.</div>';
  }

  function renderAll() {
    $("profileBox").innerHTML = headHtml();
    document.title = (profile.full_name || "Perfil") + " · " + Social.cfg.appName;
    $("pageTitle").textContent = isMe ? "Meu perfil" : profile.full_name || "Perfil";
    $("pageSub").textContent = (profile.trade || "trabalhador") + (profile.city ? " · " + profile.city : "");
  }

  function setTab(next) {
    tab = next;
    document.querySelectorAll("#profileTabs .seg-btn").forEach((b) => {
      b.classList.toggle("active", b.dataset.tab === tab);
    });
    renderTab();
  }

  /* clique delegado: seguir / editar / atalhos dos numeros */
  $("profileBox").addEventListener("click", async (e) => {
    const followBtn = e.target.closest(".js-follow-profile");
    const editBtn = e.target.closest("#btnEdit");
    const goto = e.target.closest("[data-goto]");

    if (goto) return setTab(goto.dataset.goto);

    if (editBtn) {
      const panel = $("editPanel");
      const open = panel.hidden;
      panel.hidden = !open;
      if (open) {
        $("eName").value = profile.full_name || "";
        $("eUser").value = profile.username || "";
        $("eCity").value = profile.city || "";
        $("eBio").value = profile.bio || "";
        $("eTrade").value = profile.trade || "";
        $("eAvatar").value = "";
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      return;
    }

    if (followBtn) {
      followBtn.disabled = true;
      const err = amFollowing ? await Social.unfollow(profile.id) : await Social.follow(profile.id);
      followBtn.disabled = false;
      if (err) return Social.toast(err.message, true);
      amFollowing = !amFollowing;
      if (amFollowing) following.add(profile.id);
      else following.delete(profile.id);
      await refreshStats();
      renderAll();
    }
  });

  /* cliques na lista de pessoas (botoes seguir das abas) */
  content.addEventListener("click", async (e) => {
    const btn = e.target.closest(".js-follow-row");
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

  /* abas */
  document.querySelectorAll("#profileTabs .seg-btn").forEach((b) => {
    b.addEventListener("click", () => setTab(b.dataset.tab));
  });

  /* editar perfil */
  $("eTrade").innerHTML =
    '<option value="">Selecione...</option>' +
    (Social.cfg.trades || []).map((t) => "<option>" + Social.esc(t) + "</option>").join("");

  $("btnCancelEdit").addEventListener("click", () => {
    $("editPanel").hidden = true;
  });

  $("btnSaveProfile").addEventListener("click", async () => {
    const btn = $("btnSaveProfile");
    btn.disabled = true;
    btn.textContent = "Salvando...";
    try {
      const patch = {
        full_name: $("eName").value.trim() || profile.full_name,
        username: $("eUser").value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") || null,
        trade: $("eTrade").value || null,
        city: $("eCity").value.trim() || null,
        bio: $("eBio").value.trim() || null
      };

      const file = $("eAvatar").files && $("eAvatar").files[0];
      if (file) patch.avatar_url = await Social.uploadPhoto(file, "avatars");

      const { data, error } = await sb.from("profiles").update(patch).eq("id", ctx.user.id).select().single();
      if (error) {
        if (/duplicate|unique/i.test(error.message || "")) throw new Error("Esse nome de usuario ja esta em uso.");
        throw error;
      }

      profile = data;
      ctx.profile = data;
      $("editPanel").hidden = true;
      Social.toast("Perfil atualizado! ✅");
      await refreshStats();
      renderAll();
      Social.shell(ctx, { title: "Meu perfil", sub: "Informacoes do profissional", active: "profile.html" });
    } catch (e) {
      Social.toast(e.message || "Nao deu para salvar", true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Salvar";
    }
  });

  await refreshStats();
  renderAll();
  await renderTab();
})();
