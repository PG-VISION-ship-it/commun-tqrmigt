(function () {
  if (window.location.pathname.startsWith("/admin")) return;

  const CHATBOT_STORAGE_KEY = "tarmigt_chat_history";

  const CHATBOT_SVG = {
    chat: '<svg class="icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>',
    close: '<svg class="icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    bot: '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM9.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
  };

  const welcomeFR = "Bonjour ! Je suis l'assistant de la Commune de Tarmigt. Posez-moi vos questions sur les services, demarches ou actualites de la commune.";
  const welcomeAR = "!مرحباً، أنا مساعد بلدية تارمickt. اطرح أسئلتك حولخدمات البلدية وإجراءاتها وأخبارها";
  const placeholderFR = "Ecrivez votre message…";
  const placeholderAR = "اكتب رسالتك هنا…";

  function getLang() {
    return document.body.getAttribute("dir") === "ar" ? "ar" : "fr";
  }

  let conversation = [];
  let isOpen = false;
  let isLoading = false;

  function loadHistory() {
    try {
      const saved = sessionStorage.getItem(CHATBOT_STORAGE_KEY);
      if (saved) conversation = JSON.parse(saved);
    } catch (e) { /* ignore */ }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(CHATBOT_STORAGE_KEY, JSON.stringify(conversation));
    } catch (e) { /* ignore */ }
  }

  function buildDOM() {
    const fab = document.createElement("button");
    fab.className = "chatbot-fab";
    fab.setAttribute("aria-label", "Chat");
    fab.innerHTML = CHATBOT_SVG.chat + CHATBOT_SVG.close;

    const win = document.createElement("div");
    win.className = "chatbot-window";
    win.innerHTML = `
      <div class="chatbot-header">
        <div class="chatbot-header-avatar">${CHATBOT_SVG.bot}</div>
        <div class="chatbot-header-info">
          <h4>Assistant Tarmigt</h4>
          <span>${getLang() === "ar" ? "متصل" : "En ligne"}</span>
        </div>
      </div>
      <div class="chatbot-messages" id="chatbot-messages"></div>
      <div class="chatbot-input-area">
        <input type="text" id="chatbot-input" placeholder="${placeholderFR}" maxlength="2000" autocomplete="off">
        <button class="chatbot-send" id="chatbot-send" aria-label="Send">${CHATBOT_SVG.send}</button>
      </div>
    `;

    document.body.appendChild(fab);
    document.body.appendChild(win);

    return { fab, win, messages: win.querySelector("#chatbot-messages"), input: win.querySelector("#chatbot-input"), sendBtn: win.querySelector("#chatbot-send") };
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  function renderMessages(el) {
    const lang = getLang();
    let html = "";
    if (conversation.length === 0) {
      html = `<div class="chatbot-welcome"><strong>${lang === "ar" ? "مساعد البلدية" : "Assistant Commune"}</strong>${lang === "ar" ? welcomeAR : welcomeFR}</div>`;
    } else {
      conversation.forEach(function (m) {
        html += '<div class="chatbot-msg ' + (m.role === "user" ? "user" : "bot") + '">' + escapeHtml(m.content) + "</div>";
      });
    }
    el.innerHTML = html;
    scrollToBottom(el);
  }

  function showTyping(el) {
    var typing = document.createElement("div");
    typing.className = "chatbot-typing";
    typing.id = "chatbot-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    el.appendChild(typing);
    scrollToBottom(el);
  }

  function removeTyping() {
    var t = document.getElementById("chatbot-typing");
    if (t) t.remove();
  }

  function scrollToBottom(el) {
    requestAnimationFrame(function () {
      el.scrollTop = el.scrollHeight;
    });
  }

  function showError(el, msg) {
    var div = document.createElement("div");
    div.className = "chatbot-msg error";
    div.textContent = msg;
    el.appendChild(div);
    scrollToBottom(el);
  }

  async function sendMessage(text, dom) {
    if (isLoading || !text.trim()) return;
    isLoading = true;
    dom.sendBtn.disabled = true;
    dom.input.value = "";

    var userMsg = { role: "user", content: text.trim() };
    conversation.push(userMsg);
    saveHistory();
    renderMessages(dom.messages);
    showTyping(dom.messages);

    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation }),
      });
      var data = await res.json();
      removeTyping();

      if (!res.ok) {
        var errMsg = getLang() === "ar" ? "عذراً، حدث خطأ. حاول مرة أخرى." : "Desole, une erreur est survenue. Reessayez.";
        showError(dom.messages, data.error || errMsg);
      } else {
        var botMsg = { role: "assistant", content: data.reply };
        conversation.push(botMsg);
        saveHistory();
        renderMessages(dom.messages);
      }
    } catch (e) {
      removeTyping();
      var networkErr = getLang() === "ar" ? "خطأ في الاتصال. تحقق من شبكتك." : "Erreur de connexion. Verifiez votre reseau.";
      showError(dom.messages, networkErr);
    }

    isLoading = false;
    dom.sendBtn.disabled = false;
    dom.input.focus();
  }

  function toggleChat(dom) {
    isOpen = !isOpen;
    dom.fab.classList.toggle("open", isOpen);
    dom.win.classList.toggle("open", isOpen);
    if (isOpen) {
      dom.input.focus();
      scrollToBottom(dom.messages);
    }
  }

  function init() {
    loadHistory();
    var dom = buildDOM();

    renderMessages(dom.messages);

    dom.fab.addEventListener("click", function () {
      toggleChat(dom);
    });

    dom.sendBtn.addEventListener("click", function () {
      sendMessage(dom.input.value, dom);
    });

    dom.input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(dom.input.value, dom);
      }
    });

    document.addEventListener("langchange", function () {
      var lang = getLang();
      dom.input.placeholder = lang === "ar" ? placeholderAR : placeholderFR;
      renderMessages(dom.messages);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
