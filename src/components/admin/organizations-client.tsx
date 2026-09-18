"use client";

import {
  App,
  Avatar,
  Button,
  Card,
  Col,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Space,
  Tag,
  Typography,
} from "antd";
import { ArrowRightIcon, DotsThreeIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import type { AdminIdentity } from "@/features/admin/contracts";
import { apiErrorMessage, apiGet, apiMutation } from "@/lib/api/client";
import { apiKey, apiKeys } from "@/lib/api/keys";

type Organization = { id: string; name: string; status: "active" | "archived" };

export function OrganizationsClient() {
  const endpoint = "/api/admin/organizations";
  const directoryKey = apiKey("organization-directory", endpoint);
  const { data: admin } = useSWR<AdminIdentity>(apiKeys.adminIdentity, apiGet);
  const { mutate: mutateCache } = useSWRConfig();
  const canManage = Boolean(admin?.isSystemAdmin);
  const { data } = useSWR<{ organizations: Organization[]; total: number }>(directoryKey, apiGet);
  const { trigger, isMutating } = useSWRMutation(directoryKey, apiMutation);
  const [form] = Form.useForm();
  const [createOpen, setCreateOpen] = useState(false);
  const { message, modal } = App.useApp();
  async function lifecycle(id: string, archived: boolean) {
    try {
      await trigger({ method: "PATCH", body: { id, archived } });
      await mutateCache(apiKeys.organizations);
    } catch (err) {
      message.error(apiErrorMessage(err));
    }
  }
  return (
    <Space orientation="vertical" size="large" style={{ width: "100%" }}>
      <div>
        <Typography.Title level={2}>Organizations</Typography.Title>
        <Typography.Text type="secondary">
          Choose the organization whose data you want to manage.
        </Typography.Text>
      </div>
      {canManage ? (
        <Space style={{ display: "flex", justifyContent: "flex-end" }}>
          <Button type="primary" onClick={() => setCreateOpen(true)}>
            Create organization
          </Button>
        </Space>
      ) : null}
      {!data?.organizations.length ? (
        <Empty description="No active organization membership" />
      ) : (
        <Row gutter={[16, 16]}>
          {data.organizations.map((organization) => (
            <Col xs={24} md={12} xl={8} key={organization.id}>
              <Card
                className="admin-org-card"
                styles={{ body: { padding: 0 } }}
                extra={
                  canManage ? (
                    <Dropdown
                      menu={{
                        items: [
                          {
                            key: "lifecycle",
                            danger: organization.status === "active",
                            label: organization.status === "active" ? "Archive" : "Recover",
                            onClick: () => {
                              const action =
                                organization.status === "active" ? "Archive" : "Recover";
                              modal.confirm({
                                title: `${action} this organization?`,
                                content:
                                  organization.status === "active"
                                    ? "Archived organizations are read-only."
                                    : undefined,
                                okText: action,
                                okButtonProps: {
                                  danger: organization.status === "active",
                                },
                                onOk: () =>
                                  lifecycle(organization.id, organization.status === "active"),
                              });
                            },
                          },
                        ],
                      }}
                      trigger={["click"]}
                    >
                      <Button
                        aria-label={`More actions for ${organization.name}`}
                        icon={<DotsThreeIcon size={20} />}
                        type="text"
                      />
                    </Dropdown>
                  ) : undefined
                }
              >
                <Link href={`/admin/organizations/${organization.id}`} className="admin-org-link">
                  <Space size={14}>
                    <Avatar className="admin-org-avatar" size={40} shape="square">
                      {organization.name.charAt(0).toUpperCase()}
                    </Avatar>
                    <div>
                      <Typography.Text strong className="admin-org-name">
                        {organization.name}
                      </Typography.Text>
                      <div>
                        <Tag color={organization.status === "active" ? "green" : "default"}>
                          {organization.status}
                        </Tag>
                      </div>
                    </div>
                  </Space>
                  <ArrowRightIcon size={18} className="admin-org-arrow" />
                </Link>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      {data && data.total > data.organizations.length ? (
        <Typography.Text type="secondary">
          Showing the first {data.organizations.length} of {data.total} organizations.
        </Typography.Text>
      ) : null}
      <Modal
        title="Create organization"
        open={createOpen}
        okText="Create organization"
        confirmLoading={isMutating}
        onCancel={() => {
          setCreateOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={async ({ name }) => {
            try {
              await trigger({ method: "POST", body: { name } });
              form.resetFields();
              await mutateCache(apiKeys.organizations);
              setCreateOpen(false);
              message.success("Organization created");
            } catch (err) {
              message.error(apiErrorMessage(err));
            }
          }}
        >
          <Form.Item
            name="name"
            label="Organization name"
            rules={[{ required: true, min: 1, max: 120 }]}
          >
            <Input placeholder="Organization name" />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  );
}
