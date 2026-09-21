import "server-only";

import { createNaturalReply } from "./respond";
import type { ConversationActor } from "./tools";
import {
  cancelBookingForContact,
  checkinBookingByStaff,
  confirmBookingFromIntent,
  formatCancelAction,
  formatUpdateAction,
  parseCancelAction,
  parseUpdateAction,
  rescheduleBookingFromDraft,
  SKIP_ACTION,
} from "./scripted-flow";
import {
  claimBookingIntentByCode,
  type ClaimedBookingIntent,
} from "@/features/booking-intents/claim";
import { extractIntentCode, stripIntentCode } from "@/features/booking-intents/code";
import { extractCheckinBookingId, stripCheckinTag } from "@/features/bookings/checkin-code";
import { queueInteractiveChoices, queueWhatsAppMessage } from "@/features/messaging/outbox";
import { resolveExternalWebsiteUrl } from "@/features/organizations/providers";
import { inngest } from "@/inngest/client";
import { queueSimulatedCheckinQrDelivery } from "@/features/bookings/checkin-delivery";
import type {
  NormalizedWhatsAppEvent,
  OutboundWhatsAppPayload,
} from "@/integrations/whatsapp/types";
import { unavailableFallback } from "@/lib/bot/language";
import {
  formatStaticDetails,
  formatStaticMessage,
  resolveStaticMessages,
} from "@/lib/bot/static-messages";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function normalizedMessageText(event: Extract<NormalizedWhatsAppEvent, { kind: "message" }>) {
  if (event.message.text) return event.message.text;
  return event.message.interactiveTitle ?? event.message.caption ?? "";
}

// Shared by the check-in-tag fast path (both modes) and the AI actor: staff
// scope always comes from these stored mappings, never a text claim.
async function resolveStaffRoles(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  input: { organizationId: string; contactId: string; waId: string },
) {
  const [owners, technicians] = await Promise.all([
    supabase
      .from("business_owners")
      .select("business_id")
      .eq("contact_id", input.contactId)
      .eq("organization_id", input.organizationId)
      .limit(1),
    supabase
      .from("technicians")
      .select("id")
      .eq("wa_id", input.waId)
      .eq("organization_id", input.organizationId)
      .eq("active", true)
      .is("deleted_at", null),
  ]);
  if (owners.error) throw owners.error;
  if (technicians.error) throw technicians.error;
  return {
    isOwner: Boolean(owners.data?.length),
    technicianIds: (technicians.data ?? []).map((technician) => technician.id),
  };
}

async function sendCheckinQrRequested(input: {
  organizationId: string;
  bookingId: string;
  conversationId: string;
  recipientWaId: string;
  locale: string;
  transport: "whatsapp" | "simulator";
}) {
  if (input.transport === "simulator") {
    await queueSimulatedCheckinQrDelivery(input);
    return;
  }
  await inngest.send({
    name: "booking/checkin-qr.requested",
    data: {
      organizationId: input.organizationId,
      bookingId: input.bookingId,
      conversationId: input.conversationId,
      recipientWaId: input.recipientWaId,
      locale: input.locale,
    },
  });
}

async function processStatus(
  organizationId: string,
  event: Extract<NormalizedWhatsAppEvent, { kind: "status" }>,
) {
  const state = ["failed", "deleted"].includes(event.status.value) ? "failed" : "sent";
  const { error } = await createSupabaseAdminClient()
    .from("message_outbox")
    .update({ state, failure_code: event.status.failureCode })
    .eq("provider_message_id", event.status.messageId)
    .eq("organization_id", organizationId);
  if (error) throw error;
}

