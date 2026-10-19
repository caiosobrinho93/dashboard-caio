"use strict";

/* Adiciona o atalho da rede social na sidebar do painel antigo */
(function () {
  function inject() {
    document.querySelectorAll(".sidebar").forEach(function (side) {
      if (side.querySelector("[data-social-nav]")) return;
      const nav = side.querySelector(".nav-links");

      const label = document.createElement("div");
      label.className = "nav-label";
      label.setAttribute("data-social-nav", "1");
      label.textContent = "Rede social";

      const links = document.createElement("nav");
      links.className = "nav-links";
      links.setAttribute("data-social-nav", "1");
      links.innerHTML =
        '<a href="feed.html" class="nav-link"><span class="nav-ico">🏠</span><span>Feed</span></a>' +
        '<a href="communities.html" class="nav-link"><span class="nav-ico">👥</span><span>Comunidades</span></a>' +
        '<a href="people.html" class="nav-link"><span class="nav-ico">🔎</span><span>Pessoas</span></a>' +
        '<a href="profile.html" class="nav-link"><span class="nav-ico">🙂</span><span>Meu perfil</span></a>';

      if (nav && nav.parentNode) {
        nav.parentNode.insertBefore(label, nav.nextSibling);
        nav.parentNode.insertBefore(links, label.nextSibling);
      } else {
        side.appendChild(label);
        side.appendChild(links);
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", inject);
  } else {
    inject();
  }
})();
