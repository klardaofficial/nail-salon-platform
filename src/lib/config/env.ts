import { z } from "zod";

import { aiPricingSchema } from "@/features/ai-usage/pricing";

const bootstrapEnvSchema = z.object({
  APP_ENV: z.enum(["local", "dev", "prod"]).default("local"),
  APP_URL: z.url().default("http://localhost:3000"),
  VERCEL_AUTOMATION_BYPASS_SECRET: z.string().optional(),
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1).optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
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
});
const serverEnvSchema = bootstrapEnvSchema.pick({
  APP_ENV: true,
  APP_URL: true,
  VERCEL_AUTOMATION_BYPASS_SECRET: true,
  NEXT_PUBLIC_SUPABASE_URL: true,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: true,
  SUPABASE_SERVICE_ROLE_KEY: true,
});

export type BotLocale = string;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type BootstrapEnv = z.infer<typeof bootstrapEnvSchema>;

let parsedEnv: ServerEnv | undefined;
let parsedBootstrapEnv: BootstrapEnv | undefined;

export function getServerEnv(): ServerEnv {
  parsedEnv ??= serverEnvSchema.parse(process.env);
  return parsedEnv;
}

export function getBootstrapEnv(): BootstrapEnv {
  parsedBootstrapEnv ??= bootstrapEnvSchema.parse(process.env);
  return parsedBootstrapEnv;
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
