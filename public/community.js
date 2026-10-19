"use strict";

/* Uma comunidade — cabecalho, entrar/sair e feed do grupo */
(async function () {
  const ctx = await Social.auth();
  if (!ctx) return;
  const sb = Social.sb;
  const $ = (id) => document.getElementById(id);
  const slug = new URLSearchParams(location.search).get("slug");

  Social.shell(ctx, { title: "Comunidade", sub: "Publicacoes do grupo", active: "communities.html" });

  if (!slug) {
    $("commHead").innerHTML = '<div class="empty-state">Comunidade nao encontrada.</div>';
    return;
  }

  const { data: comm, error } = await sb.from("communities").select("*").eq("slug", slug).maybeSingle();
  if (error || !comm) {
    if (error && Social.setupNeeded(error)) Social.showSetupBanner();
    else $("commHead").innerHTML = '<div class="empty-state">Comunidade nao encontrada. <a href="communities.html" style="color:var(--accent-2)">Ver todas</a></div>';
    return;
  }

  document.title = comm.name + " · " + Social.cfg.appName;
  $("pageTitle").textContent = comm.name;
  $("pageSub").textContent = comm.description || "Publicacoes do grupo";

  let members = await Social.countRows("community_members", "community_id", comm.id);
  let joined = false;
  const mineRes = await sb
    .from("community_members")
    .select("user_id")
    .eq("community_id", comm.id)
    .eq("user_id", ctx.user.id)
    .maybeSingle();
  joined = !!mineRes.data;

  function renderHead() {
    $("commHead").innerHTML =
      '<section class="community-hero">' +
        "<h2>👥 " + Social.esc(comm.name) + "</h2>" +
        "<p>" + Social.esc(comm.description || "Sem descricao.") + "</p>" +
        '<div class="community-foot">' +
          "<small>" + (comm.city ? Social.esc(comm.city) + " · " : "") + members + " membro(s)</small>" +
          '<button class="mini-btn ' + (joined ? "on" : "") + '" id="btnJoin">' + (joined ? "Sair da comunidade" : "Entrar na comunidade") + "</button>" +
          '<a class="mini-btn" href="communities.html">← Todas</a>' +
        "</div>" +
      "</section>";

    $("btnJoin").addEventListener("click", async () => {
      const btn = $("btnJoin");
      btn.disabled = true;
      if (joined) {
        const { error } = await sb.from("community_members").delete().eq("community_id", comm.id).eq("user_id", ctx.user.id);
        if (error) Social.toast(error.message, true);
        else { joined = false; members = Math.max(0, members - 1); }
      } else {
        const { error } = await sb.from("community_members").insert({ community_id: comm.id, user_id: ctx.user.id });
        if (error) Social.toast(error.message, true);
        else { joined = true; members += 1; }
      }
      renderHead();
    });
  }
  renderHead();

  /* composer do grupo */
  $("composerAvatar").innerHTML = Social.avatarHtml(ctx.profile, 40);
  $("composer").hidden = false;
  Social.previewFile($("postImage"), $("imgName"), $("imgPreview"));

  const feed = $("feed");
  const state = { offset: 0, limit: 10, done: false };

  async function load(reset) {
    if (reset) {
      state.offset = 0;
      state.done = false;
      feed.innerHTML = '<div class="empty-state">Carregando...</div>';
    }
    const posts = await Social.fetchPosts({ communityId: comm.id, offset: state.offset, limit: state.limit });
    if (reset) feed.innerHTML = "";

    if (!posts.length) {
      if (reset) feed.innerHTML = '<div class="empty-state">Nenhuma publicacao nessa comunidade ainda. Comece voce! 🛠️</div>';
      state.done = true;
    } else {
      feed.insertAdjacentHTML("beforeend", posts.map((p) => Social.postCard(p, ctx.user.id)).join(""));
      state.offset += posts.length;
      if (posts.length < state.limit) state.done = true;
    }
    $("btnMore").hidden = state.done;
  }

  $("btnPost").addEventListener("click", async () => {
    const text = $("postText").value.trim();
    const file = ($("postImage").files && $("postImage").files[0]) || null;
    if (!text && !file) return Social.toast("Escreva algo ou escolha uma foto.", true);

    const btn = $("btnPost");
    btn.disabled = true;
    btn.textContent = "Publicando...";
    try {
      const post = await Social.createPost({
        content: text,
        file,
        communityId: comm.id,
        community: { id: comm.id, slug: comm.slug, name: comm.name }
      });
      feed.insertAdjacentHTML("afterbegin", Social.postCard(post, ctx.user.id));
      $("postText").value = "";
      $("postImage").value = "";
      $("imgName").textContent = "";
      $("imgPreview").hidden = true;
      $("imgPreview").innerHTML = "";
      Social.toast("Publicado na comunidade! 🎉");
    } catch (e) {
      Social.toast(e.message || "Nao deu para publicar", true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Publicar";
    }
  });

  $("btnMore").addEventListener("click", () => load(false));
  Social.bindFeed(feed, ctx.user);
  await load(true);
})();
