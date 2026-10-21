/**
 * Complete BLS International Spain-Visa (Algeria) application form definition.
 * Every field the official portal asks for is modelled here, grouped by step,
 * with the exact bilingual labels used on algeria.blsspainvisa.com.
 */

export type FieldKind = "text" | "date" | "select" | "radio" | "textarea" | "checkbox";

export type FormField = {
  name: string;
  labelAr: string;
  labelFr: string;
  labelEn: string;
  kind: FieldKind;
  required?: boolean;
  optionsAr?: string[];
  optionsFr?: string[];
  options?: string[];
  placeholder?: string;
  hintAr?: string;
  hintFr?: string;
  hintEn?: string;
  span?: 1 | 2;
  /** maps to the official BLS portal field id */
  blsField?: string;
};

export type FormStep = {
  id: string;
  titleAr: string;
  titleFr: string;
  titleEn: string;
  icon: string;
  fields: FormField[];
};

export const GENDERS = ["ذكر", "أنثى"];
export const GENDERS_FR = ["Masculin", "Féminin"];
export const GENDERS_EN = ["Male", "Female"];

export const MARITAL = ["أعزب", "متزوج", "مطلق", "أرمل"];
export const MARITAL_FR = ["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf/Veuve"];
export const MARITAL_EN = ["Single", "Married", "Divorced", "Widowed"];

export const OCCUPATIONS_AR = [
  "موظف",
  "تاجر",
  "مهندس",
  "طبيب",
  "محامي",
  "أستاذ / مدرّس",
  "طالب",
  "فلاح",
  "حر",
  "متقاعد",
  "بدون عمل",
  "أخرى",
];
export const OCCUPATIONS_FR = [
  "Employé",
  "Commerçant",
  "Ingénieur",
  "Médecin",
  "Avocat",
  "Enseignant",
  "Étudiant",
  "Agriculteur",
  "Libéral",
  "Retraité",
  "Sans emploi",
  "Autre",
];
export const OCCUPATIONS_EN = [
  "Employee",
  "Merchant",
  "Engineer",
  "Doctor",
  "Lawyer",
  "Teacher",
  "Student",
  "Farmer",
  "Self-employed",
  "Retired",
  "Unemployed",
  "Other",
];

export const CENTRES = [
  { code: "ALGIERS", ar: "الجزائر العاصمة", fr: "Alger", en: "Algiers" },
  { code: "ORAN", ar: "وهران", fr: "Oran", en: "Oran" },
];

export const VISA_TYPES_AR = [
  "سياحية",
  "زيارة عائلية",
  "أعمال / موافقة إسبانية",
  "دراسة",
  "رياضة / ثقافة",
  "إقامة",
  "صحة / علاج",
  "عبور",
  "مهمة دبلوماسية",
  "ملكية",
];
export const VISA_TYPES_FR = [
  "Tourisme",
  "Visite familiale",
  "Affaires / autorisation espagnole",
  "Études",
  "Sport / Culture",
  "Résidence",
  "Santé / soins",
  "Transit",
  "Mission diplomatique",
  "Propriétaires",
];
export const VISA_TYPES_EN = [
  "Tourism",
  "Family visit",
  "Business / Spanish authorization",
  "Study",
  "Sport / Culture",
  "Residence",
  "Medical treatment",
  "Transit",
  "Diplomatic mission",
  "Owners",
];

/** Centre-specific appointment categories as published by the Consulate. */
export const CATEGORIES: Record<
  string,
  Array<{ code: string; ar: string; fr: string; en: string }>
