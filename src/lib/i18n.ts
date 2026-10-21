export type Locale = "ar" | "fr" | "en";

export const LOCALES: Locale[] = ["ar", "fr", "en"];

export const LOCALE_META: Record<Locale, { label: string; flag: string; dir: "rtl" | "ltr" }> = {
  ar: { label: "العربية", flag: "🇩🇿", dir: "rtl" },
  fr: { label: "Français", flag: "🇫🇷", dir: "ltr" },
  en: { label: "English", flag: "🇬🇧", dir: "ltr" },
};

const dict = {
  /* ---------------- brand ---------------- */
  brand_name: {
    ar: "التاج الذهبي",
    fr: "La Couronne d'Or",
    en: "The Golden Crown",
  },
  brand_tagline: {
    ar: "حجز آلي فائق السرعة لتأشيرة إسبانيا — الجزائر",
    fr: "Réservation ultra-rapide du visa Espagne — Algérie",
    en: "Ultra-fast Spain visa booking — Algeria",
  },
  brand_short: {
    ar: "التاج الذهبي",
    fr: "Couronne d'Or",
    en: "Golden Crown",
  },

  /* ---------------- public home ---------------- */
  hero_title: {
    ar: "احجز موعدك لتأشيرة إسبانيا في ثوانٍ",
    fr: "Réservez votre visa Espagne en quelques secondes",
    en: "Book your Spain visa in seconds",
  },
  hero_sub: {
    ar: "منصة محمية بالكامل، تعمل بالتوقيت الجزائري، وتفتح المواعيد تلقائيًا قبل الجميع — الجمعة 16:00 والثلاثاء 17:00.",
    fr: "Plateforme entièrement sécurisée, horaires algériens, ouverture automatique des créneaux avant tout le monde — Vendredi 16:00 et Mardi 17:00.",
    en: "Fully secured platform, Algerian time, automatic slot opening ahead of everyone — Friday 16:00 and Tuesday 17:00.",
  },
  enter_code: { ar: "أدخل كود الحجز", fr: "Entrez votre code", en: "Enter your access code" },
  code_placeholder: { ar: "5 أرقام", fr: "5 chiffres", en: "5 digits" },
  access_portal: { ar: "بوابة العميل", fr: "Espace client", en: "Client portal" },
  operator_portal: { ar: "واجهة المشغّل", fr: "Espace opérateur", en: "Operator console" },
  client: { ar: "عميل", fr: "Client", en: "Client" },
  operator: { ar: "مشغّل", fr: "Opérateur", en: "Operator" },
  secure_conn: { ar: "اتصال مشفّر 256-بت", fr: "Connexion chiffrée 256 bits", en: "256-bit encrypted connection" },
  privacy_note: {
    ar: "بياناتك مشفّرة ومحمية according لأعلى معايير الخصوصية.",
    fr: "Vos données sont chiffrées et protégées selon les plus hauts standards de confidentialité.",
    en: "Your data is encrypted and protected to the highest privacy standards.",
  },
  slots_title: { ar: "مواعيد الإصدار الرسمية", fr: "Créneaux officiels", en: "Official release slots" },
  stats_clients: { ar: "عميل مسجّل", fr: "Clients inscrits", en: "Registered clients" },
  stats_booked: { ar: "موعد محجوز", fr: "Rendez-vous réservé", en: "Appointments booked" },
  stats_success: { ar: "نسبة النجاح", fr: "Taux de réussite", en: "Success rate" },
  uptime: { ar: "جاهزية الخادم", fr: "Disponibilité", en: "Uptime" },

  /* ---------------- client area ---------------- */
  welcome: { ar: "مرحبًا", fr: "Bienvenue", en: "Welcome" },
  logout: { ar: "تسجيل الخروج", fr: "Déconnexion", en: "Log out" },
  my_quota: { ar: "رصيد المواعيد", fr: "Solde de rendez-vous", en: "Appointment quota" },
  quota_left: { ar: "موعد متبقٍ", fr: "rendez-vous restant(s)", en: "appointment(s) left" },
  cooldown_msg: {
    ar: "تم استنفاد حصة هذا الحساب. يمكن الحجز مجددًا بعد مرور شهر واحد.",
    fr: "Le quota de ce compte est épuisé. Nouvelle réservation possible après un mois.",
    en: "This account's quota is exhausted. Booking reopens after one month.",
  },
  new_request: { ar: "طلب حجز جديد", fr: "Nouvelle demande", en: "New booking request" },
  choose_slot: { ar: "اختر موعد الإصدار", fr: "Choisissez le créneau", en: "Choose a release slot" },
  personal_info: { ar: "المعلومات الشخصية", fr: "Informations personnelles", en: "Personal information" },
  contact_info: { ar: "معلومات الاتصال", fr: "Coordonnées", en: "Contact information" },
  passport_info: { ar: "بيانات جواز السفر", fr: "Données du passeport", en: "Passport details" },
  travel_info: { ar: "معلومات السفر والغرض", fr: "Informations de voyage", en: "Travel & purpose" },
  accommodation_info: { ar: "معلومات الإقامة", fr: "Informations d'hébergement", en: "Accommodation" },
  visa_history: { ar: "التأشيرات السابقة", fr: "Historique des visas", en: "Previous visas" },
  previous_visa_spain: {
    ar: "هل لديك تأشيرة إسبانيا من جانفي 2021؟",
    fr: "Avez-vous un visa Espagne délivré depuis janvier 2021 ?",
    en: "Do you hold a Spain visa issued since January 2021?",
  },
  submit_request: { ar: "إرسال الطلب", fr: "Envoyer la demande", en: "Submit request" },
  my_requests: { ar: "طلباتي", fr: "Mes demandes", en: "My requests" },
  status: { ar: "الحالة", fr: "Statut", en: "Status" },
  status_queued: { ar: "في الانتظار", fr: "En file d'attente", en: "Queued" },
  status_ready: { ar: "جاهز للإطلاق", fr: "Prêt à lancer", en: "Armed" },
  status_waiting_captcha: { ar: "بانتظار الكابتشا", fr: "Captcha en attente", en: "Awaiting captcha" },
  status_processing: { ar: "جارٍ الحجز", fr: "Réservation en cours", en: "Booking in progress" },
  status_booked: { ar: "تم الحجز ✓", fr: "Réservé ✓", en: "Booked ✓" },
  status_failed: { ar: "فشل", fr: "Échec", en: "Failed" },
  priority: { ar: "الأولوية", fr: "Priorité", en: "Priority" },
  attempts: { ar: "المحاولات", fr: "Tentatives", en: "Attempts" },
  reference: { ar: "رقم الحجز", fr: "Référence", en: "Reference" },
  appointment_at: { ar: "موعد الاستشارة", fr: "Rendez-vous", en: "Appointment" },

  /* ---------------- operator ---------------- */
  login_title: { ar: "دخول المشغّل", fr: "Connexion opérateur", en: "Operator login" },
  username: { ar: "اسم المستخدم", fr: "Identifiant", en: "Username" },
  password: { ar: "كلمة السر", fr: "Mot de passe", en: "Password" },
  login: { ar: "تسجيل الدخول", fr: "Connexion", en: "Sign in" },
  change_password: { ar: "تغيير كلمة السر", fr: "Changer le mot de passe", en: "Change password" },
  current_password: { ar: "كلمة السر الحالية", fr: "Mot de passe actuel", en: "Current password" },
  new_password: { ar: "كلمة السر الجديدة", fr: "Nouveau mot de passe", en: "New password" },
  confirm_password: { ar: "تأكيد كلمة السر", fr: "Confirmer", en: "Confirm password" },
  save: { ar: "حفظ", fr: "Enregistrer", en: "Save" },
  saved: { ar: "تم الحفظ", fr: "Enregistré", en: "Saved" },
  dashboard: { ar: "لوحة القيادة", fr: "Tableau de bord", en: "Dashboard" },
  engine: { ar: "محرّك الحجز", fr: "Moteur de réservation", en: "Booking engine" },
  queue: { ar: "الطابور", fr: "File d'attente", en: "Queue" },
  clients_admin: { ar: "إدارة العملاء", fr: "Gestion des clients", en: "Client management" },
  generate_codes: { ar: "توليد أكواد", fr: "Générer des codes", en: "Generate codes" },
  number_of_codes: { ar: "عدد الأكواد", fr: "Nombre de codes", en: "Number of codes" },
  generate: { ar: "توليد", fr: "Générer", en: "Generate" },
  recovery: { ar: "استرداد كلمة السر", fr: "Récupération du mot de passe", en: "Password recovery" },
  recovery_hint: {
    ar: "أدخل جميع بياناتك المسجّلة: اسم المستخدم، البريد الإلكتروني ورقم الهاتف الجزائري",
    fr: "Saisissez toutes vos informations enregistrées : identifiant, e-mail et numéro algérien",
    en: "Enter all your registered details: username, email and Algerian phone number",
  },
  recover: { ar: "استرداد", fr: "Récupérer", en: "Recover" },
  recovery_sent: {
    ar: "تم إرسال كلمة السر الجديدة إلى بريدك الإلكتروني",
    fr: "Nouveau mot de passe envoyé par e-mail",
    en: "New password sent to your email",
  },
  captcha_queue: { ar: "الكابتشا المعلّقة", fr: "Captchas en attente", en: "Pending captchas" },
  solve: { ar: "حلّ", fr: "Résoudre", en: "Solve" },
  audit_log: { ar: "سجل التدقيق", fr: "Journal d'audit", en: "Audit log" },
  settings: { ar: "الإعدادات", fr: "Paramètres", en: "Settings" },
  enable: { ar: "تفعيل", fr: "Activer", en: "Enable" },
  disable: { ar: "تعطيل", fr: "Désactiver", en: "Disable" },
  active: { ar: "نشط", fr: "Actif", en: "Active" },
  inactive: { ar: "معطّل", fr: "Inactif", en: "Inactive" },
  reset: { ar: "إعادة تعيين", fr: "Réinitialiser", en: "Reset" },

  /* ---------------- generic ---------------- */
  loading: { ar: "جارٍ التحميل…", fr: "Chargement…", en: "Loading…" },
  error: { ar: "خطأ", fr: "Erreur", en: "Error" },
  success: { ar: "نجاح", fr: "Succès", en: "Success" },
  cancel: { ar: "إلغاء", fr: "Annuler", en: "Cancel" },
  required: { ar: "حقل مطلوب", fr: "Champ obligatoire", en: "Required field" },
  invalid_code: { ar: "الكود غير صحيح أو منتهي", fr: "Code invalide ou expiré", en: "Invalid or expired code" },
  yes: { ar: "نعم", fr: "Oui", en: "Yes" },
  no: { ar: "لا", fr: "Non", en: "No" },
  back: { ar: "رجوع", fr: "Retour", en: "Back" },
  next: { ar: "التالي", fr: "Suivant", en: "Next" },
  privacy: { ar: "الخصوصية", fr: "Confidentialité", en: "Privacy" },
  timezone: { ar: "التوقيت", fr: "Fuseau horaire", en: "Timezone" },
  all: { ar: "الكل", fr: "Tous", en: "All" },
} as const;

export type MessageKey = keyof typeof dict;

export function t(key: MessageKey, locale: Locale): string {
  return dict[key][locale];
}

/** Server-side default so API responses carry readable errors. */
export const DEFAULT_LOCALE: Locale = "ar";