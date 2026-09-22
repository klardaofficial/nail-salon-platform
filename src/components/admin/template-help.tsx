"use client";

import { useState, type ReactNode } from "react";
import { QuestionIcon } from "@phosphor-icons/react";
import { Button, Modal, Typography } from "antd";

const { Paragraph, Text } = Typography;

// A Form.Item label with a small (?) button that opens a Modal explaining
// the Meta template format the admin must author in the Meta developer
// console for this field. Shared by organization-settings-client.tsx and
// system-settings-client.tsx, for both templates and reminders.
export function TemplateHelpLabel({
  label,
  title,
  children,
}: {
  label: ReactNode;
  title: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Button
        type="text"
        size="small"
        shape="circle"
        icon={<QuestionIcon size={14} />}
        aria-label={`Explain ${title}`}
        onClick={(event) => {
          event.preventDefault();
          setOpen(true);
        }}
      />
      <Modal title={title} open={open} footer={null} onCancel={() => setOpen(false)}>
        {children}
      </Modal>
    </span>
  );
}

export const reminderTemplateHelp = (
  <>
    <Paragraph>
      Create a Meta message template in the Meta developer console (WhatsApp Manager →
      Message Templates) with a body that takes exactly <Text strong>2 positional
      variables</Text>, in this order:
    </Paragraph>
    <Paragraph>
      <Text code>{"{{1}}"}</Text> — the customer&apos;s name
      <br />
      <Text code>{"{{2}}"}</Text> — the appointment time
    </Paragraph>
    <Paragraph>
      Example body: <Text italic>&quot;Hi {"{{1}}"}, this is a reminder for your appointment
      at {"{{2}}"}. See you soon!&quot;</Text>
    </Paragraph>
    <Paragraph>
      With sample values: <Text italic>&quot;Hi <b>Maria Schmidt</b>, this is a reminder for your
      appointment at <b>Sep 20, 2026, 3:00 PM</b>. See you soon!&quot;</Text>
    </Paragraph>
    <Paragraph>
      Once Meta approves the template, enter its exact template name here. The template
      must be approved in the same language as this organization&apos;s bot language.
    </Paragraph>
    <Paragraph type="secondary">
      One shared template is used for every reminder time you configure below. If no
      reminder template is set here or at the system level, reminders are not sent — there
      is no plain-text fallback, because Meta rejects business-initiated messages outside
      the 24-hour customer-service window unless they use an approved template.
    </Paragraph>
  </>
);

export const technicianTemplateHelp = (
  <>
    <Paragraph>
      Create a Meta message template in the Meta developer console with a body that takes
      exactly <Text strong>5 positional variables</Text>, in this order:
    </Paragraph>
    <Paragraph>
      <Text code>{"{{1}}"}</Text> — salon name
      <br />
      <Text code>{"{{2}}"}</Text> — customer name
      <br />
      <Text code>{"{{3}}"}</Text> — customer phone number
      <br />
      <Text code>{"{{4}}"}</Text> — appointment time
      <br />
      <Text code>{"{{5}}"}</Text> — booking reference
    </Paragraph>
    <Paragraph>
      Example confirmation body: <Text italic>&quot;New booking at {"{{1}}"}: {"{{2}}"}
      ({"{{3}}"}) at {"{{4}}"}. Ref {"{{5}}"}.&quot;</Text>
      <br/>
      Example cancellation body: <Text italic>&quot;Booking cancelled at {"{{1}}"}:
      {"{{2}}"} ({"{{3}}"}) at {"{{4}}"} was cancelled. Ref {"{{5}}"}.&quot;</Text>
    </Paragraph>
    <Paragraph>
      With sample values (confirmation): <Text italic>&quot;New booking at <b>Glow Nails
      Berlin</b>: <b>Maria Schmidt</b> (<b>+49 151 23456789</b>) at <b>Sep 20, 2026, 3:00 PM</b>.
      Ref <b>8f3c1a</b>.&quot;</Text>
      <br/>
      With sample values (cancellation): <Text italic>&quot;Booking cancelled at <b>Glow
      Nails Berlin</b>: <b>Maria Schmidt</b> (<b>+49 151 23456789</b>) at <b>Sep 20, 2026, 3:00 PM</b> was
      cancelled. Ref <b>8f3c1a</b>.&quot;</Text>
    </Paragraph>
    <Paragraph>
      Once Meta approves the template, enter its exact template name here. The template
      must be approved in the same language as this organization&apos;s bot language.
    </Paragraph>
    <Paragraph type="secondary">
      Unlike booking reminders, leaving this blank does not disable technician
      notifications: the technician is still notified with ordinary localized text
      (AI-authored when the bot is enabled, otherwise a fixed message), just without a
      Meta template.
    </Paragraph>
  </>
);
