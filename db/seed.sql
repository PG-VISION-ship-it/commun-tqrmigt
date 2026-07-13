USE commune_tarmigt;

-- ---------------------------------------------------------
-- Utilisateur admin (mot de passe: admin123)
-- ---------------------------------------------------------
INSERT IGNORE INTO users (username, email, password_hash, full_name, role) VALUES
('admin', 'admin@commune-tarmigt.ma', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Administrateur', 'admin');

-- ---------------------------------------------------------
-- Paramètres du site
-- ---------------------------------------------------------
INSERT IGNORE INTO site_settings (setting_key, setting_value) VALUES
('site_name', 'Commune de Tarmigt'),
('site_description', 'Site officiel de la Commune de Tarmigt, Province de Ouarzazate'),
('site_email', 'contact@tarmigt.ma'),
('site_phone', '05458585525'),
('site_address', 'Siege de la commune, Tarmigt, Ouarzazate');

-- ---------------------------------------------------------
-- Contacts / messages de test
-- ---------------------------------------------------------
INSERT INTO contacts (name, email, phone, subject, message, is_read) VALUES
('Mohamed Ait Baha', 'mohamed@example.com', '0612345678', 'Demande d''attestation de residence', 'Bonjour, je souhaite obtenir une attestation de residence. Je suis resident au douar Ait Bouguemez. Merci.', 0),
('Fatima Zahra Ouazzani', 'fatima@example.com', '0698765432', 'Information sur les horaires', 'Quels sont les horaires d''ouverture du guichet administratif ? Je dois faire une demande de certificat de naissance.', 1),
('Hassan El Mansouri', 'hassan@example.com', '0654321987', 'Suivi de dossier permis de construire', 'Bonjour, j''ai deposer un dossier de permis de construire il y a 3 semaines. Comment puis-je suivre l''avancement ?', 0);

-- ---------------------------------------------------------
-- Actualités
-- ---------------------------------------------------------
INSERT INTO actualites (titre_fr, titre_ar, contenu_fr, contenu_ar, date_publication) VALUES
(
  "Lancement des travaux d'aménagement de la route reliant Tarmigt à la RN10",
  "انطلاق أشغال تهيئة الطريق الرابطة بين ترميكت والطريق الوطنية رقم 10",
  "La commune de Tarmigt annonce le lancement des travaux d'aménagement et d'élargissement de la route reliant le centre de la commune à la route nationale RN10. Ce projet, financé conjointement par le conseil communal et la province d'Ouarzazate, vise à améliorer la sécurité routière et à faciliter les déplacements des habitants. Les travaux devraient durer environ six mois.",
  "تعلن جماعة ترميكت عن انطلاق أشغال تهيئة وتوسيع الطريق الرابطة بين مركز الجماعة والطريق الوطنية رقم 10. يهدف هذا المشروع، الممول بشكل مشترك من طرف المجلس الجماعي وعمالة إقليم ورزازات، إلى تحسين السلامة الطرقية وتسهيل تنقل الساكنة. من المتوقع أن تستمر الأشغال لمدة ستة أشهر تقريبا.",
  "2026-06-20"
),
(
  "Campagne de vaccination du bétail dans les douars de la commune",
  "حملة تلقيح المواشي بدواوير الجماعة",
  "En collaboration avec la direction provinciale de l'agriculture, la commune organise une campagne gratuite de vaccination du bétail contre les maladies saisonnières dans l'ensemble des douars relevant de son territoire. Les éleveurs sont invités à se présenter aux points de rassemblement communiqués par les autorités locales.",
  "بتعاون مع المديرية الإقليمية للفلاحة، تنظم الجماعة حملة مجانية لتلقيح المواشي ضد الأمراض الموسمية بجميع الدواوير التابعة لترابها. يدعى مربو الماشية للحضور إلى نقاط التجمع التي ستعلن عنها السلطات المحلية.",
  "2026-06-10"
),
(
  "Session ordinaire du conseil communal — juin 2026",
  "الدورة العادية للمجلس الجماعي — يونيو 2026",
  "Le conseil communal de Tarmigt tiendra sa session ordinaire au titre du mois de juin 2026. L'ordre du jour comprend notamment l'examen du budget rectificatif, le suivi des projets d'infrastructure en cours et l'approbation de nouvelles conventions de partenariat.",
  "سيعقد المجلس الجماعي لترميكت دورته العادية برسم شهر يونيو 2026. ويتضمن جدول الأعمال بالخصوص دراسة الميزانية التعديلية، تتبع مشاريع البنية التحتية الجارية، والمصادقة على اتفاقيات شراكة جديدة.",
  "2026-06-01"
);

-- ---------------------------------------------------------
-- Services administratifs
-- ---------------------------------------------------------
INSERT INTO services (nom_fr, nom_ar, description_fr, description_ar, documents_requis_fr, documents_requis_ar, delai, cout, categorie, ordre_affichage) VALUES
(
  "Extrait d'acte de naissance",
  "مستخرج من رسم الولادة",
  "Délivrance d'un extrait d'acte de naissance pour les personnes nées ou enregistrées dans la commune de Tarmigt.",
  "تسليم مستخرج من رسم الولادة للأشخاص المزدادين أو المسجلين بجماعة ترميكت.",
  "Carte d'identité nationale ou livret de famille.",
  "البطاقة الوطنية للتعريف أو دفتر الحالة المدنية.",
  "Immédiat (guichet unique)",
  "Gratuit",
  "État civil",
  1
),
(
  "Certificat de résidence",
  "شهادة السكنى",
  "Attestation confirmant la résidence habituelle d'une personne sur le territoire de la commune.",
  "شهادة تثبت الإقامة الاعتيادية لشخص بتراب الجماعة.",
  "Carte d'identité nationale, justificatif de domicile (facture d'eau/électricité).",
  "البطاقة الوطنية للتعريف، وثيقة تثبت السكن (فاتورة الماء أو الكهرباء).",
  "24 heures",
  "Gratuit",
  "État civil",
  2
),
(
  "Autorisation de construire",
  "رخصة البناء",
  "Autorisation préalable requise pour tout projet de construction, extension ou rénovation sur le territoire communal.",
  "رخصة مسبقة مطلوبة لكل مشروع بناء أو توسيع أو ترميم بتراب الجماعة.",
  "Titre de propriété, plans architecturaux visés, dossier technique.",
  "رسم الملكية، التصاميم المعمارية المؤشر عليها، الملف التقني.",
  "30 jours ouvrables",
  "Selon barème communal",
  "Urbanisme",
  3
),
(
  "Légalisation de signature",
  "التصديق على الإمضاء",
  "Service de légalisation de signature pour les documents administratifs et privés des citoyens.",
  "خدمة التصديق على الإمضاء بالنسبة للوثائق الإدارية والخاصة للمواطنين.",
  "Carte d'identité nationale, document à légaliser.",
  "البطاقة الوطنية للتعريف، الوثيقة المراد التصديق عليها.",
  "Immédiat",
  "Gratuit",
  "Affaires générales",
  4
);
