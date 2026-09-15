"use client";

import { PlusIcon } from "@phosphor-icons/react";
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Steps,
  Switch,
  Table,
  Tag,
  TimePicker,
  Typography,
} from "antd";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useState } from "react";
import useSWR, { mutate } from "swr";
import useSWRMutation from "swr/mutation";

import {
  resourceDefinitions,
  type AdminResourceItem,
  type ResourceName,
  type ResourceResponse,
} from "@/features/admin/resources";
import { apiMutation } from "@/lib/api/client";
import { apiKeys } from "@/lib/api/keys";
import { PageHeading } from "./page-heading";

dayjs.extend(customParseFormat);

function endpoint(resource: ResourceName) {
  return apiKeys[resource];
}

function formValues(item: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(item).map(([key, value]) => [
      key,
      key.endsWith("_time") && typeof value === "string"
        ? dayjs(value, ["HH:mm", "HH:mm:ss"], true)
        : value,
    ]),
  );
}

function requestValues(values: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      key.endsWith("_time") && dayjs.isDayjs(value) ? value.format("HH:mm") : value,
    ]),
  );
}

function WhatsAppSetupGuide({ webhookUrl }: { webhookUrl: string }) {
  return (
    <Card className="admin-business-card" title="WhatsApp Business setup">
      <Alert
        type="info"
        showIcon
        title="Configure Meta secrets in your deployment environment, never in this dashboard."
        description="This page only explains the required Meta Developer steps. Keep access tokens, app secrets, and verify tokens server-only."
        style={{ marginBottom: 24 }}
      />
      <Steps
        orientation="vertical"
        items={[
          {
            title: "Create or select your Meta app",
            description:
              "In Meta for Developers, add the WhatsApp product and select the one WhatsApp Business Account and phone number for this business.",
          },
          {
            title: "Add server environment values",
            description:
              "Set WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_APP_SECRET, and WHATSAPP_WEBHOOK_VERIFY_TOKEN in Vercel or your hosting provider, then redeploy.",
          },
          {
            title: "Configure the Meta webhook",
            description: (
              <Space orientation="vertical" size={4}>
                <Typography.Text>Callback URL</Typography.Text>
                <Typography.Text code copyable={{ text: webhookUrl }}>
                  {webhookUrl}
                </Typography.Text>
                <Typography.Text type="secondary">
                  Verify token: use the exact value of WHATSAPP_WEBHOOK_VERIFY_TOKEN. Meta sends a
                  GET challenge; this app returns it only when the token matches.
                </Typography.Text>
              </Space>
            ),
          },
          {
            title: "Subscribe to messages",
            description:
              "In the app's Webhooks settings, subscribe the WhatsApp Business Account to the messages field. Delivery status callbacks are handled by the same endpoint.",
          },
          {
            title: "Test before going live",
            description:
              "Use a test customer number to confirm Meta accepts the webhook, the first greeting arrives once, and a reply appears in the dashboard or provider logs.",
          },
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ margin: "20px 0 0" }}>
        Follow the full deployment guide for token permissions, approved technician templates, and
        production verification.
      </Typography.Paragraph>
    </Card>
  );
}

