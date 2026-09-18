"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Row,
  Select,
  Skeleton,
  Space,
  Switch,
  Tag,
  Typography,
} from "antd";
import Image from "next/image";
import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import { apiGet, apiMutation } from "@/lib/api/client";
import { apiKey, apiKeys } from "@/lib/api/keys";
import { languageOptions } from "@/lib/bot/language";
import { timeZoneOptions } from "@/lib/timezones";
import { PageHeading } from "./page-heading";

type SettingsResponse = {
  organization: { name: string; status: string; ownerWaIds: string };
  settings: { platform_timezone: string; bot_locale: string; simulator_enabled: boolean };
  provider: {
    wabaId: string | null;
    phoneNumberId: string | null;
    savedMetaOverride: {
      accessToken: string | null;
      appSecret: string | null;
      webhookVerifyToken: string | null;
    };
    confirmedTemplate: string | null;
    cancelledTemplate: string | null;
    openaiConfigured: boolean;
    openaiChatModel: string;
    openaiImageModel: string;
    source: string;
    readiness: string;
    callbackUrl: string;
    displayPhoneNumber: string | null;
    clickToChatUrl: string | null;
  };
};

export function OrganizationSettingsClient({ organizationId }: { organizationId: string }) {
  const settingsKey = apiKeys.organizationSettings(organizationId);
  const { data, error, mutate } = useSWR<SettingsResponse>(settingsKey, apiGet);
  const { mutate: mutateCache } = useSWRConfig();
  const { trigger, isMutating } = useSWRMutation(settingsKey, apiMutation);
  const { trigger: validate, isMutating: validating } = useSWRMutation(
    apiKey("provider-validation", `/api/admin/organizations/${organizationId}/provider-validation`),
    apiMutation,
  );
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [showWhatsAppOverride, setShowWhatsAppOverride] = useState<boolean | null>(null);
  const [showOpenAIOverride, setShowOpenAIOverride] = useState<boolean | null>(null);
  const showWhatsAppSettings =
    showWhatsAppOverride ??
    Boolean(
      data &&
      [
        data.provider.savedMetaOverride.accessToken,
        data.provider.savedMetaOverride.appSecret,
        data.provider.savedMetaOverride.webhookVerifyToken,
      ].some(Boolean),
    );
  const showOpenAISettings = showOpenAIOverride ?? Boolean(data?.provider.openaiConfigured);
  useEffect(() => {
    if (!data) return;
    form.setFieldsValue({
      organizationName: data.organization.name,
      ownerWaIds: data.organization.ownerWaIds,
      platformTimezone: data.settings.platform_timezone,
      botLocale: data.settings.bot_locale,
      simulatorEnabled: data.settings.simulator_enabled,
      wabaId: data.provider.wabaId,
      phoneNumberId: data.provider.phoneNumberId,
      accessToken: data.provider.savedMetaOverride.accessToken,
      appSecret: data.provider.savedMetaOverride.appSecret,
      webhookVerifyToken: data.provider.savedMetaOverride.webhookVerifyToken,
      confirmedTemplate: data.provider.confirmedTemplate,
      cancelledTemplate: data.provider.cancelledTemplate,
      openaiChatModel: data.provider.openaiChatModel,
      openaiImageModel: data.provider.openaiImageModel,
    });
  }, [data, form]);

  async function save(values: Record<string, unknown>) {
    const { accessToken, appSecret, webhookVerifyToken, ...rest } = values;
    await trigger({
      method: "PATCH",
      body: {
        ...rest,
        meta: {
          accessToken: showWhatsAppSettings && typeof accessToken === "string" ? accessToken : null,
          appSecret: showWhatsAppSettings && typeof appSecret === "string" ? appSecret : null,
          webhookVerifyToken:
            showWhatsAppSettings && typeof webhookVerifyToken === "string"
              ? webhookVerifyToken
              : null,
        },
      },
    });
    await mutateCache(apiKeys.organizations);
    message.success("Organization settings saved");
  }

  async function validateProvider() {
    await validate({ method: "POST" });
    await mutate();
    message.success("Provider validation completed");
  }

  return (
    <>
      <PageHeading
        title="Organization settings"
        description="Manage identity, integrations, and runtime features for this organization."
      />
      {error ? <Alert type="error" showIcon title={error.message} /> : null}
      {data ? (
        <Form form={form} layout="vertical" onFinish={save}>
          <Space orientation="vertical" size="large" style={{ width: "100%" }}>
            <Card
              title="Organization"
              extra={<Typography.Text type="secondary">Identity and bot defaults</Typography.Text>}
            >
              <Row gutter={[24, 0]}>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="organizationName"
                    label="Organization name"
                    rules={[{ required: true }]}
                  >
                    <Input maxLength={120} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item name="platformTimezone" label="Platform timezone">
                    <Select
                      showSearch={{ optionFilterProp: "label" }}
                      options={timeZoneOptions}
                      placeholder="Select a timezone"
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="ownerWaIds"
                    label="Owner WhatsApp IDs"
                    extra="Enter one WhatsApp ID or international number per line."
                  >
                    <Input.TextArea rows={3} />
                  </Form.Item>
                </Col>
                <Col xs={24} lg={12}>
                  <Form.Item
                    name="botLocale"
                    label="Default bot locale"
                    extra="Used when a conversation does not have a detected language yet."
                  >
                    <Select
                      showSearch={{ optionFilterProp: "label" }}
                      options={[...languageOptions]}
                      placeholder="Select a language"
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card
              title="WhatsApp Account"
              extra={
                <Typography.Text type="secondary">Organization routing identifiers</Typography.Text>
              }
            >
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                <Space wrap>
                  <Tag>{data.provider.source}</Tag>
                  <Tag color={data.provider.readiness === "enabled" ? "green" : "orange"}>
                    {data.provider.readiness}
                  </Tag>
                  <Button onClick={validateProvider} loading={validating}>
                    Validate Meta mapping
                  </Button>
                </Space>

                <Row gutter={[24, 0]}>
                  <Col xs={24} lg={12}>
                    <Form.Item name="wabaId" label="WhatsApp Business Account ID">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="phoneNumberId" label="Receiving phone-number ID">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
              </Space>
            </Card>

            <Card
              title="WhatsApp Credentials"
              extra={
                <Space size="small">
                  <Typography.Text type="secondary">
                    Use organization-specific Meta credentials
                  </Typography.Text>
                  <Switch
                    checked={showWhatsAppSettings}
                    onChange={setShowWhatsAppOverride}
                    aria-label="Configure organization WhatsApp settings"
                  />
                </Space>
              }
            >
              <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                {showWhatsAppSettings ? (
                  <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
                    <Row gutter={[24, 0]}>
                      <Col xs={24} lg={12}>
                        <Form.Item name="accessToken" label="Meta access token">
                          <Input.Password />
                        </Form.Item>
                      </Col>
                      <Col xs={24} lg={12}>
                        <Form.Item name="appSecret" label="Meta app secret">
                          <Input.Password />
                        </Form.Item>
                      </Col>
                      <Col xs={24} lg={12}>
                        <Form.Item name="webhookVerifyToken" label="Webhook verify token">
                          <Input.Password />
                        </Form.Item>
                      </Col>
                    </Row>

                    <Row gutter={[24, 0]}>
                      <Col xs={24} lg={12}>
                        <Form.Item
                          name="confirmedTemplate"
                          label="Technician confirmation template"
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                      <Col xs={24} lg={12}>
                        <Form.Item
                          name="cancelledTemplate"
                          label="Technician cancellation template"
                        >
                          <Input />
                        </Form.Item>
                      </Col>
                    </Row>

                    <div>
                      <Typography.Text type="secondary">Webhook URL</Typography.Text>
                      <br />
                      <Typography.Text
                        code
                        copyable={{ text: data.provider.callbackUrl }}
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {data.provider.callbackUrl}
                      </Typography.Text>
                      <br />
                      <Typography.Text type="secondary">
                        {data.provider.source === "organization"
                          ? "This organization webhook URL uses organization-specific Meta credentials."
                          : data.provider.source === "root"
                            ? "This organization webhook URL uses the shared root Meta credentials."
                            : "This organization webhook URL is ready, but Meta credentials are not configured yet."}
                      </Typography.Text>
                    </div>
                  </Space>
                ) : (
                  <Typography.Text type="secondary">
                    Shared root Meta credentials are used for this organization.
                  </Typography.Text>
                )}

                {data.provider.clickToChatUrl ? (
                  <Space align="start" wrap size="large">
                    <Image
                      unoptimized
                      src={`/api/admin/organizations/${organizationId}/qr`}
                      width={180}
                      height={180}
                      alt="WhatsApp click-to-chat QR code"
                    />
                    <Space orientation="vertical">
                      <Typography.Text strong>Customer click-to-chat</Typography.Text>
                      <Typography.Text>{data.provider.displayPhoneNumber}</Typography.Text>
                      <Typography.Link
                        href={data.provider.clickToChatUrl}
                        target="_blank"
                        copyable={{ text: data.provider.clickToChatUrl }}
                      >
                        {data.provider.clickToChatUrl}
                      </Typography.Link>
                      <Space wrap>
                        <Button
                          href={`/api/admin/organizations/${organizationId}/qr`}
                          download="whatsapp-qr.svg"
                        >
                          Download QR
                        </Button>
                        <Button onClick={() => window.print()}>Print</Button>
                      </Space>
                    </Space>
                  </Space>
                ) : null}
              </Space>
            </Card>

            <Card
              title="Simulator"
              extra={
                <Typography.Text type="secondary">Browser-based test conversations</Typography.Text>
              }
            >
              <Form.Item
                name="simulatorEnabled"
                label="Enable simulator"
                valuePropName="checked"
                extra="Allows authenticated admins to test conversations without sending messages through Meta."
                style={{ marginBottom: 0 }}
              >
                <Switch />
              </Form.Item>
            </Card>

            <Card
              title="OpenAI"
              extra={
                <Space size="small">
                  <Typography.Text type="secondary">
                    Configure organization settings
                  </Typography.Text>
                  <Switch
                    checked={showOpenAISettings}
                    onChange={setShowOpenAIOverride}
                    aria-label="Configure organization OpenAI settings"
                  />
                </Space>
              }
            >
              {showOpenAISettings ? (
                <Row gutter={[24, 0]}>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="openaiApiKey"
                      label={`OpenAI API key${data.provider.openaiConfigured ? " (configured)" : ""}`}
                    >
                      <Input.Password placeholder="Leave blank to preserve the saved key" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="openaiChatModel" label="OpenAI chat model">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="openaiImageModel" label="OpenAI image model">
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
              ) : (
                <Typography.Text type="secondary">
                  Root config is used. Turn on to overwrite if need for organization-specific.
                </Typography.Text>
              )}
            </Card>

            <Button type="primary" htmlType="submit" loading={isMutating}>
              Save settings
            </Button>
          </Space>
        </Form>
      ) : (
        <Skeleton active paragraph={{ rows: 10 }} />
      )}
    </>
  );
}
