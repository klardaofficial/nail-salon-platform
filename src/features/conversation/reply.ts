import { z } from "zod";
import { normalizeLanguageCode } from "@/lib/bot/language";

export const naturalReplySchema = z.object({
  locale: z.string().min(2).max(64),
  text: z.string().min(1).max(1024),
  unavailableText: z.string().min(1).max(300),
  buttonLabel: z.string().min(1).max(20),
  sectionTitle: z.string().min(1).max(24),
  options: z
    .array(
      z.object({
        id: z.string().min(1).max(200),
        title: z.string().min(1).max(20),
        description: z.string().max(72).nullable(),
      }),
    )
    .max(10),
});

export type NaturalReply = z.infer<typeof naturalReplySchema>;

export function parseNaturalReply(text: string): NaturalReply | null {
  try {
    const parsed = naturalReplySchema.safeParse(JSON.parse(text));
    if (!parsed.success || !parsed.data.text.trim()) return null;
    const locale = normalizeLanguageCode(parsed.data.locale);
    if (!locale) return null;
    const ids = new Set(parsed.data.options.map((option) => option.id));
    if (ids.size !== parsed.data.options.length) return null;
    return { ...parsed.data, locale };
  } catch {
    return null;
  }
}
