"use client";

import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Form,
  Input,
  Popconfirm,
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

import { apiErrorMessage, apiGet, apiMutation } from "@/lib/api/client";
import { apiKey, apiKeys } from "@/lib/api/keys";
import { languageOptions } from "@/lib/bot/language";
import { timeZoneOptions } from "@/lib/timezones";
import {
  pricingToRows,
  rowsToPricing,
  type AIPricing,
  type PricingRow,
} from "@/features/ai-usage/pricing";
import { OpenAIPricingEditor } from "./openai-pricing-editor";
import { PageHeading } from "./page-heading";
import { SettingsSection } from "./settings-section";

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
    openai: {
      overrideConfigured: boolean;
      chatModel: string | null;
      imageModel: string | null;
      pricing: Record<string, AIPricing>;
      effective: {
        source: "root" | "organization" | "none";
        chatModel: string | null;
        imageModel: string | null;
      };
    };
    source: string;
    readiness: string;
    callbackUrl: string;
    displayPhoneNumber: string | null;
    clickToChatUrl: string | null;
    bookingIntentUrl: string;
  };
};

type OrganizationFormValues = {
  organizationName: string;
  ownerWaIds: string;
  platformTimezone: string;
  botLocale: string;
};

type WhatsAppAccountFormValues = {
  wabaId: string | null;
  phoneNumberId: string | null;
};

type WhatsAppCredentialsFormValues = {
  accessToken: string | null;
  appSecret: string | null;
  webhookVerifyToken: string | null;
  confirmedTemplate: string | null;
  cancelledTemplate: string | null;
};

type SimulatorFormValues = {
  simulatorEnabled: boolean;
};

type OpenAIFormValues = {
  apiKey: string | null;
  chatModel: string;
  imageModel: string;
  pricing: PricingRow[];
};