export function ResourceManager({
  resource,
  webhookUrl = "https://YOUR_DOMAIN/api/whatsapp/webhook",
}: {
  resource: ResourceName;
  webhookUrl?: string;
}) {
  const definition = resourceDefinitions[resource];
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<AdminResourceItem | null>(null);
  const [open, setOpen] = useState(false);
  const { data, error, isLoading } = useSWR<ResourceResponse>(endpoint(resource));
  const { data: salons } = useSWR<ResourceResponse>(apiKeys.salons);
  const {
    trigger,
    isMutating,
    error: mutationError,
  } = useSWRMutation(endpoint(resource), apiMutation);

  function showCreate() {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue(formValues(definition.defaults ?? {}));
    setOpen(true);
  }

  function showEdit(item: AdminResourceItem) {
    setEditing(item);
    form.setFieldsValue(formValues(item));
    setOpen(true);
  }

  async function save(values: Record<string, unknown>) {
    await trigger({
      method: editing ? "PATCH" : "POST",
      body: { ...requestValues(values), ...(editing ? { id: editing.id } : {}) },
    });
    await mutate(endpoint(resource));
    setOpen(false);
    message.success(`${definition.singular} ${editing ? "updated" : "created"}`);
  }

  async function deactivate(item: AdminResourceItem) {
    await trigger({ method: "DELETE", body: { id: item.id } });
    await mutate(endpoint(resource));
    message.success(`${definition.singular} deactivated`);
  }

  function options() {
    const items = salons?.items;
    return items?.map((item) => ({ value: item.id, label: String(item.name) })) ?? [];
  }

  return (
    <>
      <PageHeading title={definition.title} description={definition.description} />
      {(error || mutationError) && (
        <Alert
          type="error"
          showIcon
          title={(error || mutationError)?.message}
          style={{ marginBottom: 16 }}
        />
      )}
      {resource !== "businesses" ? (
        <div className="admin-table-toolbar">
          <span />
          <Button type="primary" icon={<PlusIcon size={17} />} onClick={showCreate}>
            Add {definition.singular}
          </Button>
        </div>
      ) : null}
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : resource === "businesses" ? (
        data?.items[0] ? (
          <Space orientation="vertical" size={16} style={{ width: "100%" }}>
            <Card
              className="admin-business-card"
              title="Business profile"
              extra={<Button onClick={() => showEdit(data.items[0])}>Edit business</Button>}
            >
              <Descriptions column={{ xs: 1, sm: 2 }} layout="vertical">
                <Descriptions.Item label="Business name">{data.items[0].name}</Descriptions.Item>
                <Descriptions.Item label="Reporting timezone">
                  {data.items[0].reporting_timezone}
                </Descriptions.Item>
                <Descriptions.Item label="Owner WhatsApp IDs" span={2}>
                  <span className="admin-business-owners">
                    {data.items[0].owner_wa_ids || "No owners configured"}
                  </span>
                </Descriptions.Item>
              </Descriptions>
            </Card>
            <WhatsAppSetupGuide webhookUrl={webhookUrl} />
          </Space>
        ) : (
          <Empty description="The business profile is unavailable. Apply the latest database migration." />
        )
      ) : (
        <Table
          rowKey="id"
          scroll={{ x: 760 }}
          dataSource={data?.items ?? []}
          locale={{ emptyText: `No ${resource} yet` }}
          columns={[
            ...definition.columns.map((column) => ({
              title: column.label,
              dataIndex: column.key,
              key: column.key,
              render: (value: unknown) =>
                column.kind === "boolean" ? (
                  <Tag color={value ? "success" : "default"}>{value ? "Yes" : "No"}</Tag>
                ) : column.kind === "date" && value ? (
                  new Date(String(value)).toLocaleString("en-GB")
                ) : (
                  ((value ?? "-") as React.ReactNode)
                ),
            })),
            {
              title: "Actions",
              key: "actions",
              fixed: "right" as const,
              width: 150,
              render: (_: unknown, item: AdminResourceItem) => (
                <Space>
                  <Button size="small" onClick={() => showEdit(item)}>
                    Edit
                  </Button>
                  <Popconfirm
                    title={`Deactivate this ${definition.singular}?`}
                    description="Historical bookings will remain available."
                    onConfirm={() => deactivate(item)}
                  >
                    <Button size="small" danger disabled={item.active === false}>
                      Deactivate
                    </Button>
                  </Popconfirm>
                </Space>
              ),
            },
          ]}
        />
      )}

      <Modal
        title={`${editing ? "Edit" : "Add"} ${definition.singular}`}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={isMutating}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" requiredMark="optional" onFinish={save}>
          {definition.fields.map((field) => (
            <Form.Item
              key={field.name}
              name={field.name}
              label={field.label}
              valuePropName={field.kind === "switch" ? "checked" : "value"}
              help={field.help}
              rules={field.required ? [{ required: true }] : undefined}
            >
              {field.kind === "textarea" ? (
                <Input.TextArea rows={4} />
              ) : field.kind === "select" ? (
                <Select showSearch={{ optionFilterProp: "label" }} options={options()} />
              ) : field.kind === "switch" ? (
                <Switch />
              ) : field.kind === "time" ? (
                <TimePicker format="HH:mm" minuteStep={5} style={{ width: "100%" }} />
              ) : (
                <Input />
              )}
            </Form.Item>
          ))}
        </Form>
      </Modal>
    </>
  );
}
