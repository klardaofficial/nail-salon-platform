import "server-only";

import OpenAI from "openai";

import type { EffectiveOpenAIConfiguration } from "@/features/organizations/providers";

const organizationClients = new Map<string, OpenAI>();

export function hasOpenAIConfig(
  configuration: EffectiveOpenAIConfiguration | null,
): configuration is EffectiveOpenAIConfiguration {
  return Boolean(configuration?.apiKey);
}

export function getOpenAIClient(configuration: EffectiveOpenAIConfiguration) {
  const key = `${configuration.organizationId}:${configuration.configurationVersion}`;
  const existing = organizationClients.get(key);
  if (existing) return existing;
  const created = new OpenAI({ apiKey: configuration.apiKey });
  organizationClients.set(key, created);
  return created;
}
