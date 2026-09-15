"use client";

import { PlusIcon } from "@phosphor-icons/react";
import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Skeleton,
  Space,
  Switch,
  Table,
  Tag,
  TimePicker,
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

export function ResourceManager({ resource }: { resource: ResourceName }) {
  const definition = resourceDefinitions[resource];
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [editing, setEditing] = useState<AdminResourceItem | null>(null);
  const [open, setOpen] = useState(false);
  const { data, error, isLoading } = useSWR<ResourceResponse>(endpoint(resource));
  const { data: businesses } = useSWR<ResourceResponse>(apiKeys.businesses);
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

  function options(source: "businesses" | "salons" | undefined) {
    const items = source === "businesses" ? businesses?.items : salons?.items;
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
      <div className="admin-table-toolbar">
        <span />
        <Button type="primary" icon={<PlusIcon size={17} />} onClick={showCreate}>
          Add {definition.singular}
        </Button>
      </div>
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
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
                <Select
                  showSearch={{ optionFilterProp: "label" }}
                  options={options(field.optionSource)}
                />
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