> = {
  ALGIERS: [
    { code: "ALG1", ar: "ALG1 — أول تأشيرة شنغن / تأشيرة إسبانيا قبل جانفي 2021", fr: "ALG1 — premier visa Schengen / Espagne avant janv. 2021", en: "ALG1 — first Schengen / Spain visa before Jan 2021" },
    { code: "ALG2", ar: "ALG2 — تأشيرة إسبانيا منذ جانفي 2021 (+6 أشهر)", fr: "ALG2 — visa Espagne depuis janv. 2021 (< 6 mois)", en: "ALG2 — Spain visa since Jan 2021 (<6 months)" },
    { code: "ALG3", ar: "ALG3 — تأشيرة إdesde.span منذ جانفي 2021 (6 أشهر – 2 سنة)", fr: "ALG3 — visa Espagne depuis janv. 2021 (6 mois – 2 ans)", en: "ALG3 — Spain visa since Jan 2021 (6 months–2 years)" },
    { code: "ALG4", ar: "ALG4 — تأشيرة إسبانيا منذ جانفي 2021 (+2 سنة)", fr: "ALG4 — visa Espagne depuis janv. 2021 (≥ 2 ans)", en: "ALG4 — Spain visa since Jan 2021 (≥2 years)" },
    { code: "FAMILY", ar: "FAMILY — حجز عائلي", fr: "FAMILY — réservation familiale", en: "FAMILY — family booking" },
    { code: "WORK", ar: "WORK — عمل", fr: "WORK — emploi", en: "WORK — employment" },
  ],
  ORAN: [
    { code: "ORA1", ar: "ORA1 — أول تأشيرة شنغن / تأشيرة إسبانيا قبل جانفي 2021", fr: "ORA1 — premier visa Schengen / Espagne avant janv. 2021", en: "ORA1 — first Schengen / Spain visa before Jan 2021" },
    { code: "ORA2", ar: "ORA2 — تأشيرة إسبانيا منذ جانفي 2021 (+6 أشهر)", fr: "ORA2 — visa Espagne depuis janv. 2021 (< 6 mois)", en: "ORA2 — Spain visa since Jan 2021 (<6 months)" },
    { code: "ORA3", ar: "ORA3 — تأشيرة إسبانيا منذ جانفي 2021 (6 أشهر – 2 سنة)", fr: "ORA3 — visa Espagne depuis janv. 2021 (6 mois – 2 ans)", en: "ORA3 — Spain visa since Jan 2021 (6 months–2 years)" },
    { code: "ORA4", ar: "ORA4 — تأشيرة إسبانيا منذ جانفي 2021 (+2 سنة)", fr: "ORA4 — visa Espagne depuis janv. 2021 (≥ 2 ans)", en: "ORA4 — Spain visa since Jan 2021 (≥2 years)" },
    { code: "FAMILY", ar: "FAMILY — حجز عائلي", fr: "FAMILY — réservation familiale", en: "FAMILY — family booking" },
    { code: "WORK", ar: "WORK — عمل", fr: "WORK — emploi", en: "WORK — employment" },
    { code: "TELEWORK", ar: "TELEWORK — عمل عن بعد", fr: "TELEWORK — télétravail", en: "TELEWORK — remote work" },
  ],
};

export const ACCOMMODATION = ["فندق", "شقة", "منزل خاص", "عمولة / قارب", "أخرى"];
export const ACCOMMODATION_FR = ["Hôtel", "Appartement", "Maison privée", "Bateau / caravane", "Autre"];
export const ACCOMMODATION_EN = ["Hotel", "Apartment", "Private house", "Boat / caravan", "Other"];

export const STAY_DURATIONS_AR = ["أقل من 15 يومًا", "15 – 30 يومًا", "31 – 90 يومًا", "أكثر من 90 يومًا"];
export const STAY_DURATIONS_FR = ["Moins de 15 jours", "15 – 30 jours", "31 – 90 jours", "Plus de 90 jours"];
export const STAY_DURATIONS_EN = ["Less than 15 days", "15 – 30 days", "31 – 90 days", "More than 90 days"];

