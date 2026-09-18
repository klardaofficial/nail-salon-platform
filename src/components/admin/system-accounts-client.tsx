"use client";

import {
  Alert,
  App,
  Button,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from "antd";
import { useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { apiErrorMessage, apiGet, apiMutation } from "@/lib/api/client";
import { apiKey, apiKeys } from "@/lib/api/keys";
import { PageHeading } from "./page-heading";

type Account = {
  user_id: string;
  email: string;
  display_name: string | null;
  active: boolean;
  must_change_password: boolean;
  is_system_admin: boolean;
  organizationIds: string[];
};
type Organization = { id: string; name: string; status: string };

export function SystemAccountsClient() {
  const endpoint = "/api/admin/system/accounts";
  const accountsKey = apiKey("system-accounts", endpoint);
  const { data, error, isLoading } = useSWR<{ accounts: Account[] }>(accountsKey, apiGet);
  const { data: organizations } = useSWR<{ organizations: Organization[] }>(
    apiKeys.organizations,
    apiGet,
  );
  const { trigger, isMutating } = useSWRMutation(accountsKey, apiMutation);
  const [createForm] = Form.useForm();
  const [resetForm] = Form.useForm();
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Account | null>(null);
  const { message } = App.useApp();
  async function action(body: Record<string, unknown>) {
    try {
      await trigger({ method: "PATCH", body });
      return true;
    } catch (err) {
      message.error(apiErrorMessage(err));
      return false;
    }
  }
  return (
    <>
      <PageHeading
        title="Dashboard accounts"
        description="System-only account, role, membership, password, and removal management."
      />
      {error ? <Alert type="error" showIcon title={error.message} /> : null}
      <Space className="mb-4 flex justify-end">
        <Button type="primary" onClick={() => setCreateOpen(true)}>
          Create account
        </Button>
      </Space>
      <Table
        rowKey="user_id"
        loading={isLoading}
        dataSource={data?.accounts ?? []}
        scroll={{ x: 1100 }}
        columns={[
          {
            title: "Account",
            render: (_, row) => (
              <Space orientation="vertical" size={0}>
                <span>{row.display_name || "—"}</span>
                <span>{row.email}</span>
              </Space>
            ),
          },
          {
            title: "Status",
            render: (_, row) => (
              <Space>
                <Tag color={row.active ? "green" : "default"}>
                  {row.active ? "Active" : "Removed"}
                </Tag>
                {row.must_change_password ? (
                  <Tag color="orange">Password change required</Tag>
                ) : null}
              </Space>
            ),
          },
          {
            title: "System",
            render: (_, row) => (
              <Switch
                checked={row.is_system_admin}
                disabled={!row.active || isMutating}
                onChange={(enabled) =>
                  void action({ action: "set_system_role", userId: row.user_id, enabled })
                }
              />
            ),
          },
          {
            title: "Organizations",
            render: (_, row) => (
              <Select
                mode="multiple"
                value={row.organizationIds}
                disabled={!row.active || isMutating}
                style={{ minWidth: 260 }}
                options={(organizations?.organizations ?? []).map((item) => ({
                  label: item.name,
                  value: item.id,
                }))}
                onChange={(organizationIds) =>
                  void action({
                    action: "set_memberships",
                    userId: row.user_id,
                    organizationIds,
                  })
                }
              />
            ),
          },
          {
            title: "Actions",
            render: (_, row) => (
              <Space>
                <Button
                  disabled={!row.active}
                  onClick={() => {
                    resetForm.resetFields();
                    setResetTarget(row);
                  }}
                >
                  Reset password
                </Button>
                <Popconfirm
                  title="Remove this dashboard account?"
                  description="Memberships are revoked and the Auth user is banned."
                  onConfirm={() => action({ action: "remove", userId: row.user_id })}
                >
                  <Button danger disabled={!row.active}>
                    Remove
                  </Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title="Create account"
        open={createOpen}
        okText="Create account"
        confirmLoading={isMutating}
        onCancel={() => {
          setCreateOpen(false);
          createForm.resetFields();
        }}
        onOk={() => createForm.submit()}
      >
        <Form
          form={createForm}
          layout="vertical"
          initialValues={{ organizationIds: [], isSystemAdmin: false }}
          onFinish={async (values) => {
            try {
              await trigger({ method: "POST", body: values });
              createForm.resetFields();
              setCreateOpen(false);
              message.success("Account created; an initial password change is required");
            } catch (err) {
              message.error(apiErrorMessage(err));
            }
          }}
        >
          <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="displayName" label="Display name">
            <Input />
          </Form.Item>
          <Form.Item
            name="initialPassword"
            label="Initial password"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item name="organizationIds" label="Organizations">
            <Select
              mode="multiple"
              options={(organizations?.organizations ?? []).map((item) => ({
                label: item.name,
                value: item.id,
              }))}
            />
          </Form.Item>
          <Form.Item name="isSystemAdmin" label="System administrator" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title={`Reset password${resetTarget ? ` for ${resetTarget.email}` : ""}`}
        open={Boolean(resetTarget)}
        confirmLoading={isMutating}
        onCancel={() => setResetTarget(null)}
        onOk={() => resetForm.submit()}
      >
        <Form
          form={resetForm}
          onFinish={async ({ password }) => {
            const ok = await action({
              action: "reset_password",
              userId: resetTarget!.user_id,
              password,
            });
            if (!ok) return;
            setResetTarget(null);
            message.success("Password reset; change is required at next login");
          }}
        >
          <Form.Item
            name="password"
            label="New temporary password"
            rules={[{ required: true, min: 8 }]}
          >
            <Input.Password />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
