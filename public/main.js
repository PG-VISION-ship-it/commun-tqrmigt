// Menu mobile
document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".main-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", () => nav.classList.toggle("open"));
  }
});

function formatDate(isoDate, lang){
  try{
    const d = new Date(isoDate);
    return d.toLocaleDateString(lang === "ar" ? "ar-MA" : "fr-FR", {
      year: "numeric", month: "long", day: "numeric"
    });
  }catch(e){ return isoDate; }
}

function escapeHtml(str){
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

const API_BASE = "/api";

async function apiGet(path){
  const res = await fetch(`${API_BASE}${path}`);
  if(!res.ok){
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erreur API ${res.status}`);
  }
  return res.json();
}

async function apiPost(path, body){
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if(!res.ok){
    const b = await res.json().catch(() => ({}));
    throw new Error(b.error || `Erreur API ${res.status}`);
  }
  return res.json();
}
