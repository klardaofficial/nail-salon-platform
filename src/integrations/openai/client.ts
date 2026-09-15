import "server-only";

import OpenAI from "openai";

import { getServerEnv } from "@/lib/config/env";

let client: OpenAI | undefined;

export function hasOpenAIConfig() {
  return Boolean(getServerEnv().OPENAI_API_KEY);
}

export function getOpenAIClient() {
  const apiKey = getServerEnv().OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is missing");
  client ??= new OpenAI({ apiKey });
  return client;
}
