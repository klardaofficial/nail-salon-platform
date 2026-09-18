"use client";

import { App, Button, Card, Form, Space, type FormInstance } from "antd";
import { useState, type ReactNode } from "react";

import { apiErrorMessage } from "@/lib/api/client";

export function SettingsSection<T extends Record<string, unknown>>({
  form,
  title,
  extra,
  onSave,
  saveLabel,
  extraActions,
  children,
}: {
  form: FormInstance<T>;
  title: string;
  extra?: ReactNode;
  onSave: (values: T) => Promise<void>;
  saveLabel?: string;
  extraActions?: ReactNode;
  children: ReactNode;
}) {
  const { message } = App.useApp();
  const [saving, setSaving] = useState(false);

  async function handleFinish(values: T) {
    setSaving(true);
    try {
      await onSave(values);
      message.success(`${title} saved`);
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title={title} extra={extra}>
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        {children}
        <Space>
          {saveLabel && (
            <Button type="primary" htmlType="submit" loading={saving}>
              {saveLabel}
            </Button>
          )}
          {extraActions}
        </Space>
      </Form>
    </Card>
  );
}
