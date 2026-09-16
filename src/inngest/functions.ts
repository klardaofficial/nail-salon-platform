import { subMinutes } from "date-fns";

import { deliverWhatsAppOutboxMessage } from "@/features/messaging/outbox";
import { processWhatsAppInboxEvent } from "@/features/conversation/process-event";
import { processStylePreview, queueStylePreviews } from "@/features/previews/process";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { inngest } from "./client";

export const processWhatsAppEvent = inngest.createFunction(
  {
    id: "process-whatsapp-event",
    retries: 5,
    concurrency: { limit: 1, key: "event.data.contactWaId" },
    triggers: [{ event: "whatsapp/event.received" }],
  },
  async ({ event, step }) => {
    const data = event.data as { inboxEventId: string; jobOutboxId?: string };
    const supabase = createSupabaseAdminClient();
    if (data.jobOutboxId) {
      await supabase
        .from("job_outbox")
        .update({ state: "processing", attempt_count: 1 })
        .eq("id", data.jobOutboxId);
    }
    try {
      const result = await step.run("process-event", () =>
        processWhatsAppInboxEvent(data.inboxEventId),
      );
      if (data.jobOutboxId) {
        await supabase.from("job_outbox").update({ state: "completed" }).eq("id", data.jobOutboxId);
      }
      return result;
    } catch (error) {
      if (data.jobOutboxId) {
        await supabase
          .from("job_outbox")
          .update({
            state: "failed",
            last_error_code:
              error instanceof Error ? error.message.slice(0, 120) : "processing_failed",
          })
          .eq("id", data.jobOutboxId);
      }
      throw error;
    }
  },
);

export const deliverWhatsAppMessage = inngest.createFunction(
  {
    id: "deliver-whatsapp-message",
    retries: 7,
    concurrency: { limit: 5 },
    triggers: [{ event: "whatsapp/message.queued" }],
  },
  async ({ event, step }) => {
    const { outboxId } = event.data as { outboxId: string };
    return step.run("deliver-message", () => deliverWhatsAppOutboxMessage(outboxId));
  },
);

export const generateStylePreview = inngest.createFunction(
  {
    id: "generate-style-preview",
    retries: 3,
    concurrency: { limit: 3 },
    triggers: [{ event: "preview/requested" }],
  },
  async ({ event, step }) => {
    const { previewId } = event.data as { previewId: string };
    const mediaIds = await step.run("download-generate-upload", () =>
      processStylePreview(previewId),
    );
    await step.run("queue-preview-delivery", () => queueStylePreviews(previewId, mediaIds));
    return { previewId, generated: mediaIds.length };
  },
);

export const recoverDurableOutboxes = inngest.createFunction(
  {
    id: "recover-durable-outboxes",
    retries: 2,
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    return step.run("redispatch", async () => {
      const supabase = createSupabaseAdminClient();
      const [jobs, messages, stalePreviews] = await Promise.all([
        supabase
          .from("job_outbox")
          .select("id,inbox_event_id,payload")
          .in("state", ["pending", "failed"])
          .lte("available_at", new Date().toISOString())
          .limit(50),
        supabase
          .from("message_outbox")
          .select("id")
          .in("state", ["pending", "failed"])
          .lte("available_at", new Date().toISOString())
          .limit(50),
        supabase
          .from("preview_requests")
          .select("id")
          .in("state", ["reserved", "processing"])
          .lt("updated_at", subMinutes(new Date(), 30).toISOString())
          .limit(50),
      ]);
      if (jobs.error) throw jobs.error;
      if (messages.error) throw messages.error;
      if (stalePreviews.error) throw stalePreviews.error;

      for (const job of jobs.data) {
        const inbox = await supabase
          .from("whatsapp_inbox_events")
          .select("contact_wa_id")
          .eq("id", job.inbox_event_id)
          .single();
        if (inbox.error) continue;
        await inngest.send({
          name: "whatsapp/event.received",
          data: {
            inboxEventId: job.inbox_event_id,
            jobOutboxId: job.id,
            contactWaId: inbox.data.contact_wa_id ?? "status",
          },
        });
        await supabase.from("job_outbox").update({ state: "dispatched" }).eq("id", job.id);
      }
      for (const message of messages.data) {
        await inngest.send({ name: "whatsapp/message.queued", data: { outboxId: message.id } });
      }
      for (const preview of stalePreviews.data) {
        await supabase.rpc("complete_preview_request", {
          p_request_id: preview.id,
          p_output_media_ids: [],
        });
      }
      return {
        jobs: jobs.data.length,
        messages: messages.data.length,
        stalePreviews: stalePreviews.data.length,
      };
    });
  },
);

export const inngestFunctions = [
  processWhatsAppEvent,
  deliverWhatsAppMessage,
  generateStylePreview,
  recoverDurableOutboxes,
];
