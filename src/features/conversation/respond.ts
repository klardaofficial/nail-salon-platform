import "server-only";

import type {
  EasyInputMessage,
  ResponseFunctionToolCall,
  ResponseInput,
} from "openai/resources/responses/responses";

import { executeConversationTool, toolsForActor, type ConversationActor } from "./tools";
import { getOpenAIClient, hasOpenAIConfig } from "@/integrations/openai/client";
import { getBotLocale, getServerEnv } from "@/lib/config/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function functionCalls(output: { type: string }[]): ResponseFunctionToolCall[] {
  return output.filter((item) => item.type === "function_call") as ResponseFunctionToolCall[];
}

export async function createNaturalReply(actor: ConversationActor) {
  if (!hasOpenAIConfig()) return null;
  const supabase = createSupabaseAdminClient();
  const [history, salons, draft] = await Promise.all([
    supabase
      .from("conversation_messages")
      .select("direction,text_content,message_type,created_at")
      .eq("conversation_id", actor.conversationId)
      .not("text_content", "is", null)
      .order("created_at", { ascending: false })
      .limit(18),
    supabase
      .from("salons")
      .select(
        "id,name,location_label,timezone,default_open_time,default_close_time,customer_can_choose_technician,business_id,services(id,name,description,active),technicians(id,display_name,active,technician_time_off(starts_at,ends_at))",
      )
      .eq("active", true)
      .is("deleted_at", null),
    supabase
      .from("booking_drafts")
      .select("*")
      .eq("conversation_id", actor.conversationId)
      .maybeSingle(),
  ]);
  if (history.error) throw history.error;
  if (salons.error) throw salons.error;
  if (draft.error) throw draft.error;

  const locale = getBotLocale();
  const language = locale === "de" ? "German" : "English";
  const catalog = (salons.data ?? []).map((salon) => ({
    id: salon.id,
    businessId: salon.business_id,
    name: salon.name,
    location: salon.location_label,
    timezone: salon.timezone,
    openingHours: `${salon.default_open_time}-${salon.default_close_time}`,
    services: (salon.services ?? [])
      .filter((service) => service.active)
      .map(({ id, name, description }) => ({ id, name, description })),
    technicians: (salon.technicians ?? [])
      .filter((technician) => technician.active)
      .map(({ id, display_name, technician_time_off }) => ({
        id,
        name: display_name,
        recordedTimeOff: technician_time_off,
      })),
    customerCanChooseTechnician: salon.customer_can_choose_technician,
  }));

  const instructions = `You are the friendly WhatsApp assistant for a multi-salon nail booking platform.
Always reply in ${language}. Keep replies warm, concise, and suitable for WhatsApp. Use plain text with short lines.
Understand natural dates, times, salon names, locations, services, and technicians. Current time is ${new Date().toISOString()}.
The supplied timestamps must include an offset. Use each salon's timezone when interpreting local time.
A booking requires only an active salon and a future start time. Services, technician, duration, capacity, price, and attendance are optional.
Never reject a valid future booking because of capacity, duration, missing services, missing technician, or recorded time off.
Time off only guides suggestions. Do not promise availability. A soft technician reference can be absent or unresolved.
Customers may select multiple services, choose Other, and add an optional request. If a salon has no services, ask only for an optional request.
When only one active salon exists, use it without asking the customer to choose. With multiple salons, make sure one is selected before booking.
Before create_booking, summarize the known details and obtain clear customer agreement. create_booking auto-confirms the appointment.
For image previews, ask what style the customer wants, then call request_style_preview. Never claim that application storage keeps image bytes.
Only cancel a customer's own booking before its start. Never describe a booking as attended or missed.
Recognized owners may use owner tools only for their owned businesses. Recognized technicians may see only their assigned bookings and record their own time off.
If a tool returns an error, explain the recoverable next step without exposing internal details.
Active catalog JSON: ${JSON.stringify(catalog)}
Owner business IDs for this identity: ${JSON.stringify(actor.ownerBusinessIds)}
Technician record IDs for this identity: ${JSON.stringify(actor.technicianIds)}
Current booking draft: ${JSON.stringify(draft.data ?? null)}
Current message includes a usable image: ${actor.currentMediaId ? "yes" : "no"}.`;

  const messages: EasyInputMessage[] = [...(history.data ?? [])].reverse().map((message) => ({
    role: message.direction === "inbound" ? "user" : "assistant",
    content: message.text_content ?? "",
    ...(message.direction === "outbound" ? { phase: "final_answer" as const } : {}),
  }));
  let input: ResponseInput = messages;
  const client = getOpenAIClient();
  const tools = toolsForActor(actor);

  for (let round = 0; round < 5; round += 1) {
    const response = await client.responses.create({
      model: getServerEnv().OPENAI_CHAT_MODEL,
      instructions,
      input,
      tools,
      tool_choice: "auto",
      parallel_tool_calls: false,
      store: false,
      safety_identifier: actor.contactId,
    });
    const calls = functionCalls(response.output);
    if (!calls.length) return response.output_text.trim() || null;

    input = [...input, ...(response.output as ResponseInput)];
    for (const call of calls) {
      const result = await executeConversationTool(actor, call);
      input.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(result),
      });
    }
  }
  return null;
}