export async function processWhatsAppInboxEvent(inboxEventId: string) {
  const supabase = createSupabaseAdminClient();
  const inboxResult = await supabase
    .from("whatsapp_inbox_events")
    .select("*")
    .eq("id", inboxEventId)
    .single();
  if (inboxResult.error) throw inboxResult.error;
  if (inboxResult.data.processed_at) {
    console.log("[whatsapp] inbox event already processed, skipping", { inboxEventId });
    return { duplicate: true };
  }
  const organizationId = inboxResult.data.organization_id;
  async function markProcessed() {
    const result = await supabase
      .from("whatsapp_inbox_events")
      .update({ processed_at: new Date().toISOString(), failure_code: null })
      .eq("id", inboxEventId);
    if (result.error) throw result.error;
  }
  const event = inboxResult.data.payload as NormalizedWhatsAppEvent;
  let messageSettings: {
    simulator_enabled: boolean;
    bot_locale: string;
    ai_bot_enabled: boolean;
    external_website_url: string | null;
  } | null = null;
  if (event.kind === "message") {
    const { data, error } = await supabase
      .from("organization_settings")
      .select("simulator_enabled,bot_locale,ai_bot_enabled,external_website_url")
      .eq("organization_id", organizationId)
      .single();
    if (error) throw error;
    messageSettings = data;
    if (event.simulated && !data.simulator_enabled) {
      console.error("[whatsapp] simulator event received but simulator_enabled=false", {
        organizationId,
        inboxEventId,
      });
      throw new Error("simulator_disabled");
    }
  }

  if (event.kind === "status") {
    await processStatus(organizationId, event);
    await markProcessed();
    return { processed: "status" };
  }

  const contactValues: Record<string, unknown> = {
    organization_id: organizationId,
    wa_id: event.contactWaId,
    normalized_phone: `+${event.contactWaId}`,
    last_contact_at: event.occurredAt,
  };
  if (event.profileName) contactValues.display_name = event.profileName;
  const contactResult = await supabase
    .from("contacts")
    .upsert(contactValues, { onConflict: "organization_id,wa_id" })
    .select("id,display_name,wa_id")
    .single();
  if (contactResult.error) throw contactResult.error;
  const contactId = contactResult.data.id;
  const transport = event.simulated ? "simulator" : "whatsapp";

  const conversationResult = await supabase
    .from("conversations")
    .upsert(
      {
        organization_id: organizationId,
        contact_id: contactId,
        channel: event.simulated ? "whatsapp_simulator" : "whatsapp",
        last_activity_at: event.occurredAt,
      },
      { onConflict: "organization_id,contact_id,channel" },
    )
    .select("id,reply_locale,reply_unavailable_text")
    .single();
  if (conversationResult.error) throw conversationResult.error;
  const conversationId = conversationResult.data.id;
  const replyTarget = {
    organizationId,
    transport,
    conversationId,
    recipientWaId: event.contactWaId,
    deduplicationKey: `conversation:${conversationId}:reply:${event.providerEventId}`,
  } as const;
  const locale = conversationResult.data.reply_locale ?? messageSettings!.bot_locale;
  // Deterministic replies reuse a detected conversation language when the AI
  // is in play (cheap, and keeps a switched-language chat consistent); with
  // the bot off there is no detection step, so they follow the organization
  // setting strictly, ignoring any reply_locale left over from before the
  // bot was turned off.
  const scriptedLocale = messageSettings!.ai_bot_enabled ? locale : messageSettings!.bot_locale;
  const rawMessageText = normalizedMessageText(event);
  // Extracted here (before history is stored) so the code never lands in
  // conversation_messages or the admin inbox; actually claimed further below,
  // after the duplicate/replay early-return, so a retried event can't burn an
  // intent for nothing and a completed draft can't be resurrected.
  const intentCode = extractIntentCode(rawMessageText);
  const checkinTagBookingId = extractCheckinBookingId(rawMessageText);
  const messageText = stripCheckinTag(
    intentCode ? stripIntentCode(rawMessageText) : rawMessageText,
  );
  const historyResult = await supabase
    .from("conversation_messages")
    .upsert(
      {
        organization_id: organizationId,
        conversation_id: conversationId,
        direction: "inbound",
        message_type: event.message.type,
        provider_message_id: event.providerEventId,
        text_content: messageText,
        media_id: event.message.mediaId,
        structured_content: {
          interactiveId: event.message.interactiveId,
          interactiveTitle: event.message.interactiveTitle,
          mimeType: event.message.mimeType,
        },
      },
      { onConflict: "organization_id,provider_message_id", ignoreDuplicates: true },
    )
    .select("id")
    .maybeSingle();
  if (historyResult.error) throw historyResult.error;
  if (!historyResult.data) {
    // Saving inbound history is not proof that an earlier attempt queued its reply.
    const existingReply = await supabase
      .from("message_outbox")
      .select("payload")
      .eq("deduplication_key", replyTarget.deduplicationKey)
      .eq("organization_id", organizationId)
      .maybeSingle();
    if (existingReply.error) throw existingReply.error;
    if (existingReply.data) {
      await queueWhatsAppMessage({
        ...replyTarget,
        payload: existingReply.data.payload as OutboundWhatsAppPayload,
      });
      await markProcessed();
      return { duplicate: true };
    }
  }

  // Priority #1, in both modes: a Cancel tap must never reach the model and
  // must never trigger a follow-up question.
  const cancelId = parseCancelAction(event.message.interactiveId);
  if (cancelId) {
    const outcome = await cancelBookingForContact({
      organizationId,
      contactId,
      bookingId: cancelId,
      transport,
    });
    const messages = resolveStaticMessages(scriptedLocale);
    await queueWhatsAppMessage({
      ...replyTarget,
      payload: {
        kind: "text",
        text:
          outcome.outcome === "cancelled"
            ? formatStaticMessage(messages.bookingCancelled, {
                reference: outcome.bookingId,
                website: resolveExternalWebsiteUrl(messageSettings!.external_website_url),
              })
            : messages.bookingNotCancellable,
      },
    });
    await markProcessed();
    return { processed: "message" };
  }

  // Priority #2, in both modes: a check-in tag must never reach the model.
  // Staff scope is resolved first so a non-staff sender (for example a
  // customer who forwards their own QR's decoded text) never even reaches
  // the RPC; checkin_organization_booking is still the actual authorization
  // choke point for a mapped sender. Silent fall-through on any outcome
  // other than checked_in/already_checked_in -- including not_checkinable --
  // mirrors the existing unknown-[BK-...]-code precedent below, so a stale
  // or cancelled booking's tag doesn't leak that it means anything.
  if (checkinTagBookingId) {
    const staffRoles = await resolveStaffRoles(supabase, {
      organizationId,
      contactId,
      waId: event.contactWaId,
    });
    if (staffRoles.isOwner || staffRoles.technicianIds.length) {
      const outcome = await checkinBookingByStaff({
        organizationId,
        actorContactId: contactId,
        actorWaId: event.contactWaId,
        bookingId: checkinTagBookingId,
      });
      if (outcome.outcome === "checked_in" || outcome.outcome === "already_checked_in") {
        const messages = resolveStaticMessages(scriptedLocale);
        await queueWhatsAppMessage({
          ...replyTarget,
          payload: {
            kind: "text",
            text:
              outcome.outcome === "checked_in"
                ? formatStaticMessage(messages.checkinDone, {
                    customer: outcome.customerName || "[N/A]",
                    appointment: outcome.startsAt,
                  })
                : messages.checkinAlready,
          },
        });
        await markProcessed();
        return { processed: "message" };
      }
    }
  }

  // Priority #3, in both modes: an Update/Skip tap on the "booking still
  // active" offer is handled the same way regardless of whether that offer
  // came from the BOOK-07 hand-off or the AI (the reschedule itself must stay
  // deterministic either way -- see rescheduleBookingFromDraft).
  const updateBookingId = parseUpdateAction(event.message.interactiveId);
  if (updateBookingId) {
    const outcome = await rescheduleBookingFromDraft({
      organizationId,
      contactId,
      conversationId,
      bookingId: updateBookingId,
      transport,
      idempotencyKey: `update:${event.providerEventId}`,
    });
    const messages = resolveStaticMessages(scriptedLocale);
    await queueWhatsAppMessage({
      ...replyTarget,
      payload: {
        kind: "text",
        text:
          outcome.outcome === "updated"
            ? formatStaticMessage(messages.updateApplied, { appointment: outcome.startsAt })
            : messages.updateUnavailable,
      },
    });
    await markProcessed();
    return { processed: "message" };
  }
  if (event.message.interactiveId === SKIP_ACTION) {
    const messages = resolveStaticMessages(scriptedLocale);
    await queueWhatsAppMessage({
      ...replyTarget,
      payload: { kind: "text", text: messages.skipAcknowledged },
    });
    await markProcessed();
    return { processed: "message" };
  }

  // Claiming happens for both modes: it seeds booking_drafts, which the AI
  // path still relies on when the bot is enabled.
  let claim: ClaimedBookingIntent | null = null;
  if (intentCode)
    claim = await claimBookingIntentByCode(organizationId, conversationId, intentCode);

  // Priority #2, in both modes: a successfully claimed hand-off needs no
  // judgment, so it is booked deterministically whether the bot is on or
  // off. A claim that cannot be booked (slot has passed, business inactive)
  // books nothing and falls through -- to the AI when the bot is on (it can
  // help pick a new time from the already-seeded draft), or to the static
  // "unavailable" message when the bot is off.
  let intentAttempted = false;
  if (claim) {
    intentAttempted = true;
    const businessResult = await supabase
      .from("businesses")
      .select("id")
      .eq("organization_id", organizationId)
      .single();
    if (businessResult.error) throw businessResult.error;
    const outcome = await confirmBookingFromIntent({
      organizationId,
      businessId: businessResult.data.id,
      contactId,
      conversationId,
      transport,
      claim,
    });
    if (outcome.outcome === "confirmed") {
      const messages = resolveStaticMessages(scriptedLocale);
      const details = formatStaticDetails(messages.fields, {
        appointment: outcome.startsAt,
        salon: outcome.salon ?? null,
        services: outcome.services ?? null,
        technician: outcome.technician ?? null,
        customer: contactResult.data.display_name || "[N/A]",
        phone: contactResult.data.wa_id,
      });
      await queueInteractiveChoices({
        ...replyTarget,
        body: formatStaticMessage(messages.bookingConfirmed, {
          details,
          reference: outcome.bookingId,
        }),
        buttonLabel: messages.cancelAction,
        sectionTitle: messages.cancelAction,
        options: [{ id: formatCancelAction(outcome.bookingId), title: messages.cancelAction }],
      });
      await sendCheckinQrRequested({
        organizationId,
        bookingId: outcome.bookingId,
        conversationId,
        recipientWaId: event.contactWaId,
        locale: scriptedLocale,
        transport,
      });
      await markProcessed();
      return { processed: "message" };
    } else if (outcome.outcome === "active_booking") {
      const messages = resolveStaticMessages(scriptedLocale);
      await queueInteractiveChoices({
        ...replyTarget,
        body: formatStaticMessage(messages.activeBookingBlocked, { appointment: outcome.startsAt }),
        buttonLabel: messages.updateAction,
        sectionTitle: messages.updateAction,
        options: [
          { id: formatUpdateAction(outcome.bookingId), title: messages.updateAction },
          { id: SKIP_ACTION, title: messages.skipAction },
        ],
      });
      await markProcessed();
      return { processed: "message" };
    }
  }

  if (!messageSettings!.ai_bot_enabled) {
    const messages = resolveStaticMessages(scriptedLocale);
    const website = resolveExternalWebsiteUrl(messageSettings!.external_website_url);
    // Scripted mode cannot interpret free text, but it must not send a
    // customer who already holds a future confirmed booking back to the
    // generic booking greeting. This also covers a new website hand-off whose
    // tag could not be claimed (for example after a client rewrites it): name
    // the existing booking and keep the deterministic Update/Skip route.
    if (!intentAttempted) {
      const active = await supabase
        .from("bookings")
        .select("id,local_time_label")
        .eq("organization_id", organizationId)
        .eq("contact_id", contactId)
        .eq("status", "confirmed")
        .gt("starts_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (active.error) throw active.error;
      if (active.data) {
        await queueInteractiveChoices({
          ...replyTarget,
          body: formatStaticMessage(messages.activeBookingBlocked, {
            appointment: active.data.local_time_label,
          }),
          buttonLabel: messages.updateAction,
          sectionTitle: messages.updateAction,
          options: [
            { id: formatUpdateAction(active.data.id), title: messages.updateAction },
            { id: SKIP_ACTION, title: messages.skipAction },
          ],
        });
        await markProcessed();
        return { processed: "message" };
      }
    }
    await queueWhatsAppMessage({
      ...replyTarget,
      payload: {
        kind: "text",
        text: intentAttempted
          ? formatStaticMessage(messages.bookingUnavailable, { website })
          : formatStaticMessage(messages.greeting, { website }),
      },
    });
    await markProcessed();
    return { processed: "message" };
  }

  const staffRoles = await resolveStaffRoles(supabase, {
    organizationId,
    contactId,
    waId: event.contactWaId,
  });
  const businessResult = await supabase
    .from("businesses")
    .select("id")
    .eq("organization_id", organizationId)
    .single();
  if (businessResult.error) throw businessResult.error;
  const recentMedia = event.message.mediaId
    ? { media_id: event.message.mediaId }
    : (
        await supabase
          .from("conversation_messages")
          .select("media_id")
          .eq("conversation_id", conversationId)
          .not("media_id", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data;
  const actor: ConversationActor = {
    organizationId,
    businessId: businessResult.data.id,
    transport,
    conversationId,
    contactId,
    waId: event.contactWaId,
    isOwner: staffRoles.isOwner,
    technicianIds: staffRoles.technicianIds,
    currentMediaId: recentMedia?.media_id ?? null,
    locale,
  };
  console.log("[whatsapp] calling createNaturalReply", { conversationId, transport, locale });
  const reply = await createNaturalReply(actor);
  console.log("[whatsapp] createNaturalReply result", {
    conversationId,
    hasReply: Boolean(reply),
    optionCount: reply?.options.length ?? 0,
    text: reply?.text,
  });
  const localeResult = await supabase
    .from("conversations")
    .update({
      reply_locale: reply?.locale ?? locale,
      ...(reply ? { reply_unavailable_text: reply.unavailableText } : {}),
    })
    .eq("id", conversationId);
  if (localeResult.error) throw localeResult.error;
  // A create_booking success carries confirmedBookingId (respond.ts), so the
  // same one-tap Cancel option offered in scripted mode is added here too --
  // the interactive button title comes from the static catalog since it must
  // be localized. The model sometimes already offers its own Cancel option for
  // the same booking (same id, different title): skip adding a second one.
  const cancelOptionId = reply?.confirmedBookingId
    ? formatCancelAction(reply.confirmedBookingId)
    : null;
  const cancelOption =
    reply && cancelOptionId && !reply.options.some((option) => option.id === cancelOptionId)
      ? { id: cancelOptionId, title: resolveStaticMessages(reply.locale).cancelAction }
      : null;
  if (reply?.confirmedBookingId) {
    await sendCheckinQrRequested({
      organizationId,
      bookingId: reply.confirmedBookingId,
      conversationId,
      recipientWaId: event.contactWaId,
      locale: reply.locale,
      transport,
    });
  }
  if (reply && (reply.options.length || cancelOption)) {
    await queueInteractiveChoices({
      ...replyTarget,
      body: reply.text,
      buttonLabel: reply.buttonLabel,
      sectionTitle: reply.sectionTitle,
      options: [
        ...reply.options.map((option) => ({
          ...option,
          description: option.description ?? undefined,
        })),
        ...(cancelOption ? [cancelOption] : []),
      ].slice(0, 10),
    });
  } else {
    await queueWhatsAppMessage({
      ...replyTarget,
      payload: {
        kind: "text",
        text: reply?.text ?? conversationResult.data.reply_unavailable_text ?? unavailableFallback,
      },
    });
  }
  console.log("[whatsapp] reply queued, marking inbox event processed", {
    conversationId,
    deduplicationKey: replyTarget.deduplicationKey,
  });
  await markProcessed();
  return { processed: "message" };
}