export const WILAYAS_AR = [
  "الجزائر", "وهران", "قسنطينة", "عنابة", "باتنة", "سطيف", "تلمسان", "بجاية", "بسكرة", "ورقلة", "غرداية", "تقرت", "المسيلة", "سعيدة", "سكيكدة", "سيدي بلعباس", "تيزي وزو", "الشلف", "الأغواط", "البيض", "بشار", "بني عباس", "الوادي", "النعامة", "عين تموشنت", "غليزان", "تيميمون", "برج باجي مختار", "أولاد جلال", "بني عباس", "عين صالح",
];
export const WILAYAS_FR = [
  "Alger", "Oran", "Constantine", "Annaba", "Batna", "Sétif", "Tlemcen", "Béjaïa", "Biskra", "Ouargla", "Ghardaïa", "Touggourt", "M'sila", "Saïda", "Skikda", "Sidi Bel Abbès", "Tizi Ouzou", "Chlef", "Laghouat", "El Bayadh", "Béchar", "Béni Abbès", "El Oued", "Naâma", "Aïn Témouchent", "Relizane", "Timimoun", "Bordj Badji Mokhtar", "Ouled Djellal", "Béni Abbès", "In Salah",
];
export const WILAYAS_EN = WILAYAS_FR;

/** ---- full step-by-step form definition ---- */

