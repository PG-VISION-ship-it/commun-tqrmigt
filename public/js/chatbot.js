(function () {
  if (window.location.pathname.startsWith("/admin")) return;

  var CHATBOT_STORAGE_KEY = "tarmigt_chat_history";

  var I18N_CHAT = {
    fr: {
      title: "Assistant Tarmigt",
      status: "En ligne",
      welcome_title: "Assistant Commune",
      welcome_msg:
        "Bonjour ! Je suis l'assistant de la Commune de Tarmigt. Posez-moi vos questions sur les services, demarches ou actualites de la commune.",
      placeholder: "Ecrivez votre message…",
      send: "Envoyer",
      error_api:
        "Le service de chat n'est pas configure. Ajoutez votre cle API OpenAI dans le fichier .env.",
      error_network: "Erreur de connexion. Verifiez votre reseau.",
      error_generic: "Desole, une erreur est survenue. Reessayez.",
      typing_label: "ecrit…",
      suggestions: [
        "Quels services propose la commune ?",
        "Quelles sont les dernieres actualites ?",
        "Comment obtenir un extrait de naissance ?",
        "Quels sont vos horaires d'ouverture ?",
      ],
      clear: "Nouvelle conversation",
    },
    ar: {
      title: "مساعد ترميكت",
      status: "متصل",
      welcome_title: "مساعد الجماعة",
      welcome_msg:
        "!مرحباً، أنا مساعد جماعة ترميكت. اطرح أسئلتك حول الخدمات والمساطر وأخبار الجماعة",
      placeholder: "اكتب رسالتك هنا…",
      send: "إرسال",
      error_api:
        "خدمة الدردشة غير مهيأة. أضف مفتاح OpenAI API في ملف .env.",
      error_network: "خطأ في الاتصال. تحقق من شبكتك.",
      error_generic: "عذراً، حدث خطأ. حاول مرة أخرى.",
      typing_label: "يكتب…",
      suggestions: [
        "ما هي الخدمات التي تقدمها الجماعة؟",
        "ما هي آخر الأخبار؟",
        "كيف أحصل على مستخرج من رسم الولادة؟",
        "ما هي ساعات الاستقبال؟",
      ],
      clear: "محادثة جديدة",
    },
  };

  var SVG = {
    chat: '<svg class="icon-chat" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/></svg>',
    close: '<svg class="icon-close" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>',
    bot: '<svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2zM9.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm5 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></svg>',
    clear: '<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>',
  };

  function getLang() {
    return document.body.getAttribute("dir") === "ar" ? "ar" : "fr";
  }

  function getStrings() {
    return I18N_CHAT[getLang()] || I18N_CHAT.fr;
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }

  var conversation = [];
  var isOpen = false;
  var isLoading = false;

  function loadHistory() {
    try {
      var saved = sessionStorage.getItem(CHATBOT_STORAGE_KEY);
      if (saved) conversation = JSON.parse(saved);
    } catch (e) {
      /* ignore */
    }
  }

  function saveHistory() {
    try {
      sessionStorage.setItem(
        CHATBOT_STORAGE_KEY,
        JSON.stringify(conversation)
      );
    } catch (e) {
      /* ignore */
    }
  }

  function buildDOM() {
    var lang = getLang();
    var s = getStrings();

    var fab = document.createElement("button");
    fab.className = "chatbot-fab";
    fab.setAttribute("aria-label", s.send);
    fab.innerHTML = SVG.chat + SVG.close;

    var win = document.createElement("div");
    win.className = "chatbot-window";
    win.setAttribute("role", "dialog");
    win.setAttribute("aria-label", s.title);
    win.innerHTML =
      '<div class="chatbot-header">' +
      '<div class="chatbot-header-avatar">' +
      SVG.bot +
      "</div>" +
      '<div class="chatbot-header-info">' +
      "<h4>" +
      escapeHtml(s.title) +
      "</h4>" +
      "<span>" +
      escapeHtml(s.status) +
      "</span>" +
      "</div>" +
      "</div>" +
      '<div class="chatbot-messages" id="chatbot-messages"></div>' +
      '<div class="chatbot-suggestions" id="chatbot-suggestions"></div>' +
      '<div class="chatbot-input-area">' +
      '<input type="text" id="chatbot-input" placeholder="' +
      escapeHtml(s.placeholder) +
      '" maxlength="2000" autocomplete="off">' +
      '<button class="chatbot-send" id="chatbot-send" aria-label="' +
      escapeHtml(s.send) +
      '">' +
      SVG.send +
      "</button>" +
      "</div>";

    document.body.appendChild(fab);
    document.body.appendChild(win);

    return {
      fab: fab,
      win: win,
      messages: win.querySelector("#chatbot-messages"),
      suggestions: win.querySelector("#chatbot-suggestions"),
      input: win.querySelector("#chatbot-input"),
      sendBtn: win.querySelector("#chatbot-send"),
    };
  }

  function renderSuggestions(el) {
    var s = getStrings();
    var html = "";
    s.suggestions.forEach(function (q) {
      html +=
        '<button class="chatbot-suggestion" type="button">' +
        escapeHtml(q) +
        "</button>";
    });
    el.innerHTML = html;
    el.querySelectorAll(".chatbot-suggestion").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (!isLoading) sendMessage(btn.textContent, window._chatDom);
      });
    });
  }

  function renderMessages(el) {
    var lang = getLang();
    var s = getStrings();
    var html = "";

    if (conversation.length === 0) {
      html =
        '<div class="chatbot-welcome">' +
        "<strong>" +
        escapeHtml(s.welcome_title) +
        "</strong>" +
        escapeHtml(s.welcome_msg) +
        "</div>";
    } else {
      conversation.forEach(function (m) {
        var cls = m.role === "user" ? "user" : "bot";
        html +=
          '<div class="chatbot-msg ' +
          cls +
          '">' +
          escapeHtml(m.content) +
          "</div>";
      });
    }
    el.innerHTML = html;
    scrollToBottom(el);
  }

  function showTyping(el) {
    var s = getStrings();
    var typing = document.createElement("div");
    typing.className = "chatbot-typing";
    typing.id = "chatbot-typing";
    typing.innerHTML =
      "<span></span><span></span><span></span>";
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

  function updateUI() {
    var lang = getLang();
    var s = getStrings();
    var dom = window._chatDom;
    if (!dom) return;

    dom.win.querySelector("h4").textContent = s.title;
    dom.win.querySelector(".chatbot-header-info span").textContent =
      s.status;
    dom.input.placeholder = s.placeholder;
    dom.sendBtn.setAttribute("aria-label", s.send);
    renderMessages(dom.messages);
    renderSuggestions(dom.suggestions);
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
    dom.suggestions.innerHTML = "";
    showTyping(dom.messages);

    var lang = getLang();
    var s = getStrings();

    try {
      var res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversation, lang: lang }),
      });
      var data = await res.json();
      removeTyping();

      if (!res.ok) {
        showError(
          dom.messages,
          data.error || s.error_generic
        );
      } else {
        var botMsg = { role: "assistant", content: data.reply };
        conversation.push(botMsg);
        saveHistory();
        renderMessages(dom.messages);
      }
    } catch (e) {
      removeTyping();
      showError(dom.messages, s.error_network);
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
    window._chatDom = dom;

    renderMessages(dom.messages);
    renderSuggestions(dom.suggestions);

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

    document.addEventListener("langchange", updateUI);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
