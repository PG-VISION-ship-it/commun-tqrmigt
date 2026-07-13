const express = require("express");
const rateLimit = require("express-rate-limit");
const router = express.Router();

const chatLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Trop de requetes. Veuillez reessayer plus tard." },
  standardHeaders: true,
  legacyHeaders: false,
});

const SYSTEM_PROMPT = `Tu es l'assistant virtuel de la Commune de Tarmigt, une commune rurale de la province d'Ouarzazate, dans la region Draa-Tafilalet au Maroc.

Informations cles :
- Population : environ 46 963 habitants
- Superficie : 420 km²
- 24 douars (villages)
- Siege : Tarmigt, Ouarzazate
- Telephone : 05458585525
- Email : contact@tarmigt.ma
- Horaires d'accueil : Lundi-Vendredi 8h30-16h30

Tu peux renseigner sur :
- Les actualites et evenements de la commune
- Les services administratifs disponibles (etat civil, urbanisme, etc.)
- Les demarches administratives et documents requis
- Les coordonnees et horaires de la mairie
- L'histoire et le patrimoine de la commune

Reponds toujours en francais, de maniere concise et utile. Si tu ne connais pas la reponse precise, oriente le citoyen vers le contact de la mairie. Sois amical et professionnel.`;

router.post("/", chatLimiter, async (req, res) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "Le service de chat n'est pas configure. Cle API manquante.",
    });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages invalides." });
  }

  const trimmed = messages.slice(-20).map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: typeof m.content === "string" ? m.content.slice(0, 2000) : "",
  }));

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      console.error("OpenAI API error:", response.status, err);
      return res.status(502).json({
        error: "Erreur du service IA. Veuillez reessayer.",
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Pas de reponse.";
    res.json({ reply });
  } catch (err) {
    console.error("Chat route error:", err.message);
    res.status(500).json({ error: "Erreur interne du serveur." });
  }
});

module.exports = router;
