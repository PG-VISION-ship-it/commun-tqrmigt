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

const uploadsDir = path.join(__dirname, "uploads");
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.replace(/<[^>]*>/g, "").trim();
}

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});
app.use(express.json({ limit: "10kb" }));
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
    const filePath = path.join(__dirname, "data", "contacts.json");
    let entries = [];
    try { entries = JSON.parse(fs.readFileSync(filePath, "utf-8")); } catch { /* empty */ }
    entry.id = Date.now();
    entry.date = new Date().toISOString();
    entries.push(entry);
    fs.writeFileSync(filePath, JSON.stringify(entries, null, 2), "utf-8");
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

app.listen(PORT, () => {
  console.log(`Serveur de la Commune de Tarmigt lance sur http://localhost:${PORT}`);
});
