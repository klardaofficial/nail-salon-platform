"use client";

import {
  App,
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
import { DotsThreeIcon } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { apiMutation } from "@/lib/api/client";

type Organization = { id: string; name: string; status: "active" | "archived" };

export function OrganizationsClient({ canManage }: { canManage: boolean }) {
  const endpoint = "/api/admin/organizations";
  const { data, mutate } = useSWR<{ organizations: Organization[]; total: number }>(endpoint);
  const { trigger, isMutating } = useSWRMutation(endpoint, apiMutation);
  const [form] = Form.useForm();
  const [createOpen, setCreateOpen] = useState(false);
  const { message, modal } = App.useApp();
  async function lifecycle(id: string, archived: boolean) {
    await trigger({ method: "PATCH", body: { id, archived } });
    await mutate();
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
                actions={
                  canManage
                    ? [
                        <Dropdown
                          key="actions"
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
                        </Dropdown>,
                      ]
                    : undefined
                }
              >
                <Link href={`/admin/organizations/${organization.id}`}>
                  <Space>
                    <Typography.Text strong>{organization.name}</Typography.Text>
                    <Tag color={organization.status === "active" ? "green" : "default"}>
                      {organization.status}
                    </Tag>
                  </Space>
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
            await trigger({ method: "POST", body: { name } });
            form.resetFields();
            await mutate();
            setCreateOpen(false);
            message.success("Organization created");
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
