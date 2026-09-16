import { z } from "zod";

import { aiPricingSchema } from "@/features/ai-usage/pricing";

const localeSchema = z.enum(["en", "de"]);

const serverEnvSchema = z.object({
  APP_ENV: z.enum(["local", "dev", "prod"]).default("local"),
  APP_URL: z.url().default("http://localhost:3000"),
  BOT_LOCALE: localeSchema.default("de"),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  WHATSAPP_SIMULATOR_ENABLED: z.enum(["0", "1"]).default("0"),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_CHAT_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_IMAGE_MODEL: z.string().default("gpt-image-1"),
  OPENAI_PRICING_JSON: z
    .string()
    .default("{}")
    .transform((value, ctx): unknown => {
      try {
        return JSON.parse(value);
      } catch {
        ctx.addIssue({ code: "custom", message: "OPENAI_PRICING_JSON must be valid JSON" });
        return z.NEVER;
      }
    })
    .pipe(aiPricingSchema),
  PLATFORM_TIMEZONE: z.string().default("Europe/Berlin"),
  DEFAULT_OPEN_TIME: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("09:00"),
  DEFAULT_CLOSE_TIME: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default("18:00"),
  DEFAULT_BOOKING_INTERVAL_MINUTES: z.coerce.number().int().positive().default(30),
  PREVIEW_REQUESTS_PER_DAY: z.coerce.number().int().positive().default(3),
  PREVIEWS_PER_REQUEST: z.coerce.number().int().min(1).max(3).default(3),
});

export type BotLocale = z.infer<typeof localeSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let parsedEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  parsedEnv ??= serverEnvSchema.parse(process.env);
  return parsedEnv;
}

export function getBotLocale(): BotLocale {
  return localeSchema.catch("de").parse(process.env.BOT_LOCALE);
}

export function isWhatsAppSimulatorEnabled(): boolean {
  return getServerEnv().WHATSAPP_SIMULATOR_ENABLED === "1";
}

export function hasSupabaseConfig(): boolean {
  const env = getServerEnv();
  return Boolean(env.NEXT_PUBLIC_SUPABASE_URL && env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

export function requireSupabasePublicConfig() {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase public configuration is missing");
  }

  return {
    url: env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function requireSupabaseAdminConfig() {
  const publicConfig = requireSupabasePublicConfig();
  const serviceRoleKey = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  }

  return { ...publicConfig, serviceRoleKey };
}

export function requireWhatsAppConfig() {
  const env = getServerEnv();
  const missing = [
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`WhatsApp configuration is missing: ${missing.join(", ")}`);
  }

  return {
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID!,
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN!,
    appSecret: env.WHATSAPP_APP_SECRET!,
    verifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN!,
  };
}
