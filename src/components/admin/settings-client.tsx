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
  greetingEn: string;
  greetingDe: string;
  botLocale: "en" | "de";
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

  return (
    <>
      <PageHeading
        title="Platform settings"
        description="Defaults for new salons, bot greetings, and preview usage. Bot language changes only on redeploy."
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
            <Form.Item label="Active bot locale">
              <Input value={data.botLocale} disabled />
            </Form.Item>
            <Form.Item name="greetingEn" label="English greeting" rules={[{ required: true }]}>
              <Input.TextArea rows={3} />
            </Form.Item>
            <Form.Item name="greetingDe" label="German greeting" rules={[{ required: true }]}>
              <Input.TextArea rows={3} />
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