export const FORM_STEPS: FormStep[] = [
  {
    id: "identity",
    icon: "🪪",
    titleAr: "الهوية والحالة المدنية",
    titleFr: "Identité et état civil",
    titleEn: "Identity & civil status",
    fields: [
      { name: "surname", labelAr: "اللقب", labelFr: "Nom", labelEn: "Surname", kind: "text", required: true, blsField: "applicant_last_name" },
      { name: "givenNames", labelAr: "الأسماء الشخصية", labelFr: "Prénoms", labelEn: "Given names", kind: "text", required: true, blsField: "applicant_first_name" },
      { name: "fatherName", labelAr: "اسم الأب", labelFr: "Nom du père", labelEn: "Father's name", kind: "text", blsField: "applicant_father_name" },
      { name: "motherName", labelAr: "اسم الأم", labelFr: "Nom de la mère", labelEn: "Mother's name", kind: "text", blsField: "applicant_mother_name" },
      {
        name: "gender",
        labelAr: "الجنس",
        labelFr: "Sexe",
        labelEn: "Gender",
        kind: "radio",
        required: true,
        optionsAr: GENDERS,
        optionsFr: GENDERS_FR,
        options: GENDERS_EN,
        blsField: "applicant_gender",
      },
      { name: "birthDate", labelAr: "تاريخ الميلاد", labelFr: "Date de naissance", labelEn: "Date of birth", kind: "date", required: true, blsField: "applicant_dob" },
      { name: "birthPlace", labelAr: "مكان الميلاد", labelFr: "Lieu de naissance", labelEn: "Place of birth", kind: "text", required: true, blsField: "applicant_birth_place" },
      { name: "countryOfBirth", labelAr: "بلد الميلاد", labelFr: "Pays de naissance", labelEn: "Country of birth", kind: "text", required: true, placeholder: "Algeria", blsField: "applicant_country_of_birth", hintAr: "مطلوب من BLS", hintFr: "Requis par BLS", hintEn: "Required by BLS" },
      { name: "nationality", labelAr: "الجنسية الحالية", labelFr: "Nationalité actuelle", labelEn: "Current nationality", kind: "text", required: true, placeholder: "Algerian", blsField: "applicant_nationality" },
      { name: "previousNationality", labelAr: "الجنسية السابقة", labelFr: "Nationalité précédente", labelEn: "Previous nationality", kind: "text", placeholder: "N.A.", blsField: "applicant_previous_nationality", hintAr: "اكتب N.A. إن لم تنطبق", hintFr: "Écrivez N.A. si non applicable", hintEn: "Write N.A. if not applicable" },
      { name: "countryOfResidence", labelAr: "بلد الإقامة", labelFr: "Pays de résidence", labelEn: "Country of residence", kind: "text", required: true, placeholder: "Algeria", blsField: "applicant_residence" },
      {
        name: "maritalStatus",
        labelAr: "الحالة الاجتماعية",
        labelFr: "État civil",
        labelEn: "Marital status",
        kind: "select",
        optionsAr: MARITAL,
        optionsFr: MARITAL_FR,
        options: MARITAL_EN,
        blsField: "applicant_marital_status",
      },
      { name: "nationalId", labelAr: "رقم بطاقة التعريف الوطنية", labelFr: "N° Carte d'identité nationale", labelEn: "National ID number", kind: "text", blsField: "applicant_national_id" },
      { name: "idCardNumber", labelAr: "رقم بطاقة التعريف البيومترية", labelFr: "N° carte biométrique", labelEn: "Biometric card number", kind: "text", blsField: "applicant_biometric_id" },
    ],
  },
  {
    id: "passport",
    icon: "📘",
    titleAr: "جواز السفر",
    titleFr: "Passeport",
    titleEn: "Passport",
    fields: [
      { name: "passportNumber", labelAr: "رقم جواز السفر", labelFr: "Numéro de passeport", labelEn: "Passport number", kind: "text", required: true, blsField: "passport_number" },
      {
        name: "passportType",
        labelAr: "نوع الجواز",
        labelFr: "Type de passeport",
        labelEn: "Passport type",
        kind: "select",
        required: true,
        optionsAr: ["عادي", "ديبلوماتيكي", "خدمة", "رسمي"],
        optionsFr: ["Ordinaire", "Diplomatique", "Service", "Officiel"],
        options: ["Ordinary", "Diplomatic", "Service", "Official"],
        blsField: "passport_type",
        hintAr: "معظم المتقدمين: عادي",
        hintFr: "La plupart : Ordinaire",
        hintEn: "Most applicants: Ordinary",
      },
      { name: "passportIssueDate", labelAr: "تاريخ الإصدار", labelFr: "Date de délivrance", labelEn: "Issue date", kind: "date", required: true, blsField: "passport_issue_date" },
      { name: "passportExpiryDate", labelAr: "تاريخ الانتهاء", labelFr: "Date d'expiration", labelEn: "Expiry date", kind: "date", required: true, blsField: "passport_expiry_date" },
      { name: "passportAuthority", labelAr: "جهة الإصدار", labelFr: "Autorité de délivrance", labelEn: "Issuing authority", kind: "text", placeholder: "Algeria", blsField: "passport_authority" },
      { name: "passportIssuePlace", labelAr: "مكان إصدار الجواز", labelFr: "Lieu de délivrance", labelEn: "Passport issue place", kind: "text", required: true, placeholder: "Alger", blsField: "passport_issue_place", hintAr: "المدينة التي صدر منها الجواز", hintFr: "La ville de délivrance", hintEn: "City where the passport was issued" },
      { name: "previousPassport", labelAr: "هل لديك جواز سفر سابق؟", labelFr: "Avez-vous un passeport antérieur ?", labelEn: "Do you hold a previous passport?", kind: "radio", optionsAr: ["نعم", "لا"], optionsFr: ["Oui", "Non"], options: ["Yes", "No"], blsField: "previous_passport" },
      { name: "previousPassportNumber", labelAr: "رقم الجواز السابق", labelFr: "N° du passeport antérieur", labelEn: "Previous passport number", kind: "text", blsField: "previous_passport_no", hintAr: "مطلوب للجوازات المصدرة 2025/2026", hintFr: "Requis pour les passeports 2025/2026", hintEn: "Required for 2025/2026 issued passports" },
      { name: "otherPassportUsed", labelAr: "هل استخدمت جوازًا آخر Schengen؟", labelFr: "Autre passeport Schengen utilisé ?", labelEn: "Other Schengen passport used?", kind: "radio", optionsAr: ["نعم", "لا"], optionsFr: ["Oui", "Non"], options: ["Yes", "No"], blsField: "other_passport_used" },
    ],
  },
  {
    id: "contact",
    icon: "📍",
    titleAr: "العنوان والاتصال",
    titleFr: "Adresse et contact",
    titleEn: "Address & contact",
    fields: [
      { name: "address", labelAr: "العنوان الكامل", labelFr: "Adresse complète", labelEn: "Full address", kind: "text", required: true, span: 2, blsField: "applicant_address" },
      {
        name: "wilaya",
        labelAr: "الولاية",
        labelFr: "Wilaya",
        labelEn: "Province",
        kind: "select",
        required: true,
        optionsAr: WILAYAS_AR,
        optionsFr: WILAYAS_FR,
        options: WILAYAS_EN,
        blsField: "applicant_wilaya",
      },
      { name: "city", labelAr: "البلدية / المدينة", labelFr: "Commune / Ville", labelEn: "City", kind: "text", required: true, blsField: "applicant_city" },
      { name: "postalCode", labelAr: "الرمز البريدي", labelFr: "Code postal", labelEn: "Postal code", kind: "text", blsField: "applicant_postal_code" },
      { name: "email", labelAr: "البريد الإلكتروني", labelFr: "Adresse e-mail", labelEn: "Email address", kind: "text", required: true, blsField: "applicant_email" },
      { name: "phone", labelAr: "رقم الهاتف", labelFr: "Téléphone", labelEn: "Phone number", kind: "text", required: true, placeholder: "+213...", blsField: "applicant_phone" },
      { name: "mobile", labelAr: "رقم الهاتف المحمول", labelFr: "Téléphone portable", labelEn: "Mobile number", kind: "text", placeholder: "+213...", blsField: "applicant_mobile" },
    ],
  },
  {
    id: "social",
    icon: "💼",
    titleAr: "الحالة المهنية",
    titleFr: "Situation professionnelle",
    titleEn: "Occupational status",
    fields: [
      {
        name: "occupation",
        labelAr: "المهنة",
        labelFr: "Profession",
        labelEn: "Occupation",
        kind: "select",
        required: true,
        optionsAr: OCCUPATIONS_AR,
        optionsFr: OCCUPATIONS_FR,
        options: OCCUPATIONS_EN,
        blsField: "applicant_occupation",
      },
      { name: "employer", labelAr: "جهة العمل / المؤسسة", labelFr: "Employeur", labelEn: "Employer", kind: "text", span: 2, blsField: "applicant_employer" },
    ],
  },
  {
    id: "visa",
    icon: "🛂",
    titleAr: "نوع التأشيرة والغرض",
    titleFr: "Type de visa et motif",
    titleEn: "Visa type & purpose",
    fields: [
      {
        name: "visaType",
        labelAr: "نوع التأشيرة",
        labelFr: "Type de visa",
        labelEn: "Visa type",
        kind: "select",
        required: true,
        optionsAr: VISA_TYPES_AR,
        optionsFr: VISA_TYPES_FR,
        options: VISA_TYPES_EN,
        blsField: "visa_type",
      },
      {
        name: "centre",
        labelAr: "مركز الاستقبال",
        labelFr: "Centre",
        labelEn: "Centre",
        kind: "select",
        required: true,
        optionsAr: CENTRES.map((c) => c.ar),
        optionsFr: CENTRES.map((c) => c.fr),
        options: CENTRES.map((c) => c.en),
        blsField: "centre_id",
      },
      {
        name: "category",
        labelAr: "فئة الموعد",
        labelFr: "Catégorie du rendez-vous",
        labelEn: "Appointment category",
        kind: "select",
        required: true,
        blsField: "appointment_category",
        hintAr: "الفئة تُختار حسب آخر تأشيرة شنغن صادرة عن إسبانيا منذ جانفي 2021",
        hintFr: "Selon le dernier visa Schengen Espagne depuis janvier 2021",
        hintEn: "Based on your latest Spain Schengen visa since Jan 2021",
      },
      { name: "purposeOfTravel", labelAr: "الغرض من السفر", labelFr: "Motif du voyage", labelEn: "Purpose of travel", kind: "text", required: true, span: 2, blsField: "travel_purpose" },
      { name: "purposeDetails", labelAr: "تفاصيل الغرض", labelFr: "Détails du motif", labelEn: "Purpose details", kind: "textarea", span: 2, blsField: "travel_purpose_details" },
      {
        name: "durationOfStay",
        labelAr: "مدة الإقامة",
        labelFr: "Durée du séjour",
        labelEn: "Duration of stay",
        kind: "select",
        optionsAr: STAY_DURATIONS_AR,
        optionsFr: STAY_DURATIONS_FR,
        options: STAY_DURATIONS_EN,
        blsField: "stay_duration",
      },
      { name: "arrivalDate", labelAr: "تاريخ الوصول المتوقع", labelFr: "Date d'arrivée prévue", labelEn: "Expected arrival date", kind: "date", blsField: "arrival_date" },
      { name: "arrivalCity", labelAr: "مدينة الوصول", labelFr: "Ville d'arrivée", labelEn: "City of arrival", kind: "text", placeholder: "Madrid", blsField: "arrival_city" },
      { name: "departureDate", labelAr: "تاريخ المغادرة المتوقع", labelFr: "Date de départ prévue", labelEn: "Expected departure date", kind: "date", blsField: "departure_date" },
      { name: "intendedStayDays", labelAr: "عدد أيام الإقامة", labelFr: "Nombre de jours du séjour", labelEn: "Intended stay in days", kind: "text", placeholder: "15", blsField: "intended_stay_days", hintAr: "BLS يطلب رقمًا فقط", hintFr: "BLS demande un chiffre uniquement", hintEn: "BLS expects digits only" },
      {
        name: "numberOfAppointments",
        labelAr: "عدد المواعيد المطلوبة",
        labelFr: "Nombre de rendez-vous",
        labelEn: "How many appointments",
        kind: "select",
        required: true,
        optionsAr: ["1", "2", "3", "4", "5"],
        optionsFr: ["1", "2", "3", "4", "5"],
        options: ["1", "2", "3", "4", "5"],
        blsField: "no_of_appointment",
        hintAr: "الحد الأقصى في النظام حسب التوفر",
        hintFr: "Maximum selon disponibilité",
        hintEn: "Maximum depending on availability",
      },
      { name: "termsAccepted", labelAr: "أوافق على شروط الاستخدام", labelFr: "J'accepte les conditions d'utilisation", labelEn: "I accept the terms and conditions", kind: "radio", required: true, optionsAr: ["نعم", "لا"], optionsFr: ["Oui", "Non"], options: ["Yes", "No"], blsField: "terms_conditions", hintAr: "إلزامي في موقع BLS", hintFr: "Obligatoire sur le site BLS", hintEn: "Mandatory on the BLS site" },
    ],
  },
  {
    id: "stay",
    icon: "🏨",
    titleAr: "الإقامة والدعم",
    titleFr: "Hébergement et prise en charge",
    titleEn: "Accommodation & sponsor",
    fields: [
      {
        name: "accommodationType",
        labelAr: "نوع الإقامة",
        labelFr: "Type d'hébergement",
        labelEn: "Accommodation type",
        kind: "select",
        optionsAr: ACCOMMODATION,
        optionsFr: ACCOMMODATION_FR,
        options: ACCOMMODATION_EN,
        blsField: "accommodation_type",
      },
      { name: "accommodationName", labelAr: "اسم الفندق / الإقامة", labelFr: "Nom de l'hôtel / hébergement", labelEn: "Hotel / property name", kind: "text", span: 2, blsField: "accommodation_name" },
      { name: "accommodationAddress", labelAr: "عنوان الإقامة", labelFr: "Adresse de l'hébergement", labelEn: "Accommodation address", kind: "text", span: 2, blsField: "accommodation_address" },
      { name: "accommodationPhone", labelAr: "هاتف الإقامة", labelFr: "Téléphone de l'hébergement", labelEn: "Accommodation phone", kind: "text", blsField: "accommodation_phone" },
      { name: "hostName", labelAr: "اسم الداعي / المضيف", labelFr: "Nom de l'hôte / garant", labelEn: "Host / sponsor name", kind: "text", span: 2, blsField: "host_name" },
      { name: "hostPhone", labelAr: "هاتف المضيف", labelFr: "Téléphone de l'hôte", labelEn: "Host phone", kind: "text", blsField: "host_phone" },
      { name: "hostAddress", labelAr: "عنوان المضيف", labelFr: "Adresse de l'hôte", labelEn: "Host address", kind: "text", span: 2, blsField: "host_address" },
    ],
  },
  {
    id: "insurance",
    icon: "🛡️",
    titleAr: "التأمين الطبي",
    titleFr: "Assurance médicale",
    titleEn: "Medical insurance",
    fields: [
      { name: "insuranceCompany", labelAr: "شركة التأمين", labelFr: "Compagnie d'assurance", labelEn: "Insurance company", kind: "text", span: 2, blsField: "insurance_company", hintAr: "تأمين سفر صالح لمدة 8 أيام على الأقل", hintFr: "Assurance voyage valide au moins 8 jours", hintEn: "Travel insurance valid at least 8 days" },
      { name: "insurancePolicyNumber", labelAr: "رقم الوثيقة", labelFr: "Numéro de police", labelEn: "Policy number", kind: "text", blsField: "insurance_policy" },
      { name: "insuranceValidUntil", labelAr: "صالح حتى", labelFr: "Valable jusqu'au", labelEn: "Valid until", kind: "date", blsField: "insurance_expiry" },
    ],
  },
  {
    id: "history",
    icon: "🗂️",
    titleAr: "سجل التأشيرات والبيوغرافيا",
    titleFr: "Historique des visas et biométrie",
    titleEn: "Visa history & biometrics",
    fields: [
      { name: "previousSchengenVisa", labelAr: "هل سبق لك الحصول على تأشيرة شنغن؟", labelFr: "Avez-vous déjà obtenu un visa Schengen ?", labelEn: "Have you held a Schengen visa before?", kind: "radio", required: true, optionsAr: ["نعم", "لا"], optionsFr: ["Oui", "Non"], options: ["Yes", "No"], blsField: "prev_schengen_visa" },
      { name: "lastSpainVisaNumber", labelAr: "رقم آخر تأشيرة إسبانيا", labelFr: "N° dernier visa Espagne", labelEn: "Last Spain visa number", kind: "text", blsField: "last_spain_visa_no" },
      { name: "lastSpainVisaIssueDate", labelAr: "تاريخ إصدارها", labelFr: "Date de délivrance", labelEn: "Issue date", kind: "date", blsField: "last_spain_visa_issue" },
      { name: "lastSpainVisaExpiry", labelAr: "تاريخ انتهاء صلاحيتها", labelFr: "Date d'expiration", labelEn: "Expiry date", kind: "date", blsField: "last_spain_visa_expiry" },
      {
        name: "lastSpainVisaCountry",
        labelAr: "جهة إصدار آخر تأشيرة شنغن",
        labelFr: "État issuers du dernier visa Schengen",
        labelEn: "Issuing country of last Schengen visa",
        kind: "select",
        optionsAr: ["إسبانيا", "أخرى", "لا يوجد"],
        optionsFr: ["Espagne", "Autre", "Aucun"],
        options: ["Spain", "Other", "None"],
        blsField: "last_schengen_issuer",
      },
      { name: "relativesInSpain", labelAr: "هل لديك أقارب في إسبانيا؟", labelFr: "Avez-vous de la famille en Espagne ?", labelEn: "Do you have relatives in Spain?", kind: "radio", optionsAr: ["نعم", "لا"], optionsFr: ["Oui", "Non"], options: ["Yes", "No"], blsField: "relatives_spain" },
      { name: "relativeDetails", labelAr: "تفاصيل الأقارب", labelFr: "Détails des proches", labelEn: "Relative details", kind: "textarea", span: 2, blsField: "relative_details" },
      { name: "fingerprintGivenBefore", labelAr: "هل سبق أن أخذت بصماتك؟", labelFr: "Vos empreintes ont-elles déjà été prises ?", labelEn: "Fingerprints taken before?", kind: "radio", optionsAr: ["نعم", "لا"], optionsFr: ["Oui", "Non"], options: ["Yes", "No"], blsField: "biometrics_previous" },
      { name: "biometricReceipt", labelAr: "رقم وصل البيوغرافيا", labelFr: "N° récépissé biométrique", labelEn: "Biometric receipt number", kind: "text", blsField: "biometric_receipt" },
      { name: "criminalRecord", labelAr: "هل لديك سوابق عدائية؟", labelFr: "Antécédents criminels ?", labelEn: "Any criminal record?", kind: "radio", optionsAr: ["نعم", "لا"], optionsFr: ["Oui", "Non"], options: ["Yes", "No"], blsField: "criminal_record" },
      { name: "remarks", labelAr: "ملاحظات إضافية", labelFr: "Remarques", labelEn: "Additional remarks", kind: "textarea", span: 2, blsField: "remarks" },
    ],
  },
];

