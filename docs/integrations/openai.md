# OpenAI integration

`OPENAI_CHAT_MODEL` and `OPENAI_IMAGE_MODEL` pin deployment-selected models; defaults are `gpt-5-mini` and `gpt-image-1`. Confirm model availability and cost in the target OpenAI project before release. Code uses the installed official JavaScript SDK.

Natural chat uses the Responses API with `store: false`, a stable safety identifier, serial tool calls, and app-owned context replay. The developer instructions in `features/conversation/respond.ts` fix language, flexible booking policy, date/time basis, permissions, and response style. They include a bounded active catalog and draft, not arbitrary database content.

Every function definition uses strict JSON Schema with all properties required and nullable values where optional. The model may request a tool; `executeConversationTool` parses again with Zod, resolves the verified actor, rechecks entity scope, records `(conversation_id, tool_call_id)`, and returns the saved result on replay. Database idempotency adds a second boundary for booking and preview actions.

Implemented tools:

- Customer: save draft, create booking, list own bookings, cancel own booking, request style preview.
- Owner: business booking summary, update owned salon, manage owned services, manage owned technicians.
- Technician: list assigned bookings, submit own optional time off.

Image previews call `images.edit` with the WhatsApp source image, a constrained preservation prompt, high input fidelity, low-quality JPEG output, and up to the configured count. Base64 returned by OpenAI is decoded in memory and immediately uploaded. It never enters job results, SQL, logs, files, or documentation. `store: false` controls Responses storage; OpenAI and WhatsApp still apply their own data retention policies.

Official references used for this implementation:

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling/)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation/)
- [OpenAI conversation state](https://developers.openai.com/api/docs/guides/conversation-state/)
- [OpenAI data controls](https://developers.openai.com/api/docs/guides/your-data/)

Live evaluations should cover ambiguous German/English dates under the fixed deployment locale, multiple similarly named salons, several services plus Other, no catalog/staff, replayed calls, cross-role requests, preview quota concurrency, and provider timeouts. Record only synthetic prompts/results.
