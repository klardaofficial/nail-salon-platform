"use client";

import { Alert, App, Button, Card, Form, Input, InputNumber, Skeleton } from "antd";
import useSWR, { mutate } from "swr";
import useSWRMutation from "swr/mutation";

import { apiMutation } from "@/lib/api/client";
import { apiKeys } from "@/lib/api/keys";
import { PageHeading } from "./page-heading";

type PlatformSettings = {
  platformTimezone: string;
  defaultOpenTime: string;
  defaultCloseTime: string;
  defaultBookingIntervalMinutes: number;
  previewRequestsPerDay: number;
  previewsPerRequest: number;
  technicianBookingConfirmedTemplate: string | null;
  technicianBookingCancelledTemplate: string | null;
  botLocale: string;
};

export function SettingsClient() {
  const { message } = App.useApp();
  const { data, error, isLoading } = useSWR<PlatformSettings>(apiKeys.settings);
  const {
    trigger,
    isMutating,
    error: mutationError,
  } = useSWRMutation(apiKeys.settings, apiMutation);

  async function save(values: PlatformSettings) {
    await trigger({ method: "PATCH", body: values });
    await mutate(apiKeys.settings);
    message.success("Platform settings updated");
  }

  const confirmedTemplateExample =
    "New booking at {{1}}. Customer: {{2}} ({{3}}). Appointment: {{4}}. Booking reference: {{5}}.";
  const cancelledTemplateExample =
    "Booking cancelled at {{1}}. Customer: {{2}} ({{3}}). Appointment: {{4}}. Booking reference: {{5}}.";

  return (
    <>
      <PageHeading
        title="Platform settings"
        description="Booking defaults, technician notifications, and preview usage. The bot creates contextual greetings and follows the customer's language."
      />
      {(error || mutationError) && (
        <Alert type="error" showIcon title={(error || mutationError)?.message} />
      )}
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : data ? (
        <Form<PlatformSettings>
          key={JSON.stringify(data)}
          layout="vertical"
          initialValues={data}
          onFinish={save}
          requiredMark="optional"
        >
          <Card title="Booking defaults" style={{ marginBottom: 16 }}>
            <Form.Item
              name="platformTimezone"
              label="Platform timezone"
              rules={[{ required: true }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="defaultOpenTime"
              label="Default opening time"
              rules={[{ required: true }]}
            >
              <Input placeholder="09:00" />
            </Form.Item>
            <Form.Item
              name="defaultCloseTime"
              label="Default closing time"
              rules={[{ required: true }]}
            >
              <Input placeholder="18:00" />
            </Form.Item>
            <Form.Item
              name="defaultBookingIntervalMinutes"
              label="Suggested interval in minutes"
              rules={[{ required: true }]}
            >
              <InputNumber min={5} max={240} />
            </Form.Item>
          </Card>
          <Card title="WhatsApp and previews" style={{ marginBottom: 16 }}>
            <Form.Item
              label="Default bot language"
              extra="Used when the customer's language is unclear. The AI follows the customer in any language and writes all selection labels."
            >
              <Input value={data.botLocale} disabled />
            </Form.Item>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              title="Technician notifications outside their 24-hour WhatsApp window"
              description={
                <div>
                  Create and approve these templates once in Meta WhatsApp Manager, in the default
                  bot language. Enter each approved Meta template name below. The app fills the
                  placeholders in this order: {"{{1}}"} salon name, {"{{2}}"} customer name,
                  {"{{3}}"} customer WhatsApp number, {"{{4}}"} local appointment time,
                  {"{{5}}"} booking reference. Missing details use [N/A]. Approved templates keep
                  their configured language; ordinary notifications use the technician&apos;s
                  conversation language.
                  <br />
                  <br />
                  Confirmed template: {confirmedTemplateExample}
                  <br />
                  Cancelled template: {cancelledTemplateExample}
                  <br />
                  <br />
                  Leave either name empty to use a normal message. Meta only delivers normal
                  messages while that technician&apos;s 24-hour WhatsApp window is open.
                </div>
              }
            />
            <Form.Item
              name="technicianBookingConfirmedTemplate"
              label="Approved booking-confirmed template name"
            >
              <Input placeholder="e.g. technician_booking_confirmed" />
            </Form.Item>
            <Form.Item
              name="technicianBookingCancelledTemplate"
              label="Approved booking-cancelled template name"
            >
              <Input placeholder="e.g. technician_booking_cancelled" />
            </Form.Item>
            <Form.Item
              name="previewRequestsPerDay"
              label="Preview requests per customer per day"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={100} />
            </Form.Item>
            <Form.Item
              name="previewsPerRequest"
              label="Maximum previews per request"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={3} />
            </Form.Item>
          </Card>
          <Button type="primary" htmlType="submit" loading={isMutating}>
            Save settings
          </Button>
        </Form>
      ) : null}
    </>
  );
}
