const express = require("express");
const path = require("path");
const fs = require("fs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const actualitesRouter = require("./routes/actualites");
const servicesRouter = require("./routes/services");
const adminRouter = require("./routes/admin");
const chatRouter = require("./routes/chat");


const app = express();
const PORT = process.env.PORT || 3000;

function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim();
}

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://fonts.googleapis.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map(o => o.trim())
  : [];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.length === 0) {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
    }
  } else if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Trop de requetes. Veuillez reessayer plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/actualites", actualitesRouter);
app.use("/api/services", servicesRouter);
app.use("/api/admin", adminRouter);
app.use("/api/chat", chatRouter);

/* ── Admin explicit routes ──────────────────────────────────── */
app.use("/admin", express.static(path.join(__dirname, "public", "admin")));

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", commune: "Tarmigt" });
});

app.get("/api/settings", async (req, res) => {
  try {
    const pool = require("./config/db");
    const [rows] = await pool.execute("SELECT setting_key, setting_value FROM site_settings");
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch {
    res.json({
      site_name: "Commune de Tarmigt",
      site_description: "Site officiel de la Commune de Tarmigt, Province de Ouarzazate",
      site_email: "contact@tarmigt.ma",
      site_phone: "05458585525",
      site_address: "Siege de la commune, Tarmigt, Ouarzazate"
    });
  }
});

app.post("/api/contact", contactLimiter, async (req, res) => {
  const { name, email, phone, subject, message } = req.body;
  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: "Champs obligatoires manquants." });
  }
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Adresse email invalide." });
  }
  const entry = {
    name: sanitize(name),
    email: sanitize(email),
    phone: sanitize(phone || ""),
    subject: sanitize(subject),
    message: sanitize(message),
  };

  let dbSuccess = false;
  try {
    const pool = require("./config/db");
    await pool.execute(
      "INSERT INTO contacts (name, email, phone, subject, message) VALUES (?, ?, ?, ?, ?)",
      [entry.name, entry.email, entry.phone, entry.subject, entry.message]
    );
    dbSuccess = true;
  } catch (dbErr) {
    console.warn("MySQL save failed, using JSON fallback:", dbErr.message);
  }

  if (!dbSuccess) {
    try {
      const filePath = path.join(__dirname, "data", "contacts.json");
      let entries = [];
      try { entries = JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { /* empty */ }
      entry.id = Date.now();
      entry.date = new Date().toISOString();
      entries.push(entry);
      fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf-8");
    } catch {
      console.warn("JSON fallback write failed (expected on Vercel serverless).");
    }
  }
  res.status(201).json({ success: true });
});

app.use((req, res) => {
  res.status(404).json({ error: "Route non trouvee" });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Erreur interne du serveur." });
});

if (process.env.VERCEL !== "1") {
  app.listen(PORT, () => {
    console.log(`Serveur de la Commune de Tarmigt lance sur http://localhost:${PORT}`);
  });
}

module.exports = app;
