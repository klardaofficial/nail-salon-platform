import { subMinutes } from "date-fns";

import { deliverWhatsAppOutboxMessage } from "@/features/messaging/outbox";
import { processWhatsAppInboxEvent } from "@/features/conversation/process-event";
import {
  renderAndUploadCheckinQr,
  queueCheckinQrDelivery,
} from "@/features/bookings/checkin-delivery";
import { processStylePreview, queueStylePreviews } from "@/features/previews/process";
import { queueDueBookingReminders } from "@/features/bookings/reminder-delivery";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

import { inngest } from "./client";

export const processWhatsAppEvent = inngest.createFunction(
  {
    id: "process-whatsapp-event",
    retries: 5,
    concurrency: { limit: 1, key: "event.data.organizationId + ':' + event.data.contactWaId" },
    triggers: [{ event: "whatsapp/event.received" }],
  },
  async ({ event, step }) => {
    const data = event.data as {
      organizationId?: string;
      inboxEventId: string;
      jobOutboxId?: string;
    };
    console.log("[inngest] process-whatsapp-event started", data);
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
      console.log("[inngest] process-whatsapp-event completed", {
        inboxEventId: data.inboxEventId,
        result,
      });
      return result;
    } catch (error) {
      console.error("[inngest] process-whatsapp-event failed", {
        inboxEventId: data.inboxEventId,
        error,
      });
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
    console.log("[inngest] deliver-whatsapp-message started", { outboxId });
    try {
      const result = await step.run("deliver-message", () =>
        deliverWhatsAppOutboxMessage(outboxId),
      );
      console.log("[inngest] deliver-whatsapp-message completed", { outboxId, result });
      return result;
    } catch (error) {
      console.error("[inngest] deliver-whatsapp-message failed", { outboxId, error });
      throw error;
    }
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
    const { organizationId, previewId } = event.data as {
      organizationId: string;
      previewId: string;
    };
    const mediaIds = await step.run("download-generate-upload", () =>
      processStylePreview(organizationId, previewId),
    );
    await step.run("queue-preview-delivery", () =>
      queueStylePreviews(organizationId, previewId, mediaIds),
    );
    return { previewId, generated: mediaIds.length };
  },
);

export const generateCheckinQr = inngest.createFunction(
  {
    id: "generate-checkin-qr",
    retries: 3,
    concurrency: { limit: 3 },
    triggers: [{ event: "booking/checkin-qr.requested" }],
  },
  async ({ event, step }) => {
    const { organizationId, bookingId, conversationId, recipientWaId, locale } = event.data as {
      organizationId: string;
      bookingId: string;
      conversationId: string;
      recipientWaId: string;
      locale: string;
    };
    const mediaId = await step.run("render-upload-checkin-qr", () =>
      renderAndUploadCheckinQr(organizationId, bookingId),
    );
    await step.run("queue-checkin-qr-delivery", () =>
      queueCheckinQrDelivery({
        organizationId,
        bookingId,
        conversationId,
        recipientWaId,
        locale,
        mediaId,
      }),
    );
    return { bookingId, delivered: true };
  },
);

// The shared five-minute maintenance tick: outbox/job recovery plus the
// booking-reminder scan (queueDueBookingReminders) both run here as separate
// memoized steps rather than as a second Inngest function, because Inngest
// bills per function run and this cron schedule already covers what the
// reminder scan needs.
export const recoverDurableOutboxes = inngest.createFunction(
  {
    id: "recover-durable-outboxes",
    retries: 2,
    triggers: [{ cron: "*/5 * * * *" }],
  },
  async ({ step }) => {
    const redispatch = await step.run("redispatch", async () => {
      const supabase = createSupabaseAdminClient();
      const [jobs, messages, stalePreviews] = await Promise.all([
        supabase
          .from("job_outbox")
          .select("id,inbox_event_id,payload,organization_id")
          .in("state", ["pending", "failed"])
          .lte("available_at", new Date().toISOString())
          .limit(50),
        supabase
          .from("message_outbox")
          .select("id,organization_id")
          .in("state", ["pending", "failed"])
          .lte("available_at", new Date().toISOString())
          .limit(50),
        supabase
          .from("preview_requests")
          .select("id,organization_id")
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
          .select("contact_wa_id,organization_id")
          .eq("id", job.inbox_event_id)
          .single();
        if (inbox.error) continue;
        await inngest.send({
          name: "whatsapp/event.received",
          data: {
            inboxEventId: job.inbox_event_id,
            jobOutboxId: job.id,
            organizationId: job.organization_id,
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
          p_organization_id: preview.organization_id,
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
    // A separate step (rather than inlining this in "redispatch") is
    // deliberate: step results are memoized, so a reminder failure retries
    // only this step on the next attempt and never re-runs outbox
    // redispatch.
    const reminders = await step.run("queue-booking-reminders", () => queueDueBookingReminders());
    return { ...redispatch, reminders };
  },
);

export const inngestFunctions = [
  processWhatsAppEvent,
  deliverWhatsAppMessage,
  generateStylePreview,
  generateCheckinQr,
  recoverDurableOutboxes,
];
