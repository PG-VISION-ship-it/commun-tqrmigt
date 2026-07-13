const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../config/db');
const { authMiddleware, JWT_SECRET } = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadsDir); },
  filename: function (req, file, cb) {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, unique + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('Seules les images sont autorisees'));
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Trop de tentatives de connexion. Veuillez reessayer plus tard.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function sanitize(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/<[^>]*>/g, '').trim();
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Nom d\'utilisateur et mot de passe requis' });
    }
    const [rows] = await pool.execute('SELECT * FROM users WHERE username = ? LIMIT 1', [sanitize(username)]);
    if (rows.length === 0) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email, full_name: user.full_name, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ? LIMIT 1',
      [req.user.id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouve' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── STATS ─────────────────────────────────────────────────────────────────────

router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const [[newsCount]] = await pool.execute('SELECT COUNT(*) AS count FROM actualites');
    const [[publishedCount]] = await pool.execute('SELECT COUNT(*) AS count FROM actualites WHERE est_publie = 1');
    const [[servicesCount]] = await pool.execute('SELECT COUNT(*) AS count FROM services');
    const [[contactsCount]] = await pool.execute('SELECT COUNT(*) AS count FROM contacts');
    const [[unreadCount]] = await pool.execute('SELECT COUNT(*) AS count FROM contacts WHERE is_read = 0');
    const [recentNews] = await pool.execute('SELECT id, titre_fr, date_publication, est_publie FROM actualites ORDER BY created_at DESC LIMIT 5');
    const [recentContacts] = await pool.execute('SELECT id, name, subject, is_read, created_at FROM contacts ORDER BY created_at DESC LIMIT 5');
    const [categories] = await pool.execute('SELECT categorie, COUNT(*) AS count FROM services GROUP BY categorie ORDER BY count DESC');

    res.json({
      actualites: { total: newsCount.count, published: publishedCount.count },
      services: { total: servicesCount.count },
      contacts: { total: contactsCount.count, unread: unreadCount.count },
      recentNews,
      recentContacts,
      categories
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── ACTUALITES CRUD ───────────────────────────────────────────────────────────

router.get('/actualites', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';
    let sql = 'SELECT * FROM actualites';
    let countSql = 'SELECT COUNT(*) AS total FROM actualites';
    const params = [];
    const countParams = [];

    if (search) {
      const where = ' WHERE titre_fr LIKE ? OR titre_ar LIKE ? OR contenu_fr LIKE ?';
      sql += where;
      countSql += where;
      const s = `%${search}%`;
      params.push(s, s, s);
      countParams.push(s, s, s);
    }
    sql += ' ORDER BY created_at DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const [rows] = await pool.execute(sql, params);
    const [[{ total }]] = await pool.execute(countSql, countParams);
    res.json({ data: rows, total, limit, offset });
  } catch (err) {
    console.error('List actualites error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/actualites/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM actualites WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Actualite non trouvee' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/actualites', authMiddleware, async (req, res) => {
  try {
    const { titre_fr, titre_ar, contenu_fr, contenu_ar, image_url, date_publication, est_publie } = req.body;
    if (!titre_fr || !titre_ar || !contenu_fr || !contenu_ar || !date_publication) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    const [result] = await pool.execute(
      `INSERT INTO actualites (titre_fr, titre_ar, contenu_fr, contenu_ar, image_url, date_publication, est_publie)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sanitize(titre_fr), sanitize(titre_ar), sanitize(contenu_fr), sanitize(contenu_ar),
       image_url || null, date_publication, est_publie !== undefined ? est_publie : 1]
    );
    const [rows] = await pool.execute('SELECT * FROM actualites WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create actualite error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/actualites/:id', authMiddleware, async (req, res) => {
  try {
    const { titre_fr, titre_ar, contenu_fr, contenu_ar, image_url, date_publication, est_publie } = req.body;
    const [existing] = await pool.execute('SELECT * FROM actualites WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Actualite non trouvee' });

    await pool.execute(
      `UPDATE actualites SET titre_fr = ?, titre_ar = ?, contenu_fr = ?, contenu_ar = ?,
       image_url = ?, date_publication = ?, est_publie = ? WHERE id = ?`,
      [sanitize(titre_fr || existing[0].titre_fr), sanitize(titre_ar || existing[0].titre_ar),
       sanitize(contenu_fr || existing[0].contenu_fr), sanitize(contenu_ar || existing[0].contenu_ar),
       image_url !== undefined ? image_url : existing[0].image_url,
       date_publication || existing[0].date_publication,
       est_publie !== undefined ? est_publie : existing[0].est_publie,
       req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM actualites WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update actualite error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/actualites/:id', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT * FROM actualites WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Actualite non trouvee' });
    if (existing[0].image_url) {
      const imgPath = path.join(uploadsDir, path.basename(existing[0].image_url));
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    await pool.execute('DELETE FROM actualites WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Actualite supprimee' });
  } catch (err) {
    console.error('Delete actualite error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/actualites/:id/image', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
    const [existing] = await pool.execute('SELECT image_url FROM actualites WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Actualite non trouvee' });
    }
    if (existing[0].image_url) {
      const oldPath = path.join(uploadsDir, path.basename(existing[0].image_url));
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    const imageUrl = '/uploads/' + req.file.filename;
    await pool.execute('UPDATE actualites SET image_url = ? WHERE id = ?', [imageUrl, req.params.id]);
    res.json({ image_url: imageUrl });
  } catch (err) {
    console.error('Upload image error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── SERVICES CRUD ─────────────────────────────────────────────────────────────

router.get('/services', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const search = req.query.search || '';
    const categorie = req.query.categorie || '';
    let sql = 'SELECT * FROM services';
    let countSql = 'SELECT COUNT(*) AS total FROM services';
    const params = [];
    const countParams = [];
    const conditions = [];

    if (search) {
      conditions.push('(nom_fr LIKE ? OR nom_ar LIKE ? OR description_fr LIKE ?)');
      const s = `%${search}%`;
      params.push(s, s, s);
      countParams.push(s, s, s);
    }
    if (categorie) {
      conditions.push('categorie = ?');
      params.push(categorie);
      countParams.push(categorie);
    }
    if (conditions.length > 0) {
      const where = ' WHERE ' + conditions.join(' AND ');
      sql += where;
      countSql += where;
    }
    sql += ' ORDER BY ordre_affichage ASC, id ASC LIMIT ' + limit + ' OFFSET ' + offset;

    const [rows] = await pool.execute(sql, params);
    const [[{ total }]] = await pool.execute(countSql, countParams);
    res.json({ data: rows, total, limit, offset });
  } catch (err) {
    console.error('List services error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/services/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM services WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Service non trouve' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/services', authMiddleware, async (req, res) => {
  try {
    const { nom_fr, nom_ar, description_fr, description_ar, documents_requis_fr, documents_requis_ar, delai, cout, categorie, ordre_affichage } = req.body;
    if (!nom_fr || !nom_ar || !description_fr || !description_ar) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    const [result] = await pool.execute(
      `INSERT INTO services (nom_fr, nom_ar, description_fr, description_ar, documents_requis_fr, documents_requis_ar, delai, cout, categorie, ordre_affichage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sanitize(nom_fr), sanitize(nom_ar), sanitize(description_fr), sanitize(description_ar),
       sanitize(documents_requis_fr || ''), sanitize(documents_requis_ar || ''),
       sanitize(delai || ''), sanitize(cout || ''), sanitize(categorie || ''),
       ordre_affichage || 0]
    );
    const [rows] = await pool.execute('SELECT * FROM services WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create service error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/services/:id', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT * FROM services WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Service non trouve' });

    const b = req.body;
    await pool.execute(
      `UPDATE services SET nom_fr = ?, nom_ar = ?, description_fr = ?, description_ar = ?,
       documents_requis_fr = ?, documents_requis_ar = ?, delai = ?, cout = ?, categorie = ?, ordre_affichage = ? WHERE id = ?`,
      [sanitize(b.nom_fr || existing[0].nom_fr), sanitize(b.nom_ar || existing[0].nom_ar),
       sanitize(b.description_fr || existing[0].description_fr), sanitize(b.description_ar || existing[0].description_ar),
       sanitize(b.documents_requis_fr !== undefined ? b.documents_requis_fr : existing[0].documents_requis_fr),
       sanitize(b.documents_requis_ar !== undefined ? b.documents_requis_ar : existing[0].documents_requis_ar),
       sanitize(b.delai !== undefined ? b.delai : existing[0].delai),
       sanitize(b.cout !== undefined ? b.cout : existing[0].cout),
       sanitize(b.categorie !== undefined ? b.categorie : existing[0].categorie),
       b.ordre_affichage !== undefined ? b.ordre_affichage : existing[0].ordre_affichage,
       req.params.id]
    );
    const [rows] = await pool.execute('SELECT * FROM services WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update service error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/services/:id', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT * FROM services WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Service non trouve' });
    await pool.execute('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Service supprime' });
  } catch (err) {
    console.error('Delete service error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── MESSAGES CRUD ─────────────────────────────────────────────────────────────

router.delete('/messages/batch/delete-read', authMiddleware, async (req, res) => {
  try {
    const [result] = await pool.execute('DELETE FROM contacts WHERE is_read = 1');
    res.json({ success: true, deleted: result.affectedRows });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/messages', authMiddleware, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const unreadOnly = req.query.unread === '1';
    let sql = 'SELECT * FROM contacts';
    let countSql = 'SELECT COUNT(*) AS total FROM contacts';
    if (unreadOnly) {
      sql += ' WHERE is_read = 0';
      countSql += ' WHERE is_read = 0';
    }
    sql += ' ORDER BY created_at DESC LIMIT ' + limit + ' OFFSET ' + offset;

    const [rows] = await pool.execute(sql);
    const [[{ total }]] = await pool.execute(countSql);
    res.json({ data: rows, total, limit, offset });
  } catch (err) {
    console.error('List messages error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.get('/messages/:id', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM contacts WHERE id = ? LIMIT 1', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Message non trouve' });
    if (!rows[0].is_read) {
      await pool.execute('UPDATE contacts SET is_read = 1 WHERE id = ?', [req.params.id]);
      rows[0].is_read = 1;
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/messages/:id/read', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT * FROM contacts WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Message non trouve' });
    await pool.execute('UPDATE contacts SET is_read = 1 WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/messages/:id', authMiddleware, async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT * FROM contacts WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Message non trouve' });
    await pool.execute('DELETE FROM contacts WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Message supprime' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── PROFILE ───────────────────────────────────────────────────────────────────

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { full_name, email } = req.body;
    if (!full_name || !email) return res.status(400).json({ error: 'Nom et email requis' });
    const [existing] = await pool.execute('SELECT * FROM users WHERE id = ?', [req.user.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Utilisateur non trouve' });
    if (email !== existing[0].email) {
      const [dup] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [email, req.user.id]);
      if (dup.length > 0) return res.status(400).json({ error: 'Cet email est deja utilise' });
    }
    await pool.execute('UPDATE users SET full_name = ?, email = ? WHERE id = ?', [sanitize(full_name), sanitize(email), req.user.id]);
    const [rows] = await pool.execute('SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?', [req.user.id]);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/profile/password', authMiddleware, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return res.status(400).json({ error: 'Mot de passe actuel et nouveau mot de passe requis' });
    if (new_password.length < 6) return res.status(400).json({ error: 'Le nouveau mot de passe doit contenir au moins 6 caracteres' });
    const [rows] = await pool.execute('SELECT password_hash FROM users WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Utilisateur non trouve' });
    const valid = await bcrypt.compare(current_password, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Mot de passe actuel incorrect' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.execute('UPDATE users SET password_hash = ? WHERE id = ?', [hash, req.user.id]);
    res.json({ success: true, message: 'Mot de passe modifie avec succes' });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── USER MANAGEMENT ───────────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acces reserve aux administrateurs' });
  }
  next();
}

router.get('/users', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT id, username, email, full_name, role, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.post('/users', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, email, password, full_name, role } = req.body;
    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Champs obligatoires manquants' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caracteres' });
    }
    const [dupUser] = await pool.execute('SELECT id FROM users WHERE username = ?', [sanitize(username)]);
    if (dupUser.length > 0) return res.status(400).json({ error: 'Ce nom d\'utilisateur est deja utilise' });
    const [dupEmail] = await pool.execute('SELECT id FROM users WHERE email = ?', [sanitize(email)]);
    if (dupEmail.length > 0) return res.status(400).json({ error: 'Cet email est deja utilise' });

    const hash = await bcrypt.hash(password, 10);
    const validRole = ['admin', 'editor'].includes(role) ? role : 'admin';
    const [result] = await pool.execute(
      'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
      [sanitize(username), sanitize(email), hash, sanitize(full_name), validRole]
    );
    const [rows] = await pool.execute('SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { username, email, full_name, role, password } = req.body;
    const [existing] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Utilisateur non trouve' });

    if (username !== existing[0].username) {
      const [dup] = await pool.execute('SELECT id FROM users WHERE username = ? AND id != ?', [sanitize(username), req.params.id]);
      if (dup.length > 0) return res.status(400).json({ error: 'Ce nom d\'utilisateur est deja utilise' });
    }
    if (email !== existing[0].email) {
      const [dup] = await pool.execute('SELECT id FROM users WHERE email = ? AND id != ?', [sanitize(email), req.params.id]);
      if (dup.length > 0) return res.status(400).json({ error: 'Cet email est deja utilise' });
    }

    const validRole = ['admin', 'editor'].includes(role) ? role : existing[0].role;
    if (password) {
      if (password.length < 6) return res.status(400).json({ error: 'Le mot de passe doit contenir au moins 6 caracteres' });
      const hash = await bcrypt.hash(password, 10);
      await pool.execute(
        'UPDATE users SET username = ?, email = ?, full_name = ?, role = ?, password_hash = ? WHERE id = ?',
        [sanitize(username || existing[0].username), sanitize(email || existing[0].email),
         sanitize(full_name || existing[0].full_name), validRole, hash, req.params.id]
      );
    } else {
      await pool.execute(
        'UPDATE users SET username = ?, email = ?, full_name = ?, role = ? WHERE id = ?',
        [sanitize(username || existing[0].username), sanitize(email || existing[0].email),
         sanitize(full_name || existing[0].full_name), validRole, req.params.id]
      );
    }
    const [rows] = await pool.execute('SELECT id, username, email, full_name, role, created_at FROM users WHERE id = ?', [req.params.id]);
    res.json(rows[0]);
  } catch (err) {
    console.error('Update user error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.delete('/users/:id', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const [existing] = await pool.execute('SELECT * FROM users WHERE id = ? LIMIT 1', [req.params.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Utilisateur non trouve' });
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte' });
    }
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Utilisateur supprime' });
  } catch (err) {
    console.error('Delete user error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── SITE SETTINGS ─────────────────────────────────────────────────────────────

router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.execute('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const allowedKeys = ['site_name', 'site_description', 'site_email', 'site_phone', 'site_address'];
    for (const key of allowedKeys) {
      if (req.body[key] !== undefined) {
        const value = sanitize(String(req.body[key]));
        const [existing] = await pool.execute('SELECT setting_key FROM site_settings WHERE setting_key = ?', [key]);
        if (existing.length > 0) {
          await pool.execute('UPDATE site_settings SET setting_value = ? WHERE setting_key = ?', [value, key]);
        } else {
          await pool.execute('INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)', [key, value]);
        }
      }
    }
    const [rows] = await pool.execute('SELECT setting_key, setting_value FROM site_settings');
    const settings = {};
    rows.forEach(r => { settings[r.setting_key] = r.setting_value; });
    res.json(settings);
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ── IMAGE UPLOAD UTILITY ──────────────────────────────────────────────────────

router.post('/upload', authMiddleware, upload.single('image'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });
    res.json({ url: '/uploads/' + req.file.filename });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
