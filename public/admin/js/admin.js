/* ═══════════════════════════════════════════════════════════════════════════
   admin.js — Core admin utilities (auth, API, sidebar, topbar, toasts)
   Now with full i18n support — all visible strings use I18n.t()
   ═══════════════════════════════════════════════════════════════════════════ */

(function () {
  var TOKEN_KEY = 'admin_token';
  var USER_KEY = 'admin_user';

  /* ── AUTH ──────────────────────────────────────────────────────────────── */

  window.AdminAuth = {
    getToken: function () { return localStorage.getItem(TOKEN_KEY); },
    getUser: function () {
      try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; }
    },
    setAuth: function (token, user) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    },
    clearAuth: function () {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    },
    isLoggedIn: function () { return !!localStorage.getItem(TOKEN_KEY); },
    checkAuth: function () {
      if (!this.isLoggedIn()) {
        window.location.href = 'login.html';
        return false;
      }
      return true;
    },
    logout: function () {
      var token = this.getToken();
      if (token) {
        fetch('/api/admin/logout', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token }
        }).catch(function () {});
      }
      this.clearAuth();
      window.location.href = 'login.html';
    }
  };

  /* ── API ───────────────────────────────────────────────────────────────── */

  window.AdminAPI = {
    request: function (method, url, body) {
      var headers = { 'Content-Type': 'application/json' };
      var token = AdminAuth.getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
      var opts = { method: method, headers: headers };
      if (body && method !== 'GET') opts.body = JSON.stringify(body);
      return fetch('/api/admin/' + url, opts).then(function (res) {
        return res.json().then(function (data) {
          if (res.status === 401) { AdminAuth.logout(); return Promise.reject(data); }
          if (res.status === 403) { AdminToast(data.error || I18n.t('access_forbidden'), 'error'); return Promise.reject(data); }
          if (!res.ok) return Promise.reject(data);
          return data;
        });
      });
    },
    get: function (url) { return this.request('GET', url); },
    post: function (url, body) { return this.request('POST', url, body); },
    put: function (url, body) { return this.request('PUT', url, body); },
    del: function (url) { return this.request('DELETE', url); },
    upload: function (url, formData) {
      var headers = {};
      var token = AdminAuth.getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
      return fetch('/api/admin/' + url, { method: 'POST', headers: headers, body: formData }).then(function (res) {
        return res.json().then(function (data) {
          if (res.status === 401) { AdminAuth.logout(); return Promise.reject(data); }
          if (res.status === 403) { AdminToast(data.error || I18n.t('access_forbidden'), 'error'); return Promise.reject(data); }
          if (!res.ok) return Promise.reject(data);
          return data;
        });
      });
    }
  };

  /* ── TOAST & ALERT ─────────────────────────────────────────────────────── */

  function toast(msg, type) {
    var c = document.getElementById('toast-container');
    if (!c) { c = document.createElement('div'); c.id = 'toast-container'; c.className = 'toast-container'; document.body.appendChild(c); }
    var t = document.createElement('div');
    t.className = 'toast ' + (type || 'success');
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(function () { t.remove(); }, 3500);
  }
  window.AdminToast = toast;

  function showAlert(id, msg, type) {
    var el = document.getElementById(id);
    if (!el) return;
    el.className = 'alert alert-' + (type || 'success') + ' show';
    el.textContent = msg;
    setTimeout(function () { el.className = 'alert'; }, 4000);
  }
  window.AdminAlert = showAlert;

  /* ── SVG ICONS ─────────────────────────────────────────────────────────── */

  var SVG_ICONS = {
    dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>',
    news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2"/><line x1="7" y1="8" x2="13" y2="8"/><line x1="7" y1="12" x2="11" y2="12"/></svg>',
    services: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>',
    messages: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
    profile: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>',
    logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
  };

  /* ── SIDEBAR (translated) ──────────────────────────────────────────────── */

  function buildSidebar(activePage) {
    var user = AdminAuth.getUser();
    var initials = '?';
    if (user && user.full_name) {
      var parts = user.full_name.split(' ');
      initials = parts[0].charAt(0).toUpperCase();
      if (parts.length > 1) initials += parts[parts.length - 1].charAt(0).toUpperCase();
    }
    return '<div class="sidebar-header">' +
      '<img src="/tarmigt-logo.svg" alt="Logo">' +
      '<div><h2>' + I18n.t('commune_name') + '</h2><p>' + I18n.t('commune_sub') + '</p></div>' +
      '</div>' +
      '<nav class="sidebar-nav">' +
      '<div class="nav-label">' + I18n.t('nav_menu') + '</div>' +
      '<a href="index.html" class="' + (activePage === 'dashboard' ? 'active' : '') + '">' + SVG_ICONS.dashboard + ' ' + I18n.t('nav_dashboard') + '</a>' +
      '<a href="actualites.html" class="' + (activePage === 'actualites' ? 'active' : '') + '">' + SVG_ICONS.news + ' ' + I18n.t('nav_news') + '</a>' +
      '<a href="services.html" class="' + (activePage === 'services' ? 'active' : '') + '">' + SVG_ICONS.services + ' ' + I18n.t('nav_services') + '</a>' +
      '<a href="messages.html" class="' + (activePage === 'messages' ? 'active' : '') + '">' + SVG_ICONS.messages + ' ' + I18n.t('nav_messages') + ' <span class="badge" id="unread-badge" style="display:none"></span></a>' +
      '<div class="nav-label">' + I18n.t('nav_account') + '</div>' +
      '<a href="profile.html" class="' + (activePage === 'profile' ? 'active' : '') + '">' + SVG_ICONS.profile + ' ' + I18n.t('nav_profile') + '</a>' +
      '<a href="settings.html" class="' + (activePage === 'settings' ? 'active' : '') + '">' + SVG_ICONS.settings + ' ' + I18n.t('nav_settings') + '</a>' +
      '<div class="nav-label">' + I18n.t('nav_administration') + '</div>' +
      '<a href="users.html" class="' + (activePage === 'users' ? 'active' : '') + '">' + SVG_ICONS.profile + ' ' + I18n.t('nav_users') + '</a>' +
      '<a href="#" onclick="AdminAuth.logout();return false;" style="margin-top:8px;border-top:1px solid rgba(255,255,255,.1);padding-top:16px">' + SVG_ICONS.logout + ' ' + I18n.t('nav_logout') + '</a>' +
      '</nav>';
  }

  /* ── TOPBAR (translated) ───────────────────────────────────────────────── */

  function buildTopbar(title) {
    var user = AdminAuth.getUser();
    var initials = '?';
    if (user && user.full_name) {
      var parts = user.full_name.split(' ');
      initials = parts[0].charAt(0).toUpperCase();
      if (parts.length > 1) initials += parts[parts.length - 1].charAt(0).toUpperCase();
    }
    return '<div class="topbar-left">' +
      '<button class="hamburger" onclick="toggleSidebar()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg></button>' +
      '<h1>' + title + '</h1>' +
      '</div>' +
      '<div class="topbar-right">' +
      '<a href="/" class="btn btn-outline btn-sm" target="_blank">' + SVG_ICONS.home + ' ' + I18n.t('site_short') + '</a>' +
      '<div class="user-info"><div class="user-avatar">' + initials + '</div><div><div class="user-name">' + (user ? user.full_name : '') + '</div><div class="user-role">' + (user ? user.role : '') + '</div></div></div>' +
      '<button class="btn-logout" onclick="AdminAuth.logout()">' + I18n.t('nav_logout') + '</button>' +
      '</div>';
  }

  /* ── SIDEBAR TOGGLE ────────────────────────────────────────────────────── */

  window.toggleSidebar = function () {
    var sb = document.getElementById('sidebar');
    var ov = document.getElementById('sidebar-overlay');
    if (sb) sb.classList.toggle('open');
    if (ov) ov.classList.toggle('show');
  };

  /* ── PAGE INIT (loads language from server, then builds UI) ────────────── */

  window.initAdminPage = function (activePage, titleKey) {
    if (!AdminAuth.checkAuth()) return false;

    /* Load language preference from server, then build sidebar/topbar */
    I18n.loadFromServer(function () {
      var sb = document.getElementById('sidebar');
      var tb = document.getElementById('topbar');
      var title = I18n.t(titleKey) || titleKey;
      if (sb) sb.innerHTML = buildSidebar(activePage);
      if (tb) tb.innerHTML = buildTopbar(title);

      var ov = document.getElementById('sidebar-overlay');
      if (ov) ov.onclick = function () { toggleSidebar(); };

      /* Re-translate any [data-i18n] elements on the page */
      I18n.translatePage();

      AdminAPI.get('messages?unread=1').then(function (d) {
        var badge = document.getElementById('unread-badge');
        if (badge && d.total > 0) { badge.textContent = d.total; badge.style.display = 'inline'; }
      }).catch(function () {});
    });

    return true;
  };

  /* ── UTILITIES ─────────────────────────────────────────────────────────── */

  window.AdminUtils = {
    formatDate: function (d) {
      return I18n.formatDate(d);
    },
    escapeHtml: function (str) {
      if (!str) return '';
      var div = document.createElement('div');
      div.textContent = str;
      return div.innerHTML;
    },
    escapeAttr: function (str) {
      if (!str) return '';
      return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    escapeJsString: function (str) {
      if (!str) return '';
      return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r');
    },
    truncate: function (str, len) {
      if (!str) return '';
      return str.length > len ? str.substring(0, len) + '...' : str;
    }
  };
})();
