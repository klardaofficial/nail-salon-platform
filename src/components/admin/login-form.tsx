"use client";

import { LockKeyIcon, UserIcon } from "@phosphor-icons/react";
import { Alert, Button, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import { apiMutation } from "@/lib/api/client";
import { apiKey, apiKeys } from "@/lib/api/keys";

type LoginValues = { email: string; password: string };

export function LoginForm() {
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { trigger, isMutating, error } = useSWRMutation(
    apiKey("admin-login", "/api/admin/auth/login"),
    apiMutation,
  );

  async function onFinish(values: LoginValues) {
    await trigger({ method: "POST", body: values });
    await mutate(apiKeys.adminIdentity);
    router.replace("/admin");
  }

  return (
    <Form<LoginValues>
      layout="vertical"
      requiredMark="optional"
      initialValues={{ email: "admin@gmail.com" }}
      onFinish={onFinish}
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          title={error instanceof Error ? error.message : "Sign in failed"}
          className="mb-5"
        />
      ) : null}
      <Form.Item name="email" label="Email address" rules={[{ required: true }, { type: "email" }]}>
        <Input prefix={<UserIcon size={18} />} autoComplete="username" size="large" />
      </Form.Item>
      <Form.Item name="password" label="Password" rules={[{ required: true }]}>
        <Input.Password
          prefix={<LockKeyIcon size={18} />}
          autoComplete="current-password"
          size="large"
        />
      </Form.Item>
      <Button type="primary" htmlType="submit" size="large" block loading={isMutating}>
        Sign in
      </Button>
    </Form>
  );
}
