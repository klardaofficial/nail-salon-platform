"use client";

import { Alert, Table, Tag } from "antd";
import useSWR from "swr";

import { apiGet } from "@/lib/api/client";
import { apiKey } from "@/lib/api/keys";

import { PageHeading } from "./page-heading";

type Member = {
  created_at: string;
  admin:
    | { user_id: string; email: string; display_name: string | null; active: boolean }
    | { user_id: string; email: string; display_name: string | null; active: boolean }[];
};

export function OrganizationAccountsClient({ organizationId }: { organizationId: string }) {
  const { data, error, isLoading } = useSWR<{ members: Member[] }>(
    apiKey(
      "organization-accounts",
      `/api/admin/organizations/${organizationId}/accounts`,
      organizationId,
    ),
    apiGet,
  );
  const rows = (data?.members ?? []).map((item) => ({
    ...item,
    admin: Array.isArray(item.admin) ? item.admin[0] : item.admin,
  }));
  return (
    <>
      <PageHeading
        title="Organization accounts"
        description="Dashboard accounts with an active membership in this organization."
      />
      {error ? <Alert type="error" showIcon title={error.message} /> : null}
      <Table
        rowKey={(row) => row.admin.user_id}
        loading={isLoading}
        dataSource={rows}
        columns={[
          { title: "Name", render: (_, row) => row.admin.display_name || "—" },
          { title: "Email", render: (_, row) => row.admin.email },
          {
            title: "Status",
            render: (_, row) => (
              <Tag color={row.admin.active ? "green" : "default"}>
                {row.admin.active ? "Active" : "Inactive"}
              </Tag>
            ),
          },
          {
            title: "Assigned",
            dataIndex: "created_at",
            render: (value: string) => new Date(value).toLocaleString("en-GB"),
          },
        ]}
      />
    </>
  );
}
