"use strict";

/* Feed principal — todos / seguindo / meus posts + composer */
(async function () {
  const ctx = await Social.auth();
  if (!ctx) return;
  const sb = Social.sb;
  const $ = (id) => document.getElementById(id);

  Social.shell(ctx, {
    title: "Feed",
    sub: "O que os profissionais da regiao estao compartilhando",
    active: "feed.html"
  });

  const feed = $("feed");
  const state = { filter: "all", offset: 0, limit: 10, done: false, following: [] };

  $("composerAvatar").innerHTML = Social.avatarHtml(ctx.profile, 40);
  $("composer").hidden = false;

  /* comunidades que eu participo -> select */
  let myCommunities = [];
  try {
    const { data: mems } = await sb.from("community_members").select("community_id").eq("user_id", ctx.user.id);
    const ids = (mems || []).map((m) => m.community_id);
    if (ids.length) {
      const { data: comms } = await sb.from("communities").select("id,slug,name").in("id", ids).order("name");
      myCommunities = comms || [];
    }
  } catch (e) {}
  $("postCommunity").innerHTML =
    '<option value="">Sem comunidade</option>' +
    myCommunities.map((c) => '<option value="' + c.id + '">' + Social.esc(c.name) + "</option>").join("");

  /* composer */
  Social.previewFile($("postImage"), $("imgName"), $("imgPreview"));

  $("btnPost").addEventListener("click", async () => {
    const text = $("postText").value.trim();
    const file = ($("postImage").files && $("postImage").files[0]) || null;
    if (!text && !file) return Social.toast("Escreva algo ou escolha uma foto.", true);

    const btn = $("btnPost");
    btn.disabled = true;
    btn.textContent = "Publicando...";
    try {
      const communityId = $("postCommunity").value || null;
      const community = myCommunities.find((c) => c.id === communityId) || null;
      const post = await Social.createPost({ content: text, file, communityId, community });
      feed.insertAdjacentHTML("afterbegin", Social.postCard(post, ctx.user.id));
      $("postText").value = "";
      $("postImage").value = "";
      $("imgName").textContent = "";
      $("imgPreview").hidden = true;
      $("imgPreview").innerHTML = "";
      Social.toast("Publicado! 🎉");
    } catch (e) {
      Social.toast(e.message || "Nao deu para publicar", true);
    } finally {
      btn.disabled = false;
      btn.textContent = "Publicar";
    }
  });

  /* feed */
  async function load(reset) {
    if (reset) {
      state.offset = 0;
      state.done = false;
      feed.innerHTML = '<div class="empty-state">Carregando...</div>';
    }

    let posts = [];
    if (state.filter === "mine") {
      posts = await Social.fetchPosts({ authorId: ctx.user.id, offset: state.offset, limit: state.limit });
    } else if (state.filter === "following") {
      posts = await Social.fetchPosts({ authorIds: state.following, offset: state.offset, limit: state.limit });
    } else {
      posts = await Social.fetchPosts({ offset: state.offset, limit: state.limit });
    }

    if (reset) feed.innerHTML = "";

    if (!posts.length) {
      if (reset) {
        feed.innerHTML =
          '<div class="empty-state">' +
          (state.filter === "following"
            ? 'Voce ainda nao segue ninguem. Va em <a href="people.html" style="color:var(--accent-2)">Pessoas</a> e siga os colegas 👥'
            : 'Nada por aqui ainda. Seja o primeiro a publicar! 🛠️') +
          "</div>";
      }
      state.done = true;
    } else {
      feed.insertAdjacentHTML("beforeend", posts.map((p) => Social.postCard(p, ctx.user.id)).join(""));
      state.offset += posts.length;
      if (posts.length < state.limit) state.done = true;
    }
    $("btnMore").hidden = state.done;
  }

  document.querySelectorAll("#feedTabs .seg-btn").forEach((b) => {
    b.addEventListener("click", async () => {
      document.querySelectorAll("#feedTabs .seg-btn").forEach((x) => x.classList.toggle("active", x === b));
      state.filter = b.dataset.filter;
      if (state.filter === "following") state.following = await Social.myFollowingIds();
      load(true);
    });
  });

  $("btnMore").addEventListener("click", () => load(false));

  Social.bindFeed(feed, ctx.user);
  await load(true);
})();
