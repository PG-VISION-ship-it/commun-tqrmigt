const express = require("express");
const path = require("path");
const fs = require("fs");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Trop de requetes. Veuillez reessayer plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});

function readJsonFallback(filename) {
  try {
    const raw = fs.readFileSync(
      path.join(__dirname, "..", "data", filename),
      "utf-8"
    );
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function fetchActualites(lang) {
  try {
    const pool = require("../config/db");
    const [rows] = await pool.execute(
      "SELECT titre_fr, titre_ar, contenu_fr, contenu_ar, date_publication FROM actualites WHERE est_publie = 1 ORDER BY date_publication DESC LIMIT 10"
    );
    return rows;
  } catch {
    return readJsonFallback("actualites.json").filter((a) => a.est_publie);
  }
}

async function fetchServices(lang) {
  try {
    const pool = require("../config/db");
    const [rows] = await pool.execute(
      "SELECT nom_fr, nom_ar, description_fr, description_ar, documents_requis_fr, documents_requis_ar, delai, cout, categorie FROM services ORDER BY ordre_affichage ASC LIMIT 20"
    );
    return rows;
  } catch {
    return readJsonFallback("services.json");
  }
}

async function fetchSettings() {
  try {
    const pool = require("../config/db");
    const [rows] = await pool.execute(
      "SELECT setting_key, setting_value FROM site_settings"
    );
    const settings = {};
    rows.forEach((r) => { settings[r.setting_key] = r.setting_value; });
    return settings;
  } catch {
    return {
      site_name: "Commune de Tarmigt",
      site_description:
        "Site officiel de la Commune de Tarmigt, Province de Ouarzazate",
      site_email: "contact@tarmigt.ma",
      site_phone: "05458585525",
      site_address: "Siege de la commune, Tarmigt, Ouarzazate",
    };
  }
}

function buildContext(actualites, services, settings, lang) {
  const lines = [];

  lines.push("=== INFORMATIONS SUR LA COMMUNE DE TARMIGT ===");
  lines.push("Nom: " + (settings.site_name || "Commune de Tarmigt"));
  lines.push(
    "Description: " +
      (settings.site_description ||
        "Site officiel de la Commune de Tarmigt, Province de Ouarzazate")
  );
  lines.push("Adresse: " + (settings.site_address || "Tarmigt, Ouarzazate"));
  lines.push("Telephone: " + (settings.site_phone || "05458585525"));
  lines.push("Email: " + (settings.site_email || "contact@tarmigt.ma"));
  lines.push("Population: environ 46 963 habitants");
  lines.push("Superficie: 420 km2");
  lines.push("Nombre de douars: 24");
  lines.push("Province: Ouarzazate");
  lines.push("Region: Draa-Tafilalet");
  lines.push("Horaires: Lundi-Vendredi 8h30-16h30");
  lines.push("");

  if (actualites.length > 0) {
    lines.push("=== ACTUALITES RECENTES ===");
    actualites.forEach((a, i) => {
      const titre = lang === "ar" ? a.titre_ar : a.titre_fr;
      const contenu = lang === "ar" ? a.contenu_ar : a.contenu_fr;
      lines.push((i + 1) + ". " + titre);
      lines.push("   Date: " + a.date_publication);
      lines.push("   " + (contenu || "").slice(0, 300));
      lines.push("");
    });
  }

  if (services.length > 0) {
    lines.push("=== SERVICES ADMINISTRATIFS DISPONIBLES ===");
    services.forEach((s, i) => {
      const nom = lang === "ar" ? s.nom_ar : s.nom_fr;
      const desc = lang === "ar" ? s.description_ar : s.description_fr;
      const docs = lang === "ar" ? s.documents_requis_ar : s.documents_requis_fr;
      lines.push((i + 1) + ". " + nom + (s.categorie ? " [" + s.categorie + "]" : ""));
      lines.push("   Description: " + (desc || ""));
      if (docs) lines.push("   Documents requis: " + docs);
      if (s.delai) lines.push("   Delai: " + s.delai);
      if (s.cout) lines.push("   Cout: " + s.cout);
      lines.push("");
    });
  }

  return lines.join("\n");
}

function buildSystemPrompt(contextData, lang) {
  if (lang === "ar") {
    return `أنت المساعد الافتراضي لجماعة ترميكت، جماعة قروية تابعة لإقليم ورزازات بجهة درعة تافيلالت بالمغرب.

تعليمات:
- أجب دائماً باللغة العربية الفصحى المبسطة.
- استخدم البيانات التالية التي يتم تحديثها من قاعدة البيانات للإجابة على أسئلة المواطنين.
- إذا لم تجد إجابة في البيانات، قدم إجابة مفيدة بناءً على معلوماتك العامة عن المغرب والجماعات القروية.
- كن ودوداً ومحترفاً ومختصاً في الإجابات.
- إذا سأل المستخدم عن معلومات غير متوفرة، أرسله إلى مقر الجماعة أو عبر البريد الإلكتروني أو الهاتف.
- لا تخترع معلومات. إذا لم تكن متأكداً، قل ذلك بوضوح.

بياناتCommune de Tarmigt المحدثة:
${contextData}`;
  }

  return `Tu es l'assistant virtuel de la Commune de Tarmigt, une commune rurale de la province d'Ouarzazate, dans la region Draa-Tafilalet au Maroc.

Instructions:
- Reponds TOUJOURS en francais, de maniere concise et utile.
- Utilise les donnees ci-dessous (mises a jour depuis la base de donnees) pour repondre aux questions des citoyens.
- Si tu ne trouves pas la reponse dans les donnees, donne une reponse utile basee sur tes connaissances generales sur les communes rurales marocaines.
- Sois amical, professionnel et precis.
- Si l'utilisateur demande des informations non disponibles, oriente-le vers le siege de la commune, l'email ou le telephone.
- Ne invente pas d'informations. Si tu n'es pas sur, dis-le clairement.
- Tu peux parler des actualites, services, demarches, coordonnees, et tout ce qui concerne la commune.

Donnees a jour de la Commune de Tarmigt:
${contextData}`;
}

router.post("/", chatLimiter, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error:
        "Le service de chat n'est pas configure. Veuillez ajouter votre cle API OpenAI dans le fichier .env.",
    });
  }

  const { messages, lang } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages invalides." });
  }

  const userLang = lang === "ar" ? "ar" : "fr";

  const [actualites, services, settings] = await Promise.all([
    fetchActualites(userLang),
    fetchServices(userLang),
    fetchSettings(),
  ]);

  const contextData = buildContext(actualites, services, settings, userLang);
  const systemPrompt = buildSystemPrompt(contextData, userLang);

  const trimmed = messages.slice(-20).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content:
      typeof m.content === "string" ? m.content.slice(0, 2000) : "",
  }));

  try {
    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: systemPrompt },
            ...trimmed,
          ],
          max_tokens: 600,
          temperature: 0.7,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", response.status, err);
      return res.status(502).json({
        error:
          userLang === "ar"
            ? "حدث خطأ في خدمة الذكاء الاصطناعي. حاول مرة أخرى."
            : "Erreur du service IA. Veuillez reessayer.",
      });
    }

    const data = await response.json();
    const reply =
      data.choices?.[0]?.message?.content ||
      (userLang === "ar"
        ? "لم أتمكن من إيجاد إجابة."
        : "Pas de reponse.");
    res.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err.message);
    res.status(500).json({
      error:
        userLang === "ar"
          ? "خطأ داخلي في الخادم."
          : "Erreur interne du serveur.",
    });
  }
});

module.exports = router;
