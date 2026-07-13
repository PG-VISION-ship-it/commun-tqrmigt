require('dotenv').config();
const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');

async function fullSetup() {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true
    });

    console.log('Connected to MySQL.');

    await connection.query(`
      CREATE DATABASE IF NOT EXISTS commune_tarmigt
      CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
    `);
    console.log('Database created/verified.');

    await connection.query('USE commune_tarmigt');

    await connection.query(`CREATE TABLE IF NOT EXISTS actualites (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      titre_fr VARCHAR(255) NOT NULL,
      titre_ar VARCHAR(255) NOT NULL,
      contenu_fr TEXT NOT NULL,
      contenu_ar TEXT NOT NULL,
      image_url VARCHAR(500) DEFAULT NULL,
      date_publication DATE NOT NULL,
      est_publie TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_date_publication (date_publication),
      INDEX idx_est_publie (est_publie)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await connection.query(`CREATE TABLE IF NOT EXISTS services (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      nom_fr VARCHAR(255) NOT NULL,
      nom_ar VARCHAR(255) NOT NULL,
      description_fr TEXT NOT NULL,
      description_ar TEXT NOT NULL,
      documents_requis_fr TEXT,
      documents_requis_ar TEXT,
      delai VARCHAR(100) DEFAULT NULL,
      cout VARCHAR(100) DEFAULT NULL,
      categorie VARCHAR(100) DEFAULT NULL,
      ordre_affichage INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_categorie (categorie)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('Content tables created/verified.');

    await connection.query(`CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(100) NOT NULL UNIQUE,
      email VARCHAR(255) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      full_name VARCHAR(200) NOT NULL,
      role ENUM('admin', 'editor') DEFAULT 'admin',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

    await connection.query(`CREATE TABLE IF NOT EXISTS contacts (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(200) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) DEFAULT NULL,
      subject VARCHAR(255) NOT NULL,
      message TEXT NOT NULL,
      is_read TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('Admin tables created/verified.');

    await connection.query(`CREATE TABLE IF NOT EXISTS site_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    console.log('Settings table created/verified.');

    const defaultSettings = [
      ['site_name', 'Commune de Tarmigt'],
      ['site_description', 'Site officiel de la Commune de Tarmigt, Province de Ouarzazate'],
      ['site_email', 'contact@tarmigt.ma'],
      ['site_phone', '05458585525'],
      ['site_address', 'Siege de la commune, Tarmigt, Ouarzazate']
    ];
    for (const [key, value] of defaultSettings) {
      await connection.query(
        'INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES (?, ?)',
        [key, value]
      );
    }
    console.log('Default settings inserted.');

    const [existing] = await connection.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (existing.length === 0) {
      const hash = await bcrypt.hash('admin123', 10);
      await connection.query(
        'INSERT INTO users (username, email, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
        ['admin', 'admin@commune-tarmigt.ma', hash, 'Administrateur', 'admin']
      );
      console.log('Default admin user created (username: admin, password: admin123)');
    } else {
      console.log('Admin user already exists.');
    }

    const [newsCount] = await connection.query('SELECT COUNT(*) AS c FROM actualites');
    if (newsCount[0].c === 0) {
      await connection.query(`INSERT INTO actualites (titre_fr, titre_ar, contenu_fr, contenu_ar, date_publication, est_publie) VALUES
        ('Projet de construction de route', 'مشروع بناء طريق', 'La commune de Tarmigt a le plaisir d''annoncer le lancement du projet de construction de la route communale reliant le centre aux villages environnants.', 'يسعد بلدية تارميغت الإعلان عن إطلاق مشروع بناء الطريق البلدية التي تربط المركز بالقرى المحيطة.', '2026-06-20', 1),
        ('Campagne de vaccination du betail', 'حملة التلقيح ضد الأمراض الحيوانية', 'Dans le cadre de la lutte contre les maladies animales, une campagne de vaccination sera organisee du 15 au 30 juin.', 'في إطار مكافحة الأمراض الحيوانية، سيتم تنظيم حملة تلقيح من 15 إلى 30 يونيو.', '2026-06-10', 1),
        ('Session du conseil communal', 'دورة المجلس البلدي', 'Le conseil communal se reunira en session ordinaire le 5 juin a 10h a la salle du conseil.', 'سيجتمع المجلس البلدي في دورة عادية في 5 يونيو الساعة 10 صباحاً بقاعة المجلس.', '2026-06-01', 1)`);
      console.log('Sample news inserted.');
    }

    const [svcCount] = await connection.query('SELECT COUNT(*) AS c FROM services');
    if (svcCount[0].c === 0) {
      await connection.query(`INSERT INTO services (nom_fr, nom_ar, description_fr, description_ar, documents_requis_fr, documents_requis_ar, delai, cout, categorie, ordre_affichage) VALUES
        ('Extrait d''acte de naissance', '.extract من شهادة الميلاد', 'Obtenir un extrait d''acte de naissance officiel', 'الحصول على نسخة رسمية من شهادة الميلاد', 'CNI du demandeur, Livret de famille', 'بطاقة التعريف الوطنية لطالب الخدمة, دفتر العائلة', '3 jours', 'Gratuit', 'Etat civil', 1),
        ('Attestation de residence', 'شهادة الإقامة', 'Obtenir une attestation de residence prouvant votre domicile', 'الحصول على شهادة إقامة تثبت عنوانك', 'CNI, Justificatif de domicile', 'بطاقة التعريف الوطنية, إثبات العنوان', '2 jours', 'Gratuit', 'Etat civil', 2),
        ('Permis de construire', 'رخصة البناء', 'Deposer une demande de permis de construire', 'تقديم طلب رخصة بناء', 'Plan de construction, Titre foncier, CNI', 'خطة البناء, عقار العقار, بطاقة التعريف الوطنية', '30 jours', 'Variable', 'Urbanisme', 3),
        ('Legalisation de signature', 'توثيق التوقيع', 'Faire legaliser votre signature auprès de la commune', 'توثيق توقيعك لدى البلدية', 'CNI, Document a signer', 'بطاقة التعريف الوطنية, الوثيقة المراد توقيعها', '1 jour', 'Gratuit', 'Affaires generales', 4)`);
      console.log('Sample services inserted.');
    }

    const [contactCount] = await connection.query('SELECT COUNT(*) AS c FROM contacts');
    if (contactCount[0].c === 0) {
      await connection.query(`INSERT INTO contacts (name, email, phone, subject, message, is_read) VALUES
        ('Mohamed Ait Baha', 'mohamed@example.com', '0612345678', 'Demande d''attestation de residence', 'Bonjour, je souhaite obtenir une attestation de residence. Je suis resident au douar Ait Bouguemez. Merci.', 0),
        ('Fatima Zahra Ouazzani', 'fatima@example.com', '0698765432', 'Information sur les horaires', 'Quels sont les horaires d''ouverture du guichet administratif ?', 1),
        ('Hassan El Mansouri', 'hassan@example.com', '0654321987', 'Suivi de dossier permis de construire', 'Bonjour, j''ai deposer un dossier de permis de construire il y a 3 semaines. Comment puis-je suivre ?', 0)`);
      console.log('Sample contacts inserted.');
    }

    console.log('\nSetup complete! You can now start the server with: npm start');
  } catch (err) {
    console.error('Setup error:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('MySQL is not running. Please start MySQL and try again.');
    }
  } finally {
    if (connection) await connection.end();
    process.exit();
  }
}

fullSetup();
