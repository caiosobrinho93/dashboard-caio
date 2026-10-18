// Notificacoes nativas do Windows + toasts de conquista
window.DashNotify = function (title, body) {
  try {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body: body || "" });
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(title, { body: body || "" });
      });
    }
  } catch (e) {}
};

window.DashAskNotify = function () {
  try {
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
  } catch (e) {}
};

window.DashToast = function (award) {
  if (!award || !Array.isArray(award.unlocked) || !award.unlocked.length) return;
  let stack = document.querySelector(".toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.className = "toast-stack";
    document.body.appendChild(stack);
  }
  for (const a of award.unlocked) {
    const t = document.createElement("div");
    t.className = "toast-ach";
    t.innerHTML = `<div class="t-ico">${a.icon}</div><div><div class="t-title">Conquista desbloqueada</div><div class="t-name">${a.name}</div><div class="t-desc">${a.desc}</div></div>`;
    stack.appendChild(t);
    setTimeout(() => {
      t.classList.add("bye");
      setTimeout(() => t.remove(), 450);
    }, 4200);
  }
};
