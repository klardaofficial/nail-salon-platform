import "server-only";

import type { z } from "zod";
import type { OutboundWhatsAppPayload } from "@/integrations/whatsapp/types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type InboxMessages,
  type InboxThreads,
  messagesQuerySchema,
  threadsQuerySchema,
} from "./contracts";

export async function queryInboxThreads(
  organizationId: string,
  query: z.infer<typeof threadsQuerySchema>,
): Promise<InboxThreads> {
  const pageSize = 30;
  const result = await createSupabaseAdminClient().rpc("admin_whatsapp_threads", {
    p_organization_id: organizationId,
    p_channel: query.channel,
    p_search: query.search,
    p_role: query.role,
    p_offset: (query.page - 1) * pageSize,
    p_limit: pageSize,
  });
  if (result.error) throw result.error;
  return { ...(result.data as Omit<InboxThreads, "pageSize">), pageSize };
}

export async function queryInboxMessages(
  organizationId: string,
  query: z.infer<typeof messagesQuerySchema>,
): Promise<InboxMessages> {
  let request = createSupabaseAdminClient()
    .from("admin_organization_whatsapp_messages")
    .select("id,direction,created_at,state,text_content,message_type,media_id,payload")
    .eq("organization_id", organizationId)
    .eq("wa_id", query.waId)
    .eq("channel", query.channel)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);
  if (query.cursor) {
    const { at, id } = query.cursor;
    request = request.or(`created_at.lt.${at},and(created_at.eq.${at},id.lt.${id})`);
  }
  const result = await request;
  if (result.error) throw result.error;
  const page = result.data.slice(0, 50);
  const oldest = page.at(-1);
  return {
    nextCursor:
      result.data.length > 50 && oldest
        ? JSON.stringify({ at: oldest.created_at, id: oldest.id })
        : null,
    messages: page.reverse().map((item) => {
      const image =
        item.message_type === "image" && (item.media_id || simulatorImage(item.payload));
      return {
        id: item.id,
        direction: item.direction as "inbound" | "outbound",
        createdAt: item.created_at,
        state: item.state,
        text: item.text_content ?? "",
        mediaId: item.media_id,
        ...(image
          ? {
              imageUrl: `/api/admin/organizations/${organizationId}/inbox/images/${encodeURIComponent(item.id!)}`,
            }
          : {}),
        // Only interactive fields are needed by the browser. No raw provider payload.
        ...(interactivePayload(item.payload) ? { payload: interactivePayload(item.payload)! } : {}),
      };
    }),
  };
}

function simulatorImage(value: unknown) {
  if (!value || typeof value !== "object" || !("simulatorImage" in value)) return false;
  return (value as { simulatorImage?: { kind?: unknown } }).simulatorImage?.kind === "checkin_qr";
}

function interactivePayload(value: unknown): OutboundWhatsAppPayload | undefined {
  if (!value || typeof value !== "object" || !("kind" in value)) return undefined;
  if (value.kind !== "buttons" && value.kind !== "list") return undefined;
  const payload = value as Extract<OutboundWhatsAppPayload, { kind: "buttons" | "list" }>;
  const options = payload.options.map(({ id, title, description }) => ({ id, title, description }));
  return payload.kind === "buttons"
    ? { kind: "buttons", body: payload.body, options }
    : {
        kind: "list",
        body: payload.body,
        buttonLabel: payload.buttonLabel,
        sectionTitle: payload.sectionTitle,
        options,
      };
}
