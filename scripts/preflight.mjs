#!/usr/bin/env node
/**
 * Deployment pre-flight check.
 *
 * Verifies that everything required for a production host is in place before
 * you push. Run it with:  npm run preflight
 */

const REQUIRED = [
  ["DATABASE_URL", "PostgreSQL connection string (Supabase / Neon / Railway)"],
  ["OPERATOR_USERNAME", "Operator login username"],
  ["OPERATOR_PASSWORD", "Operator password (min. 8 chars)"],
  ["OPERATOR_EMAIL", "Email used for password recovery"],
  ["OPERATOR_PHONE", "Algerian phone used for password recovery"],
];

const RECOMMENDED = [
  ["DATA_ENCRYPTION_KEY", "Dedicated key for encrypting applicant PII"],
  ["SMTP_HOST", "SMTP host so recovery emails are delivered"],
  ["SMTP_USER", "SMTP username"],
  ["SMTP_PASS", "SMTP password / app password"],
  ["SMTP_FROM", "Sender address for outgoing mail"],
];

let failed = 0;
let warned = 0;

function line(ok, label, hint) {
  const mark = ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  console.log(`  ${mark} ${label.padEnd(22)} ${hint}`);
}

console.log("\n\x1b[1m🔺 Golden Crown BLS — deployment pre-flight\x1b[0m\n");

console.log("\x1b[1mRequired:\x1b[0m");
for (const [key, hint] of REQUIRED) {
  const value = process.env[key];
  const ok = Boolean(value && value.trim());
  if (!ok) failed += 1;
  if (key === "OPERATOR_PASSWORD" && value && value.length < 8) {
    line(false, key, "too short (min. 8 characters)");
    failed += 1;
    continue;
  }
  if (key === "OPERATOR_PASSWORD" && value === "Achraf@001") {
    line(false, key, "still the default — change it");
    failed += 1;
    continue;
  }
  line(ok, key, ok ? "set" : `MISSING — ${hint}`);
}

console.log("\n\x1b[1mRecommended:\x1b[0m");
for (const [key, hint] of RECOMMENDED) {
  const ok = Boolean(process.env[key] && process.env[key].trim());
  if (!ok) warned += 1;
  line(ok, key, ok ? "set" : `not set — ${hint}`);
}

console.log("");
if (failed > 0) {
  console.log(`\x1b[31m\x1b[1m✗ ${failed} required variable(s) missing — cannot deploy.\x1b[0m\n`);
  process.exit(1);
}
if (warned > 0) {
  console.log(`\x1b[33m\x1b[1m! ${warned} optional variable(s) missing — the app will run but with degraded features.\x1b[0m\n`);
} else {
  console.log("\x1b[32m\x1b[1m✓ All configuration present.\x1b[0m\n");
}