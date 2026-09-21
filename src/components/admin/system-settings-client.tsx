"use client";

import { Alert, Form, Input, Skeleton, Space, Typography } from "antd";
import { useEffect } from "react";
import useSWR from "swr";

import { apiGet, apiMutation } from "@/lib/api/client";
import { apiKeys } from "@/lib/api/keys";
import {
  pricingToRows,
  rowsToPricing,
  type AIPricing,
  type PricingRow,
} from "@/features/ai-usage/pricing";
import { OpenAIPricingEditor } from "./openai-pricing-editor";
import { PageHeading } from "./page-heading";
import { SettingsSection } from "./settings-section";
import { TemplateHelpLabel, reminderTemplateHelp, technicianTemplateHelp } from "./template-help";

type RootSettings = {
  meta: {
    accessToken: string | null;
    appSecret: string | null;
    webhookVerifyToken: string | null;
    confirmedTemplate: string | null;
    cancelledTemplate: string | null;
    reminderTemplate: string | null;
    callbackUrl: string;
  };
  openai: {
    apiKey: string | null;
    chatModel: string;
    imageModel: string;
    pricing: Record<string, AIPricing>;
  };
};

type MetaFormValues = {
  accessToken: string | null;
  appSecret: string | null;
  webhookVerifyToken: string | null;
  confirmedTemplate: string | null;
  cancelledTemplate: string | null;
  reminderTemplate: string | null;
};

type OpenAIFormValues = {
  apiKey: string | null;
  chatModel: string;
  imageModel: string;
  pricing: PricingRow[];
};

export function SystemSettingsClient() {
  const settingsKey = apiKeys.systemSettings;
  const { data, error, mutate } = useSWR<RootSettings>(settingsKey, apiGet);
  const [metaForm] = Form.useForm<MetaFormValues>();
  const [openaiForm] = Form.useForm<OpenAIFormValues>();

  useEffect(() => {
    if (!data) return;
    metaForm.setFieldsValue(data.meta);
    openaiForm.setFieldsValue({
      apiKey: data.openai.apiKey,
      chatModel: data.openai.chatModel,
      imageModel: data.openai.imageModel,
      pricing: pricingToRows(data.openai.pricing),
    });
  }, [data, metaForm, openaiForm]);

  async function saveMeta(values: MetaFormValues) {
    const updated = await apiMutation<RootSettings>(settingsKey, {
      arg: { method: "PATCH", body: { meta: values } },
    });
    await mutate(updated, { revalidate: false });
  }

  async function saveOpenAI(values: OpenAIFormValues) {
    const updated = await apiMutation<RootSettings>(settingsKey, {
      arg: {
        method: "PATCH",
        body: {
          openai: {
            apiKey: values.apiKey,
            chatModel: values.chatModel,
            imageModel: values.imageModel,
            pricing: rowsToPricing(values.pricing ?? []),
          },
        },
      },
    });
    await mutate(updated, { revalidate: false });
  }

  return (
    <>
      <PageHeading
        title="System settings"
        description="Root-level defaults every organization inherits unless it configures its own."
      />
      {error ? <Alert type="error" showIcon title={error.message} /> : null}
      {data ? (
        <Space orientation="vertical" size="large" className="w-full">
          <SettingsSection
            form={metaForm}
            title="WhatsApp (Meta)"
            saveLabel="Save WhatsApp settings"
            onSave={saveMeta}
          >
            <Form.Item name="accessToken" label="Access token">
              <Input.Password />
            </Form.Item>
            <Form.Item name="appSecret" label="App secret">
              <Input.Password />
            </Form.Item>
            <Form.Item name="webhookVerifyToken" label="Webhook verify token">
              <Input.Password />
            </Form.Item>
            <Form.Item
              name="confirmedTemplate"
              label={
                <TemplateHelpLabel
                  label="Default technician confirmation template"
                  title="Default technician confirmation template"
                >
                  {technicianTemplateHelp}
                </TemplateHelpLabel>
              }
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="cancelledTemplate"
              label={
                <TemplateHelpLabel
                  label="Default technician cancellation template"
                  title="Default technician cancellation template"
                >
                  {technicianTemplateHelp}
                </TemplateHelpLabel>
              }
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="reminderTemplate"
              label={
                <TemplateHelpLabel
                  label="Default booking reminder template"
                  title="Default booking reminder template"
                >
                  {reminderTemplateHelp}
                </TemplateHelpLabel>
              }
              extra="Used by organizations that do not configure their own booking reminder template."
            >
              <Input />
            </Form.Item>
            <Form.Item label="Root callback">
              <Typography.Text code copyable={{ text: data.meta.callbackUrl }}>
                {data.meta.callbackUrl}
              </Typography.Text>
            </Form.Item>
          </SettingsSection>

          <SettingsSection
            form={openaiForm}
            title="OpenAI"
            saveLabel="Save OpenAI settings"
            onSave={saveOpenAI}
          >
            <Form.Item name="apiKey" label="OpenAI API key">
              <Input.Password placeholder="Leave blank to remove the root key" />
            </Form.Item>
            <Form.Item name="chatModel" label="Chat model" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="imageModel" label="Image model" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Per-model pricing">
              <OpenAIPricingEditor name="pricing" />
            </Form.Item>
          </SettingsSection>
        </Space>
      ) : (
        <Skeleton active paragraph={{ rows: 10 }} />
      )}
    </>
  );
}