export function OrganizationSettingsClient({ organizationId }: { organizationId: string }) {
  const settingsKey = apiKeys.organizationSettings(organizationId);
  const { data, error, mutate } = useSWR<SettingsResponse>(settingsKey, apiGet);
  const { mutate: mutateCache } = useSWRConfig();
  const { trigger: validate, isMutating: validating } = useSWRMutation(
    apiKey("provider-validation", `/api/admin/organizations/${organizationId}/provider-validation`),
    apiMutation,
  );
  const { message } = App.useApp();

  const [orgForm] = Form.useForm<OrganizationFormValues>();
  const [waAccountForm] = Form.useForm<WhatsAppAccountFormValues>();
  const [waCredentialsForm] = Form.useForm<WhatsAppCredentialsFormValues>();
  const [simulatorForm] = Form.useForm<SimulatorFormValues>();
  const [openaiForm] = Form.useForm<OpenAIFormValues>();

  const [showWhatsAppOverride, setShowWhatsAppOverride] = useState<boolean | null>(null);
  const [showOpenAIOverride, setShowOpenAIOverride] = useState<boolean | null>(null);
  const [clearingMeta, setClearingMeta] = useState(false);
  const [clearingOpenAI, setClearingOpenAI] = useState(false);

  const haveWhatsAppSettings = Boolean(
    data &&
    [
      data.provider.savedMetaOverride.accessToken,
      data.provider.savedMetaOverride.appSecret,
      data.provider.savedMetaOverride.webhookVerifyToken,
    ].some(Boolean),
  );

  const showWhatsAppSettings = showWhatsAppOverride ?? haveWhatsAppSettings;
  const showOpenAISettings =
    showOpenAIOverride ?? Boolean(data?.provider.openai.overrideConfigured);

  useEffect(() => {
    if (!data) return;
    orgForm.setFieldsValue({
      organizationName: data.organization.name,
      ownerWaIds: data.organization.ownerWaIds,
      platformTimezone: data.settings.platform_timezone,
      botLocale: data.settings.bot_locale,
    });
    waAccountForm.setFieldsValue({
      wabaId: data.provider.wabaId,
      phoneNumberId: data.provider.phoneNumberId,
    });
    waCredentialsForm.setFieldsValue({
      accessToken: data.provider.savedMetaOverride.accessToken,
      appSecret: data.provider.savedMetaOverride.appSecret,
      webhookVerifyToken: data.provider.savedMetaOverride.webhookVerifyToken,
      confirmedTemplate: data.provider.confirmedTemplate,
      cancelledTemplate: data.provider.cancelledTemplate,
    });
    simulatorForm.setFieldsValue({ simulatorEnabled: data.settings.simulator_enabled });
    openaiForm.setFieldsValue({
      apiKey: null,
      chatModel: data.provider.openai.chatModel ?? "",
      imageModel: data.provider.openai.imageModel ?? "",
      pricing: pricingToRows(data.provider.openai.pricing),
    });
  }, [data, orgForm, waAccountForm, waCredentialsForm, simulatorForm, openaiForm]);

  async function patch(body: Record<string, unknown>) {
    const updated = await apiMutation<SettingsResponse>(settingsKey, {
      arg: { method: "PATCH", body },
    });
    await mutate(updated, { revalidate: false });
    return updated;
  }

  async function saveOrganization(values: OrganizationFormValues) {
    await patch(values);
    await mutateCache(apiKeys.organizations);
  }

  async function saveWhatsAppAccount(values: WhatsAppAccountFormValues) {
    await patch(values);
  }

  async function saveWhatsAppCredentials(values: WhatsAppCredentialsFormValues) {
    const { confirmedTemplate, cancelledTemplate, ...meta } = values;
    await patch({
      confirmedTemplate,
      cancelledTemplate,
      meta: showWhatsAppSettings
        ? meta
        : { accessToken: null, appSecret: null, webhookVerifyToken: null },
    });
  }

  async function saveSimulator(values: SimulatorFormValues) {
    await patch(values);
    await mutateCache(apiKeys.organizations);
  }

  async function saveOpenAI(values: OpenAIFormValues) {
    await patch({
      openai: showOpenAISettings
        ? {
            enabled: true,
            apiKey: values.apiKey,
            chatModel: values.chatModel,
            imageModel: values.imageModel,
            pricing: rowsToPricing(values.pricing ?? []),
          }
        : { enabled: false },
    });
  }

  async function clearMetaOverride() {
    setClearingMeta(true);
    try {
      await patch({ meta: { accessToken: null, appSecret: null, webhookVerifyToken: null } });
      setShowWhatsAppOverride(false);
      message.success("Cleared organization WhatsApp credentials; root credentials are now used");
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setClearingMeta(false);
    }
  }

  async function clearOpenAIOverride() {
    setClearingOpenAI(true);
    try {
      await patch({ openai: { enabled: false } });
      setShowOpenAIOverride(false);
      message.success("Cleared organization OpenAI override; root configuration is now used");
    } catch (err) {
      message.error(apiErrorMessage(err));
    } finally {
      setClearingOpenAI(false);
    }
  }

  async function validateProvider() {
    try {
      await validate({ method: "POST" });
      await mutate();
      message.success("Provider validation completed");
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  }

  const openAIEffectiveCopy = data
    ? data.provider.openai.effective.source === "none"
      ? "No OpenAI configuration is available yet."
      : `${data.provider.openai.effective.source === "root" ? "Root" : "Organization"} configuration is used (chat: ${data.provider.openai.effective.chatModel}, image: ${data.provider.openai.effective.imageModel}).`
    : "";

  return (
    <>
      <PageHeading
        title="Organization settings"
        description="Manage identity, integrations, and runtime features for this organization."
      />
      {error ? <Alert type="error" showIcon title={error.message} /> : null}
      {data ? (
        <Space orientation="vertical" size="large" className="w-full">
          <SettingsSection
            form={orgForm}
            title="Organization"
            extra={<Typography.Text type="secondary">Identity and bot defaults</Typography.Text>}
            saveLabel="Save organization"
            onSave={saveOrganization}
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
          </SettingsSection>

          <SettingsSection
            form={waAccountForm}
            title="WhatsApp Account"
            extra={
              <Typography.Text type="secondary">Organization routing identifiers</Typography.Text>
            }
            saveLabel="Save WhatsApp account"
            onSave={saveWhatsAppAccount}
            extraActions={
              <Button onClick={validateProvider} loading={validating}>
                Validate Meta mapping
              </Button>
            }
          >
            <Space wrap className="mb-4">
              <Tag>{data.provider.source}</Tag>
              <Tag color={data.provider.readiness === "enabled" ? "green" : "orange"}>
                {data.provider.readiness}
              </Tag>
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
          </SettingsSection>

          <Card
            title="External booking website"
            extra={<Typography.Text type="secondary">How this integration works</Typography.Text>}
          >
            <Typography.Paragraph>
              If this organization has its own booking website, that site can hand a customer
              straight to WhatsApp with their time, and any salon, services, and technician already
              chosen. Have the website redirect the customer&apos;s browser to the URL below (as a
              plain link, not an API call) once they&apos;ve made their selections. The app records
              those choices, opens WhatsApp with a prefilled message in this organization&apos;s
              language, and the bot books the appointment as soon as the customer sends that
              message&mdash;no extra typing required.
            </Typography.Paragraph>
            {data.provider.readiness !== "enabled" ? (
              <Alert
                type="warning"
                showIcon
                className="mb-4"
                title="This link will not work yet"
                description='WhatsApp Account readiness must be "enabled" (validated Meta credentials and an active organization) before this endpoint will redirect customers to WhatsApp.'
              />
            ) : null}
            <Typography.Text type="secondary">Endpoint</Typography.Text>
            <br />
            <Typography.Text
              code
              copyable={{ text: data.provider.bookingIntentUrl }}
              className="[overflow-wrap:anywhere]"
            >
              {data.provider.bookingIntentUrl}
            </Typography.Text>
            <Typography.Paragraph className="mt-4 mb-2">
              <Typography.Text strong>Query parameters</Typography.Text>
            </Typography.Paragraph>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-1 pr-4 font-medium">Parameter</th>
                    <th className="py-1 pr-4 font-medium">Required</th>
                    <th className="py-1 font-medium">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b align-top">
                    <td className="py-1 pr-4">
                      <Typography.Text code>salonId</Typography.Text>
                    </td>
                    <td className="py-1 pr-4">No</td>
                    <td className="py-1">
                      This organization&apos;s salon UUID (must be active). Omit when there is no
                      active salon or only one&mdash;it is selected automatically. Required only to
                      choose among several active salons.
                    </td>
                  </tr>
                  <tr className="border-b align-top">
                    <td className="py-1 pr-4">
                      <Typography.Text code>startsAt</Typography.Text>
                    </td>
                    <td className="py-1 pr-4">Yes</td>
                    <td className="py-1">
                      Requested local date/time as{" "}
                      <Typography.Text code>YYYY-MM-DDTHH:mm</Typography.Text> (no timezone
                      offset&mdash;interpreted in this organization&apos;s platform timezone), at
                      least 15 minutes in the future.
                    </td>
                  </tr>
                  <tr className="border-b align-top">
                    <td className="py-1 pr-4">
                      <Typography.Text code>serviceIds</Typography.Text>
                    </td>
                    <td className="py-1 pr-4">No</td>
                    <td className="py-1">
                      Comma-separated catalog service UUIDs (up to 20). Omit for no service
                      preselected.
                    </td>
                  </tr>
                  <tr className="border-b align-top">
                    <td className="py-1 pr-4">
                      <Typography.Text code>technicianRef</Typography.Text>
                    </td>
                    <td className="py-1 pr-4">No</td>
                    <td className="py-1">A technician UUID to request by name.</td>
                  </tr>
                  <tr className="align-top">
                    <td className="py-1 pr-4">
                      <Typography.Text code>additionalRequest</Typography.Text>
                    </td>
                    <td className="py-1 pr-4">No</td>
                    <td className="py-1">
                      Free-text note from the customer (up to 1000 characters).
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <Typography.Paragraph className="mt-4 mb-1">
              <Typography.Text type="secondary">Example</Typography.Text>
            </Typography.Paragraph>
            <Typography.Text code className="[overflow-wrap:anywhere]">
              {`${data.provider.bookingIntentUrl}?startsAt=2026-09-20T15:00&serviceIds=<service-uuid-1>,<service-uuid-2>&technicianRef=<technician-uuid>`}
            </Typography.Text>
            <Typography.Paragraph className="mt-2 mb-0" type="secondary">
              Add <Typography.Text code>&salonId=&lt;salon-uuid&gt;</Typography.Text> only when this
              organization has more than one active salon.
            </Typography.Paragraph>
            <Typography.Paragraph className="mt-4 mb-0" type="secondary">
              All catalog IDs (salons, services, technicians) come from this organization&apos;s own
              admin data&mdash;see the Salons, Services, and Technicians pages for the exact UUIDs
              to use. If anything about the booking intent fails (an invalid ID, a time in the past,
              and so on), the customer is still redirected to WhatsApp with a plain greeting instead
              of seeing an error page.
            </Typography.Paragraph>
          </Card>

          <SettingsSection
            form={waCredentialsForm}
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
                  disabled={haveWhatsAppSettings}
                />
              </Space>
            }
            saveLabel={showWhatsAppSettings ? "Save WhatsApp credentials" : undefined}
            onSave={saveWhatsAppCredentials}
            extraActions={
              data.provider.savedMetaOverride.accessToken || haveWhatsAppSettings ? (
                <Popconfirm
                  title="Clear organization WhatsApp credentials?"
                  description="This organization will use the root credentials instead."
                  onConfirm={clearMetaOverride}
                >
                  <Button loading={clearingMeta}>Clear override &amp; use root</Button>
                </Popconfirm>
              ) : null
            }
          >
            {showWhatsAppSettings ? (
              <Space orientation="vertical" size="middle" className="w-full">
                <Row gutter={[24, 0]}>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="accessToken"
                      label="Meta access token"
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <Input.Password />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="appSecret"
                      label="Meta app secret"
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <Input.Password />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="webhookVerifyToken"
                      label="Webhook verify token"
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <Input.Password />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={[24, 0]}>
                  <Col xs={24} lg={12}>
                    <Form.Item name="confirmedTemplate" label="Technician confirmation template">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item name="cancelledTemplate" label="Technician cancellation template">
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
                    className="[overflow-wrap:anywhere]"
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
          </SettingsSection>

          <SettingsSection
            form={simulatorForm}
            title="Simulator"
            extra={
              <Typography.Text type="secondary">Browser-based test conversations</Typography.Text>
            }
            saveLabel="Save simulator setting"
            onSave={saveSimulator}
          >
            <Form.Item
              name="simulatorEnabled"
              label="Enable simulator"
              valuePropName="checked"
              extra="Allows authenticated admins to test conversations without sending messages through Meta."
              className="mb-0"
            >
              <Switch />
            </Form.Item>
          </SettingsSection>

          <SettingsSection
            form={openaiForm}
            title="OpenAI"
            extra={
              <Space size="small">
                <Typography.Text type="secondary">Configure organization settings</Typography.Text>
                <Switch
                  checked={showOpenAISettings}
                  onChange={setShowOpenAIOverride}
                  aria-label="Configure organization OpenAI settings"
                  disabled={data.provider.openai.overrideConfigured}
                />
              </Space>
            }
            saveLabel={showOpenAISettings ? "Save OpenAI settings" : undefined}
            onSave={saveOpenAI}
            extraActions={
              data.provider.openai.overrideConfigured ? (
                <Popconfirm
                  title="Clear organization OpenAI override?"
                  description="This organization will use the root OpenAI configuration instead."
                  onConfirm={clearOpenAIOverride}
                >
                  <Button loading={clearingOpenAI}>Clear override &amp; use root</Button>
                </Popconfirm>
              ) : null
            }
          >
            {showOpenAISettings ? (
              <>
                <Row gutter={[24, 0]}>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="apiKey"
                      label={`OpenAI API key${data.provider.openai.overrideConfigured ? " (configured)" : ""}`}
                      rules={[
                        {
                          required: !data.provider.openai.overrideConfigured,
                          message: "Required",
                        },
                      ]}
                    >
                      <Input.Password placeholder="Leave blank to preserve the saved key" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="chatModel"
                      label="OpenAI chat model"
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col xs={24} lg={12}>
                    <Form.Item
                      name="imageModel"
                      label="OpenAI image model"
                      rules={[{ required: true, message: "Required" }]}
                    >
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Form.Item label="Per-model pricing">
                  <OpenAIPricingEditor name="pricing" />
                </Form.Item>
              </>
            ) : (
              <Typography.Text type="secondary">{openAIEffectiveCopy}</Typography.Text>
            )}
          </SettingsSection>
        </Space>
      ) : (
        <Skeleton active paragraph={{ rows: 10 }} />
      )}
    </>
  );
}
