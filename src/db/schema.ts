import {
  pgTable,
  serial,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

/**
 * BLS Spain Visa — Algeria
 * High-performance appointment reservation server
 */

/* ------------------------------------------------------------------ */
/* Operators (staff)                                                    */
/* ------------------------------------------------------------------ */

export const operators = pgTable("operators", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  salt: text("salt").notNull(),
  displayName: text("display_name").notNull().default("Operator"),
  email: text("email"),
  phone: text("phone"),
  isActive: boolean("is_active").notNull().default(true),
  failedLogins: integer("failed_logins").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Clients — access via a 5-digit access code                           */
/* ------------------------------------------------------------------ */

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  email: text("email"),
  isActive: boolean("is_active").notNull().default(true),
  /** number of appointments the client may still create (quota) */
  quota: integer("quota").notNull().default(2),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Applicant data captured for the BLS application form                 */
/* ------------------------------------------------------------------ */

export const applicants = pgTable("applicants", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  surname: text("surname").notNull(),
  givenNames: text("given_names").notNull(),
  firstName: text("first_name"),
  fatherName: text("father_name"),
  motherName: text("mother_name"),
  gender: text("gender").notNull(),
  birthDate: text("birth_date").notNull(),
  birthPlace: text("birth_place").notNull(),
  countryOfBirth: text("country_of_birth"),
  nationality: text("nationality").notNull().default("Algerian"),
  previousNationality: text("previous_nationality"),
  countryOfResidence: text("country_of_residence").notNull().default("Algeria"),
  passportNumber: text("passport_number").notNull(),
  passportType: text("passport_type"),
  passportIssueDate: text("passport_issue_date"),
  passportExpiryDate: text("passport_expiry_date"),
  passportAuthority: text("passport_authority"),
  passportIssuePlace: text("passport_issue_place"),
  previousPassport: boolean("previous_passport").notNull().default(false),
  previousPassportNumber: text("previous_passport_number"),
  otherPassportUsed: boolean("other_passport_used").notNull().default(false),
  nationalId: text("national_id"),
  idCardNumber: text("id_card_number"),
  address: text("address").notNull(),
  city: text("city").notNull(),
  wilaya: text("wilaya").notNull(),
  postalCode: text("postal_code"),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  mobile: text("mobile"),
  occupation: text("occupation").notNull(),
  employer: text("employer"),
  maritalStatus: text("marital_status"),
  visaType: text("visa_type").notNull(),
  centre: text("centre").notNull().default("ALGIERS"),
  category: text("category").notNull(),
  purposeOfTravel: text("purpose_of_travel").notNull(),
  purposeDetails: text("purpose_details"),
  durationOfStay: text("duration_of_stay"),
  arrivalDate: text("arrival_date"),
  arrivalCity: text("arrival_city").default("Madrid"),
  departureDate: text("departure_date"),
  intendedStayDays: text("intended_stay_days"),
  numberOfAppointments: integer("number_of_appointments").notNull().default(1),
  termsAccepted: boolean("terms_accepted").notNull().default(false),
  accommodationType: text("accommodation_type"),
  accommodationName: text("accommodation_name"),
  accommodationAddress: text("accommodation_address"),
  accommodationPhone: text("accommodation_phone"),
  hostName: text("host_name"),
  hostPhone: text("host_phone"),
  hostAddress: text("host_address"),
  insuranceCompany: text("insurance_company"),
  insurancePolicyNumber: text("insurance_policy_number"),
  insuranceValidUntil: text("insurance_valid_until"),
  workEmployer: text("work_employer"),
  workAddress: text("work_address"),
  previousSchengenVisa: boolean("previous_schemen_visa").notNull().default(false),
  lastSpainVisaNumber: text("last_spain_visa_number"),
  lastSpainVisaIssueDate: text("last_spain_visa_issue_date"),
  lastSpainVisaExpiry: text("last_spain_visa_expiry"),
  lastSpainVisaCountry: text("last_spain_visa_country"),
  relativesInSpain: boolean("relatives_in_spain").notNull().default(false),
  relativeDetails: text("relative_details"),
  criminalRecord: boolean("criminal_record").notNull().default(false),
  fingerprintGivenBefore: boolean("fingerprint_given_before").notNull().default(false),
  biometricReceipt: text("biometric_receipt"),
  remarks: text("remarks"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Client quota slots: max 2 appointments, then a 1-month cooldown      */
/* ------------------------------------------------------------------ */

export const quotaClaims = pgTable("quota_claims", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id")
    .notNull()
    .references(() => clients.id, { onDelete: "cascade" }),
  applicantId: integer("applicant_id").references(() => applicants.id, {
    onDelete: "set null",
  }),
  bookedAt: timestamp("booked_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull().default("ACTIVE"),
});

/* ------------------------------------------------------------------ */
/* Reservation runs — the automated BLS booking jobs                    */
/* ------------------------------------------------------------------ */

export const bookingRuns = pgTable("booking_runs", {
  id: serial("id").primaryKey(),
  applicantId: integer("applicant_id")
    .notNull()
    .references(() => applicants.id, { onDelete: "cascade" }),
  slotKind: text("slot_kind").notNull(),
  status: text("status").notNull().default("QUEUED"),
  priority: integer("priority").notNull().default(100),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(400),
  reference: text("reference"),
  appointmentDate: text("appointment_date"),
  appointmentTime: text("appointment_time"),
  confirmationNumber: text("confirmation_number"),
  error: text("error"),
  timeline: jsonb("timeline").$type<Array<Record<string, unknown>>>().notNull().default([]),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const slotWindows = pgTable("slot_windows", {
  id: serial("id").primaryKey(),
  slotKind: text("slot_kind").notNull().unique(),
  /** HH:MM in Africa/Algiers */
  openTime: text("open_time").notNull(),
  dayOfWeek: integer("day_of_week").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true }),
  autoRefreshMs: integer("auto_refresh_ms"),
});

/* ------------------------------------------------------------------ */
/* Captcha — solved by a human, relayed to the automation engine        */
/* ------------------------------------------------------------------ */

export const captchaChallenges = pgTable("captcha_challenges", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => bookingRuns.id, { onDelete: "cascade" }),
  imageUrl: text("image_url"),
  sessionToken: text("session_token"),
  status: text("status").notNull().default("PENDING"),
  solution: text("solution"),
  solvedBy: text("solved_by"),
  solvedAt: timestamp("solved_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Session / security audit log                                         */
/* ------------------------------------------------------------------ */

export const sessionTokens = pgTable("session_tokens", {
  id: serial("id").primaryKey(),
  token: text("token").notNull().unique(),
  kind: text("kind").notNull(),
  subjectId: integer("subject_id"),
  ip: text("ip"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  actorKind: text("actor_kind").notNull(),
  action: text("action").notNull(),
  target: text("target"),
  detail: jsonb("detail").$type<Record<string, unknown>>().notNull().default({}),
  ip: text("ip"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const recoveryRequests = pgTable("recovery_requests", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  newPasswordHash: text("new_password_hash").notNull(),
  newPasswordSalt: text("new_password_salt").notNull(),
  status: text("status").notNull().default("PENDING"),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  channel: text("channel").notNull().unique(),
  target: text("target").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: jsonb("value").$type<unknown>().notNull(),
});

/** Connection settings for the automated booking engine -> BLS portal */
export const blsConnection = pgTable("bls_connection", {
  id: serial("id").primaryKey(),
  /** base URL of the official BLS Algeria portal */
  baseUrl: text("base_url").notNull().default("https://algeria.blsspainvisa.com"),
  appointmentPath: text("appointment_path").notNull().default("/appointment.php"),
  bookingType: text("booking_type").notNull().default("Individual"),
  centre: text("centre").notNull().default("ALGIERS"),
  category: text("category").notNull().default("ALG2"),
  /** optional proxy to route traffic, improves anonymity / resilience */
  proxyUrl: text("proxy_url"),
  /** rotating user-agent pool size */
  userAgentPoolSize: integer("user_agent_pool_size").notNull().default(5),
  acceptLanguage: text("accept_language").notNull().default("ar-DZ,ar;q=0.9,fr-DZ;q=0.8,fr;q=0.7,en;q=0.6"),
  /** request timeout per attempt in ms */
  requestTimeoutMs: integer("request_timeout_ms").notNull().default(15_000),
  /** enable high-velocity mode */
  highVelocity: boolean("high_velocity").notNull().default(true),
  /** seconds before the release instant the session is warmed up */
  preWarmSeconds: integer("pre_warm_seconds").notNull().default(45),
  /** max parallel runs in the hot window */
  maxParallelRuns: integer("max_parallel_runs").notNull().default(12),
  /** per-run attempt budget */
  attemptBudget: integer("attempt_budget").notNull().default(400),
  /** mandatory CAPTCHA solving by a human */
  humanCaptcha: boolean("human_captcha").notNull().default(true),
  /** optional shared verification token used by the portal */
  verificationCode: text("verification_code"),
  connected: boolean("connected").notNull().default(false),
  lastTestAt: timestamp("last_test_at", { withTimezone: true }),
  lastTestStatus: text("last_test_status"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Bridge channels: website <-> browser extension rendezvous */
export const bridgeChannels = pgTable("bridge_channels", {
  id: serial("id").primaryKey(),
  /** 6-char pairing code shown in the browser extension */
  pairCode: text("pair_code").notNull().unique(),
  operatorId: integer("operator_id").references(() => operators.id, { onDelete: "cascade" }),
  clientId: integer("client_id").references(() => clients.id, { onDelete: "cascade" }),
  status: text("status").notNull().default("ACTIVE"),
  /** extension reports browser fingerprint so the operator can identify it */
  extensionId: text("extension_id"),
  browserLabel: text("browser_label"),
  blsSessionReady: boolean("bls_session_ready").notNull().default(false),
  blsBookingUrl: text("bls_booking_url"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Tasks pushed from the server to the extension (open/fill/submit/captcha) */
export const bridgeTasks = pgTable("bridge_tasks", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => bookingRuns.id, { onDelete: "cascade" }),
  channelId: integer("channel_id")
    .notNull()
    .references(() => bridgeChannels.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  status: text("status").notNull().default("PENDING"),
  result: jsonb("result").$type<Record<string, unknown>>().notNull().default({}),
  attempts: integer("attempts").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  executedAt: timestamp("executed_at", { withTimezone: true }),
});

export const appointmentLocks = pgTable("appointment_locks", {
  id: serial("id").primaryKey(),
  resource: text("resource").notNull().unique(),
  lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Operator = typeof operators.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Applicant = typeof applicants.$inferSelect;
export type BookingRun = typeof bookingRuns.$inferSelect;
export type SlotWindow = typeof slotWindows.$inferSelect;
export type CaptchaChallenge = typeof captchaChallenges.$inferSelect;
export type AuditLog = typeof auditLog.$inferSelect;