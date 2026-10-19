"use strict";

/* ============================================================
   Social — biblioteca compartilhada da rede
   (Supabase: perfis, posts, comunidades, comentarios, curtidas)
   ============================================================ */

window.Social = (function () {
  const cfg = window.SOCIAL_CONFIG || {};
  const appName = cfg.appName || "Rede";

  const sb = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true }
  });

  let current = { user: null, profile: null };

  /* ---------------- helpers ---------------- */
  const esc = (s) =>
    String(s == null ? "" : s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));

  function initials(name) {
    const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
    const a = (parts[0] || "?")[0] || "?";
    const b = parts[1] ? parts[1][0] : "";
    return (a + b).toUpperCase();
  }

  function timeAgo(iso) {
    const t = new Date(iso).getTime();
    if (!t) return "";
    const s = Math.floor((Date.now() - t) / 1000);
    if (s < 60) return "agora";
    if (s < 3600) return Math.floor(s / 60) + " min";
    if (s < 86400) return Math.floor(s / 3600) + " h";
    if (s < 604800) return Math.floor(s / 86400) + " d";
    return new Date(iso).toLocaleDateString("pt-BR");
  }

  function avatarHtml(profile, size) {
    const p = profile || {};
    const s = size || 40;
    if (p.avatar_url) {
      return `<img class="s-avatar" style="width:${s}px;height:${s}px" src="${esc(p.avatar_url)}" alt="" loading="lazy">`;
    }
    return `<span class="s-avatar s-avatar-ini" style="width:${s}px;height:${s}px;font-size:${Math.round(s * 0.38)}px">${esc(initials(p.full_name))}</span>`;
  }

  function linkify(text) {
    return String(text).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  }

  function toast(msg, isError) {
    let stack = document.querySelector(".s-toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "s-toast-stack";
      document.body.appendChild(stack);
    }
    const item = document.createElement("div");
    item.className = "s-toast" + (isError ? " err" : "");
    item.textContent = msg;
    stack.appendChild(item);
    setTimeout(() => {
      item.classList.add("out");
      setTimeout(() => item.remove(), 320);
    }, 3600);
  }

  function setupNeeded(error) {
    if (!error) return false;
    const msg = String(error.message || "");
    return error.code === "42P01" || error.code === "PGRST205" || /does not exist/i.test(msg) || /schema cache/i.test(msg);
  }

  function showSetupBanner() {
    if (document.querySelector(".setup-banner")) return;
    const box = document.createElement("div");
    box.className = "setup-banner";
    box.innerHTML =
      "<b>⚠️ Banco da rede ainda nao configurado.</b><br>" +
      "Rode o arquivo <code>supabase/social.sql</code> no SQL Editor do Supabase e recarregue esta pagina.";
    const target = document.querySelector(".page-inner") || document.querySelector(".page") || document.body;
    target.prepend(box);
  }

  async function selectIn(table, cols, column, ids, extra) {
    if (!ids || !ids.length) return { data: [], error: null };
    let q = sb.from(table).select(cols).in(column, ids);
    if (extra) q = extra(q);
    return await q;
  }

  /* ---------------- autenticacao ---------------- */
  async function auth() {
    const { data } = await sb.auth.getSession();
    if (!data || !data.session) {
      const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
      location.replace("social-login.html?next=" + next);
      return null;
    }
    const user = data.session.user;
    const { data: profile, error } = await sb.from("profiles").select("*").eq("id", user.id).single();

    if (error && setupNeeded(error)) showSetupBanner();

    if (!profile && !(error && setupNeeded(error))) {
      const meta = user.user_metadata || {};
      const uname = String(meta.username || (user.email || "user").split("@")[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "");
      const { data: made } = await sb
        .from("profiles")
        .insert({
          id: user.id,
          full_name: meta.full_name || uname || "Trabalhador",
          username: uname || null,
          trade: meta.trade || null,
          city: meta.city || null
        })
        .select()
        .single();
      current = { user, profile: made };
      return current;
    }

    current = { user, profile };
    return current;
  }

  async function signOut() {
    try { await sb.auth.signOut(); } catch (e) {}
    location.replace("social-login.html");
  }

  function user() { return current.user; }
  function me() { return current.profile; }

  /* ---------------- casca (sidebar + topbar) ---------------- */
  const NAV = [
    { href: "feed.html", icon: "🏠", label: "Feed" },
    { href: "communities.html", icon: "👥", label: "Comunidades" },
    { href: "people.html", icon: "🔎", label: "Pessoas" },
    { href: "profile.html", icon: "🙂", label: "Meu perfil" }
  ];

  function shell(ctx, opts) {
    opts = opts || {};
    const prof = (ctx && ctx.profile) || {};
    const active = opts.active || "";

    const side = document.getElementById("sideNav");
    if (side) {
      const avatarBig = prof.avatar_url
        ? `<img src="${esc(prof.avatar_url)}" alt="">`
        : esc(initials(prof.full_name));
      side.innerHTML =
        '<div class="brand">' +
          '<span class="brand-icon">🛠️</span>' +
          "<div><h1>" + esc(appName) + "</h1><p>rede social</p></div>" +
        "</div>" +
        '<div class="nav-label">Rede</div>' +
        '<nav class="nav-links">' +
          NAV.map(
            (n) =>
              '<a href="' + n.href + '" class="nav-link' + (active === n.href ? " active" : "") + '">' +
              '<span class="nav-ico">' + n.icon + "</span><span>" + n.label + "</span></a>"
          ).join("") +
        "</nav>" +
        '<div class="nav-label">Painel</div>' +
        '<nav class="nav-links">' +
          '<a href="index.html" class="nav-link"><span class="nav-ico">📊</span><span>Meu painel</span></a>' +
        "</nav>" +
        '<div class="side-profile">' +
          '<div class="sp-top">' +
            '<div class="sp-avatar">' + avatarBig + "<span></span></div>" +
            '<div class="sp-id"><b>' + esc(prof.full_name || "Trabalhador") + "</b>" +
              "<small>" + esc(prof.trade || "trabalhador") + (prof.city ? " · " + esc(prof.city) : "") + "</small></div>" +
            '<button class="sp-logout" id="btnSignOut" title="Sair">sair</button>' +
          "</div>" +
          '<div class="sp-foot"><span class="pc-online"><i></i> online</span><a href="profile.html">ver perfil →</a></div>' +
        "</div>";
      const out = side.querySelector("#btnSignOut");
      if (out) out.addEventListener("click", signOut);
    }

    if (opts.title) {
      const h = document.getElementById("pageTitle");
      if (h) h.textContent = opts.title;
    }
    if (opts.sub) {
      const p = document.getElementById("pageSub");
      if (p) p.textContent = opts.sub;
    }

    const actions = document.getElementById("topActions");
    if (actions) {
      actions.innerHTML =
        '<a class="btn btn-ghost s-user-chip" href="profile.html">' + avatarHtml(prof, 24) +
        "<span>" + esc(String(prof.full_name || "Perfil").split(" ")[0]) + "</span></a>" +
        '<button class="btn btn-ghost" id="topSignOut">Sair</button>';
      const out2 = actions.querySelector("#topSignOut");
      if (out2) out2.addEventListener("click", signOut);
    }

    document.title = (opts.title ? opts.title + " · " : "") + appName;
  }

  /* ---------------- posts ---------------- */
  async function hydratePosts(posts) {
    if (!posts || !posts.length) return posts || [];

    const postIds = posts.map((p) => p.id);
    const communityIds = [...new Set(posts.map((p) => p.community_id).filter(Boolean))];

    const [likesRes, commentsRes, commRes] = await Promise.all([
      selectIn("likes", "post_id,user_id", "post_id", postIds),
      selectIn("comments", "*", "post_id", postIds, (q) => q.order("created_at", { ascending: true })),
      selectIn("communities", "id,slug,name", "id", communityIds)
    ]);

    const likes = likesRes.data || [];
    const comments = commentsRes.data || [];
    const commById = {};
    (commRes.data || []).forEach((c) => { commById[c.id] = c; });

    const profileIds = [...new Set(posts.map((p) => p.author).concat(comments.map((c) => c.author)))];
    const profRes = await selectIn("profiles", "id,username,full_name,trade,city,avatar_url", "id", profileIds);
    const profById = {};
    (profRes.data || []).forEach((p) => { profById[p.id] = p; });

    const likesByPost = {};
    likes.forEach((l) => { (likesByPost[l.post_id] = likesByPost[l.post_id] || []).push(l); });
    const commentsByPost = {};
    comments.forEach((c) => {
      c.author_profile = profById[c.author];
      (commentsByPost[c.post_id] = commentsByPost[c.post_id] || []).push(c);
    });

    posts.forEach((p) => {
      p.author_profile = profById[p.author];
      p.likes = likesByPost[p.id] || [];
      p.comments = commentsByPost[p.id] || [];
      p.community = p.community_id ? commById[p.community_id] : null;
    });

    const firstError = likesRes.error || commentsRes.error || commRes.error || profRes.error;
    if (firstError && setupNeeded(firstError)) showSetupBanner();

    return posts;
  }

  async function fetchPosts(opts) {
    opts = opts || {};
    const limit = opts.limit || 10;
    if (opts.authorIds && !opts.authorIds.length) return [];
    let q = sb.from("posts").select("*").order("created_at", { ascending: false });
    if (opts.communityId) q = q.eq("community_id", opts.communityId);
    if (opts.authorId) q = q.eq("author", opts.authorId);
    if (opts.authorIds) q = q.in("author", opts.authorIds);
    const offset = typeof opts.offset === "number" ? opts.offset : 0;
    q = q.range(offset, offset + limit - 1);

    const { data, error } = await q;
    if (error) {
      if (setupNeeded(error)) showSetupBanner();
      else toast(error.message, true);
      return [];
    }
    return await hydratePosts(data || []);
  }

  function commentHtml(c, viewerId) {
    const a = c.author_profile || {};
    return (
      '<div class="comment" data-id="' + c.id + '">' +
        '<span class="comment-avatar">' + avatarHtml(a, 30) + "</span>" +
        '<div class="comment-body">' +
          '<a class="comment-author" href="profile.html?id=' + esc(c.author) + '">' + esc(a.full_name || "Trabalhador") + "</a> " +
          '<span class="comment-text">' + esc(c.content) + "</span>" +
          '<span class="comment-time">' + timeAgo(c.created_at) + "</span>" +
        "</div>" +
        (c.author === viewerId ? '<button class="icon-btn js-del-comment" title="Excluir comentario">✕</button>' : "") +
      "</div>"
    );
  }

  function postCard(post, viewerId) {
    const a = post.author_profile || {};
    const likes = post.likes || [];
    const comments = post.comments || [];
    const liked = likes.some((l) => l.user_id === viewerId);
    const mine = post.author === viewerId;
    const sub = [a.trade, a.city].filter(Boolean).join(" · ");

    return (
      '<article class="post-card" data-id="' + post.id + '">' +
        '<header class="post-head">' +
          '<a class="post-avatar" href="profile.html?id=' + esc(post.author) + '">' + avatarHtml(a, 46) + "</a>" +
          '<div class="post-meta">' +
            '<a class="post-author" href="profile.html?id=' + esc(post.author) + '">' + esc(a.full_name || "Trabalhador") + "</a>" +
            '<span class="post-sub">' + esc(sub) + (sub ? " · " : "") + timeAgo(post.created_at) + "</span>" +
            (post.community
              ? '<a class="post-community" href="community.html?slug=' + esc(post.community.slug) + '">em ' + esc(post.community.name) + "</a>"
              : "") +
          "</div>" +
          (mine ? '<button class="icon-btn js-del-post" title="Excluir publicacao">🗑</button>' : "") +
        "</header>" +
        (post.content ? '<p class="post-text">' + linkify(esc(post.content)) + "</p>" : "") +
        (post.image_url ? '<img class="post-img" src="' + esc(post.image_url) + '" alt="" loading="lazy">' : "") +
        '<div class="post-actions">' +
          '<button class="post-action js-like' + (liked ? " liked" : "") + '" data-liked="' + (liked ? 1 : 0) + '">' +
            (liked ? "❤️" : "🤍") + ' <span class="js-like-count">' + likes.length + "</span></button>" +
          '<button class="post-action js-toggle-comments">💬 <span class="js-comment-count">' + comments.length + "</span></button>" +
          (post.community ? '<span class="post-action post-time">👥 ' + esc(post.community.name) + "</span>" : "") +
        "</div>" +
        '<div class="post-comments"' + (comments.length ? "" : " hidden") + ">" +
          '<div class="comment-list">' + comments.map((c) => commentHtml(c, viewerId)).join("") + "</div>" +
          '<form class="comment-form">' +
            '<input class="comment-input" placeholder="Escreva um comentario..." maxlength="500" />' +
            '<button class="btn btn-primary" type="submit">Enviar</button>' +
          "</form>" +
        "</div>" +
      "</article>"
    );
  }

  function renderPosts(container, posts, viewerId) {
    container.innerHTML = posts.length
      ? posts.map((p) => postCard(p, viewerId)).join("")
      : '<div class="empty-state">Nada por aqui ainda. Seja o primeiro a publicar! 🛠️</div>';
  }

  function bumpCount(card, selector, delta) {
    const el = card.querySelector(selector);
    if (!el) return;
    el.textContent = Math.max(0, Number(el.textContent || 0) + delta);
  }

  function previewFile(input, nameEl, previewEl) {
    if (!input) return;
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) {
        if (nameEl) nameEl.textContent = "";
        if (previewEl) { previewEl.hidden = true; previewEl.innerHTML = ""; }
        return;
      }
      if (nameEl) nameEl.textContent = file.name;
      if (previewEl) {
        previewEl.hidden = false;
        previewEl.innerHTML = '<img src="' + URL.createObjectURL(file) + '" alt="">';
      }
    });
  }

  async function toggleLike(card, postId, viewerId) {
    const btn = card.querySelector(".js-like");
    const liked = btn.dataset.liked === "1";
    if (liked) {
      const { error } = await sb.from("likes").delete().eq("post_id", postId).eq("user_id", viewerId);
      if (error) return toast(error.message, true);
    } else {
      const { error } = await sb.from("likes").insert({ post_id: postId, user_id: viewerId });
      if (error) return toast(error.message, true);
    }
    btn.dataset.liked = liked ? "0" : "1";
    btn.classList.toggle("liked", !liked);
    btn.innerHTML = (liked ? "🤍" : "❤️") + ' <span class="js-like-count">' + (Number(btn.querySelector(".js-like-count").textContent) + (liked ? -1 : 1)) + "</span>";
  }

  function bindFeed(container, viewer) {
    if (!container || container.dataset.bound === "1") return;
    container.dataset.bound = "1";
    const viewerId = viewer.id;

    container.addEventListener("click", async (e) => {
      const card = e.target.closest(".post-card");
      if (!card) return;
      const postId = card.dataset.id;

      if (e.target.closest(".js-like")) return void (await toggleLike(card, postId, viewerId));

      if (e.target.closest(".js-toggle-comments")) {
        const box = card.querySelector(".post-comments");
        box.hidden = !box.hidden;
        if (!box.hidden) {
          const input = box.querySelector(".comment-input");
          if (input) input.focus();
        }
        return;
      }

      if (e.target.closest(".js-del-post")) {
        if (!confirm("Excluir esta publicacao?")) return;
        const { error } = await sb.from("posts").delete().eq("id", postId);
        if (error) return toast(error.message, true);
        card.classList.add("removing");
        setTimeout(() => card.remove(), 200);
        toast("Publicacao excluida");
        return;
      }

      if (e.target.closest(".js-del-comment")) {
        const row = e.target.closest(".comment");
        const { error } = await sb.from("comments").delete().eq("id", row.dataset.id);
        if (error) return toast(error.message, true);
        row.remove();
        bumpCount(card, ".js-comment-count", -1);
      }
    });

    container.addEventListener("submit", async (e) => {
      const form = e.target.closest(".comment-form");
      if (!form) return;
      e.preventDefault();
      const card = form.closest(".post-card");
      const input = form.querySelector(".comment-input");
      const text = input.value.trim();
      if (!text) return;

      const { data, error } = await sb
        .from("comments")
        .insert({ post_id: card.dataset.id, author: viewerId, content: text })
        .select()
        .single();
      if (error) return toast(error.message, true);

      data.author_profile = current.profile;
      form.querySelector(".comment-list").insertAdjacentHTML("beforeend", commentHtml(data, viewerId));
      input.value = "";
      bumpCount(card, ".js-comment-count", 1);
    });
  }

  /* ---------------- criar post / upload ---------------- */
  async function uploadPhoto(file, bucket) {
    const ext = String((file.name || "").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = current.user.id + "/" + Date.now() + "." + ext;
    const { error } = await sb.storage.from(bucket).upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) throw error;
    return sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }

  async function createPost(opts) {
    opts = opts || {};
    let imageUrl = null;
    if (opts.file) imageUrl = await uploadPhoto(opts.file, "posts");
    const { data, error } = await sb
      .from("posts")
      .insert({
        author: current.user.id,
        content: (opts.content || "").trim(),
        image_url: imageUrl,
        community_id: opts.communityId || null
      })
      .select()
      .single();
    if (error) throw error;
    data.author_profile = current.profile;
    data.likes = [];
    data.comments = [];
    if (opts.community) data.community = opts.community;
    return data;
  }

  /* ---------------- contagens e seguir ---------------- */
  async function countRows(table, column, value) {
    const { count, error } = await sb.from(table).select("*", { count: "exact", head: true }).eq(column, value);
    if (error) {
      if (setupNeeded(error)) showSetupBanner();
      return 0;
    }
    return count || 0;
  }

  async function follow(targetId) {
    const { error } = await sb.from("follows").insert({ follower_id: current.user.id, following_id: targetId });
    if (error && !/duplicate/i.test(error.message || "")) return error;
    return null;
  }

  async function unfollow(targetId) {
    const { error } = await sb.from("follows").delete().eq("follower_id", current.user.id).eq("following_id", targetId);
    return error || null;
  }

  async function myFollowingIds() {
    const { data, error } = await sb.from("follows").select("following_id").eq("follower_id", current.user.id);
    if (error) return [];
    return (data || []).map((f) => f.following_id);
  }

  return {
    cfg,
    sb,
    esc,
    initials,
    timeAgo,
    avatarHtml,
    linkify,
    toast,
    setupNeeded,
    showSetupBanner,
    selectIn,
    auth,
    signOut,
    user,
    me,
    shell,
    fetchPosts,
    hydratePosts,
    postCard,
    renderPosts,
    bindFeed,
    previewFile,
    uploadPhoto,
    createPost,
    countRows,
    follow,
    unfollow,
    myFollowingIds
  };
})();
