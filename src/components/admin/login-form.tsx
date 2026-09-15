"use client";

import { LockKey, User } from "@phosphor-icons/react";
import { Alert, Button, Form, Input } from "antd";
import { useRouter } from "next/navigation";
import useSWRMutation from "swr/mutation";

import { apiMutation } from "@/lib/api/client";

type LoginValues = { email: string; password: string };

export function LoginForm({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const { trigger, isMutating, error } = useSWRMutation("/api/admin/auth/login", apiMutation);

  async function onFinish(values: LoginValues) {
    await trigger({ method: "POST", body: values });
    router.replace("/admin");
    router.refresh();
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
          message={error instanceof Error ? error.message : "Sign in failed"}
          style={{ marginBottom: 20 }}
        />
      ) : null}
      <Form.Item name="email" label="Email address" rules={[{ required: true }, { type: "email" }]}>
        <Input prefix={<User size={18} />} autoComplete="username" size="large" />
      </Form.Item>
      <Form.Item name="password" label="Password" rules={[{ required: true }]}>
        <Input.Password
          prefix={<LockKey size={18} />}
          autoComplete="current-password"
          size="large"
        />
      </Form.Item>
      <Button
        type="primary"
        htmlType="submit"
        size="large"
        block
        loading={isMutating}
        disabled={disabled}
      >
        Sign in
      </Button>
    </Form>
  );
}
