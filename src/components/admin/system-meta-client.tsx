"use client";

import { Alert, App, Button, Card, Form, Input, Space, Typography } from "antd";
import { useEffect } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import { apiErrorMessage, apiGet, apiMutation } from "@/lib/api/client";
import { apiKey } from "@/lib/api/keys";
import { PageHeading } from "./page-heading";

type RootMeta = {
  accessToken: string | null;
  appSecret: string | null;
  webhookVerifyToken: string | null;
  confirmedTemplate: string | null;
  cancelledTemplate: string | null;
  callbackUrl: string;
};

export function SystemMetaClient() {
  const endpoint = "/api/admin/system/meta";
  const metaKey = apiKey("root-meta", endpoint);
  const { data, error } = useSWR<RootMeta>(metaKey, apiGet);
  const { trigger, isMutating } = useSWRMutation(metaKey, apiMutation);
  const [form] = Form.useForm();
  const { message } = App.useApp();
  useEffect(() => {
    if (data) form.setFieldsValue(data);
  }, [data, form]);
  return (
    <>
      <PageHeading
        title="Root Meta settings"
        description="System-only inherited Meta credentials and template defaults."
      />
      {error ? <Alert type="error" showIcon title={error.message} /> : null}
      {data ? (
        <Space orientation="vertical" size="large" style={{ width: "100%" }}>
          <Card title="Root callback">
            <Typography.Text code copyable={{ text: data.callbackUrl }}>
              {data.callbackUrl}
            </Typography.Text>
          </Card>
          <Card title="Credentials and template defaults">
            <Form
              form={form}
              layout="vertical"
              onFinish={async (values) => {
                try {
                  await trigger({ method: "PATCH", body: values });
                  message.success(
                    "Root Meta settings saved; inherited validations were invalidated",
                  );
                } catch (err) {
                  message.error(apiErrorMessage(err));
                }
              }}
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
              <Form.Item name="confirmedTemplate" label="Default technician confirmation template">
                <Input />
              </Form.Item>
              <Form.Item name="cancelledTemplate" label="Default technician cancellation template">
                <Input />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={isMutating}>
                Save root settings
              </Button>
            </Form>
          </Card>
        </Space>
      ) : null}
    </>
  );
}
