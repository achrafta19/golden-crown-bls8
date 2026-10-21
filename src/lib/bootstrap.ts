import { db } from "@/db";
import { operators, notificationSettings, systemSettings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { hashPassword, makeSalt } from "./crypto";
import { ensureSlotWindows } from "./engine";

/**
 * Operator bootstrap credentials.
 *
 * In production every field must come from the environment — the development
 * defaults exist purely so a fresh clone runs locally. `deploymentWarnings()`
 * flags the defaults so they can never pass unnoticed on a public host.
 */
const DEV_DEFAULTS = {
  username: "blsvisa",
  password: "Achraf@001",
  email: "talebachraf73@gmail.com",
  phone: "+213555123143",
} as const;

/**
 * Reads an operator setting from the environment, falling back to the
 * development default. Missing values are surfaced through /api/health rather
 * than thrown, so a fresh host still boots and can be fixed from the console.
 */
function required(name: string, devValue: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : devValue;
}

export const DEFAULT_OPERATOR = {
  get username() {
    return required("OPERATOR_USERNAME", DEV_DEFAULTS.username);
  },
  get password() {
    return required("OPERATOR_PASSWORD", DEV_DEFAULTS.password);
  },
  get email() {
    return required("OPERATOR_EMAIL", DEV_DEFAULTS.email);
  },
  get phone() {
    return required("OPERATOR_PHONE", DEV_DEFAULTS.phone);
  },
};

let bootstrapped = false;

/**
 * Idempotent bootstrap: makes sure an operator exists and the release windows
 * are configured. Safe to call from any request path.
 */
export async function bootstrap(): Promise<void> {
  if (bootstrapped) return;
  try {
    await ensureSlotWindows();

    const rows = await db
      .select({ id: operators.id })
      .from(operators)
      .where(eq(operators.username, DEFAULT_OPERATOR.username))
      .limit(1);

    if (!rows[0]) {
      const salt = makeSalt();
      await db.insert(operators).values({
        username: DEFAULT_OPERATOR.username,
        salt,
        passwordHash: hashPassword(DEFAULT_OPERATOR.password, salt),
        displayName: "Chief Operator",
        email: DEFAULT_OPERATOR.email,
        phone: DEFAULT_OPERATOR.phone,
        isActive: true,
        passwordChangedAt: new Date(),
      });
    } else {
      // keep recovery contacts fresh
      await db
        .update(operators)
        .set({ email: DEFAULT_OPERATOR.email, phone: DEFAULT_OPERATOR.phone })
        .where(eq(operators.id, rows[0].id));
    }

    const notif = await db.select().from(notificationSettings);
    if (!notif.some((n) => n.channel === "EMAIL")) {
      await db.insert(notificationSettings).values({
        channel: "EMAIL",
        target: DEFAULT_OPERATOR.email,
        enabled: true,
      });
    }
    if (!notif.some((n) => n.channel === "SMS")) {
      await db.insert(notificationSettings).values({
        channel: "SMS",
        target: DEFAULT_OPERATOR.phone,
        enabled: true,
      });
    }

    const settings = await db.select().from(systemSettings);
    if (!settings.some((s) => s.key === "engine")) {
      await db.insert(systemSettings).values({
        key: "engine",
        value: {
          highVelocity: true,
          preWarmSeconds: 45,
          maxParallelRuns: 12,
          attemptBudget: 400,
          humanCaptcha: true,
        },
      });
    }

    bootstrapped = true;
  } catch (err) {
    // Never let a bootstrap failure break a request: the schema may not be
    // pushed yet, or a required env var may still be missing on a fresh host.
    bootstrapped = false;
    console.error("[bootstrap] skipped:", (err as Error).message);
  }
}

export type EngineSettings = {
  highVelocity: boolean;
  preWarmSeconds: number;
  maxParallelRuns: number;
  attemptBudget: number;
  humanCaptcha: boolean;
};

const DEFAULT_ENGINE: EngineSettings = {
  highVelocity: true,
  preWarmSeconds: 45,
  maxParallelRuns: 12,
  attemptBudget: 400,
  humanCaptcha: true,
};

export async function engineSettings(): Promise<EngineSettings> {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "engine"))
    .limit(1);
  const value = rows[0]?.value;
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return { ...DEFAULT_ENGINE, ...(value as Partial<EngineSettings>) };
  }
  return DEFAULT_ENGINE;
}

export async function updateEngineSettings(value: Record<string, unknown>) {
  const rows = await db
    .select()
    .from(systemSettings)
    .where(eq(systemSettings.key, "engine"))
    .limit(1);
  if (rows[0]) {
    await db
      .update(systemSettings)
      .set({ value })
      .where(sql`${systemSettings.key} = 'engine'`);
  } else {
    await db.insert(systemSettings).values({ key: "engine", value });
  }
}