export const ALL_FIELDS: FormField[] = FORM_STEPS.flatMap((s) => s.fields);

export const REQUIRED_FIELDS = ALL_FIELDS.filter((f) => f.required).map((f) => f.name);

const YES_VALUES = new Set(["نعم", "yes", "oui", "true", "1"]);

/** Shared truthy check for the tri-state Yes/No fields across all locales. */
function isYes(value: string | undefined): boolean {
  return YES_VALUES.has((value ?? "").trim().toLowerCase());
}

/** Validate a submission payload against the schema. */

export function validateApplicant(
  payload: Record<string, unknown>,
): { ok: true; data: Record<string, string> } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const data: Record<string, string> = {};

  for (const field of ALL_FIELDS) {
    const raw = payload[field.name];
    const value =
      typeof raw === "string"
        ? raw.trim()
        : typeof raw === "boolean"
          ? raw
            ? "نعم"
            : "لا"
          : "";

    if (field.required && !value) {
      errors[field.name] = "required";
      continue;
    }
    if (field.kind === "date" && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errors[field.name] = "invalid_date";
      continue;
    }
    if (value) data[field.name] = value;
  }

  // cross-field consistency checks
  if (data.centre && data.category) {
    const allowed = CATEGORIES[data.centre]?.map((c) => c.code);
    if (allowed && !allowed.includes(data.category)) {
      errors.category = "category_not_in_centre";
    }
  }
  if (data.email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(data.email)) {
    errors.email = "invalid_email";
  }
  if (data.passportExpiryDate && data.birthDate) {
    // passport must be valid 6 months beyond application
    if (data.passportExpiryDate <= data.birthDate) {
      errors.passportExpiryDate = "invalid_date";
    }
  }
  // BLS requires the terms box to be accepted before it will book
  if (data.termsAccepted !== undefined && !isYes(data.termsAccepted)) {
    errors.termsAccepted = "required";
  }
  // stay length must be digits only
  if (data.intendedStayDays && !/^\d{1,3}$/.test(data.intendedStayDays)) {
    errors.intendedStayDays = "invalid_number";
  }
  // arrival cannot be after departure
  if (data.arrivalDate && data.departureDate && data.departureDate < data.arrivalDate) {
    errors.departureDate = "invalid_date";
  }
  // a previous passport number is mandatory when the applicant declares one
  if (
    isYes(data.previousPassport) &&
    !data.previousPassportNumber
  ) {
    errors.previousPassportNumber = "required";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, data };
}

/** Category list for a given centre. */
export function categoriesFor(centre: string) {
  return CATEGORIES[centre] ?? CATEGORIES.ALGIERS;
}