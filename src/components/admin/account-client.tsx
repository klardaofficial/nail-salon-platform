"use client";

import { Alert, App, Button, Card, Form, Input } from "antd";
import useSWRMutation from "swr/mutation";
import { useRouter } from "next/navigation";

import { apiMutation } from "@/lib/api/client";
import { PageHeading } from "./page-heading";

type PasswordValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export function AccountClient({
  email,
  mustChangePassword,
}: {
  email: string;
  mustChangePassword: boolean;
}) {
  const [form] = Form.useForm<PasswordValues>();
  const { message } = App.useApp();
  const router = useRouter();
  const { trigger, isMutating, error } = useSWRMutation("/api/admin/auth/password", apiMutation);

  async function changePassword(values: PasswordValues) {
    await trigger({ method: "PATCH", body: values });
    form.resetFields();
    message.success("Password changed. Use the new password on your next sign in.");
    router.replace("/admin");
    router.refresh();
  }

  return (
    <>
      <PageHeading title="Account settings" description={`Signed in as ${email}`} />
      <Card title="Change password" style={{ maxWidth: 620 }}>
        {mustChangePassword ? (
          <Alert
            type="warning"
            showIcon
            message="Change the initial password before continuing"
            style={{ marginBottom: 18 }}
          />
        ) : null}
        {error ? (
          <Alert type="error" showIcon message={error.message} style={{ marginBottom: 18 }} />
        ) : null}
        <Form<PasswordValues>
          form={form}
          layout="vertical"
          requiredMark="optional"
          onFinish={changePassword}
        >
          <Form.Item name="currentPassword" label="Current password" rules={[{ required: true }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item
            name="newPassword"
            label="New password"
            rules={[{ required: true }, { min: 12 }]}
            extra="Use at least 12 characters."
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm new password"
            dependencies={["newPassword"]}
            rules={[
              { required: true },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || value === getFieldValue("newPassword")
                    ? Promise.resolve()
                    : Promise.reject(new Error("The passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={isMutating}>
            Change password
          </Button>
        </Form>
      </Card>
    </>
  );
}
