"use client";

import {
  CalendarDotsIcon,
  ChartLineUpIcon,
  ChatCircleDotsIcon,
  GearSixIcon,
  HouseLineIcon,
  ScissorsIcon,
  SignOutIcon,
  StorefrontIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { Alert, Avatar, Button, Dropdown, Layout, Menu, Select, Space, Typography } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import useSWRMutation from "swr/mutation";

import type { AdminIdentity } from "@/lib/auth/admin";
import { apiMutation } from "@/lib/api/client";

const { Header, Content, Sider } = Layout;

const rootNavigation = [
  { key: "/admin", icon: <HouseLineIcon size={18} />, label: <Link href="/admin">Overview</Link> },
];

function selectedNavigation(pathname: string, items = rootNavigation) {
  if (pathname === "/admin") return ["/admin"];
  return items
    .filter((item) => item.key !== "/admin" && pathname.startsWith(item.key))
    .reverse()
    .map((item) => item.key)
    .slice(0, 1);
}

export function AdminShell({
  admin,
  organizations = [],
  children,
}: {
  admin: AdminIdentity;
  organizations?: { id: string; name: string; status: string; simulatorEnabled: boolean }[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { trigger: logout, isMutating } = useSWRMutation("/api/admin/auth/logout", apiMutation);
  const passwordChangeRequired = admin.mustChangePassword;
  const organizationId = pathname.match(/^\/admin\/organizations\/([^/]+)/)?.[1] ?? null;
  const currentOrganization = organizations.find((item) => item.id === organizationId);
  const organizationNavigation = organizationId
    ? [
        {
          key: `/admin/organizations/${organizationId}`,
          icon: <HouseLineIcon size={18} />,
          label: <Link href={`/admin/organizations/${organizationId}`}>Overview</Link>,
        },
        {
          key: `/admin/organizations/${organizationId}/bookings`,
          icon: <CalendarDotsIcon size={18} />,
          label: <Link href={`/admin/organizations/${organizationId}/bookings`}>Bookings</Link>,
        },
        {
          key: `/admin/organizations/${organizationId}/salons`,
          icon: <StorefrontIcon size={18} />,
          label: <Link href={`/admin/organizations/${organizationId}/salons`}>Salons</Link>,
        },
        {
          key: `/admin/organizations/${organizationId}/services`,
          icon: <ScissorsIcon size={18} />,
          label: <Link href={`/admin/organizations/${organizationId}/services`}>Services</Link>,
        },
        {
          key: `/admin/organizations/${organizationId}/technicians`,
          icon: <UsersThreeIcon size={18} />,
          label: (
            <Link href={`/admin/organizations/${organizationId}/technicians`}>Technicians</Link>
          ),
        },
        {
          key: `/admin/organizations/${organizationId}/analytics`,
          icon: <ChartLineUpIcon size={18} />,
          label: <Link href={`/admin/organizations/${organizationId}/analytics`}>Analytics</Link>,
        },
        {
          key: `/admin/organizations/${organizationId}/inbox`,
          icon: <ChatCircleDotsIcon size={18} />,
          label: <Link href={`/admin/organizations/${organizationId}/inbox`}>Inbox</Link>,
        },
        {
          key: `/admin/organizations/${organizationId}/simulator`,
          icon: <ChatCircleDotsIcon size={18} />,
          label: <Link href={`/admin/organizations/${organizationId}/simulator`}>Simulator</Link>,
        },
        {
          key: `/admin/organizations/${organizationId}/accounts`,
          icon: <UsersThreeIcon size={18} />,
          label: <Link href={`/admin/organizations/${organizationId}/accounts`}>Accounts</Link>,
        },
        {
          key: `/admin/organizations/${organizationId}/settings`,
          icon: <GearSixIcon size={18} />,
          label: <Link href={`/admin/organizations/${organizationId}/settings`}>Settings</Link>,
        },
      ]
    : rootNavigation;
  const visibleNavigation = [
    ...organizationNavigation,
    ...(!organizationId && admin.isSystemAdmin
      ? [
          {
            key: "/admin/system/accounts",
            icon: <UsersThreeIcon size={18} />,
            label: <Link href="/admin/system/accounts">System accounts</Link>,
          },
          {
            key: "/admin/system/meta",
            icon: <GearSixIcon size={18} />,
            label: <Link href="/admin/system/meta">Root Meta</Link>,
          },
        ]
      : []),
  ];

  useEffect(() => {
    if (passwordChangeRequired && pathname !== "/admin/account") {
      router.replace("/admin/account");
    }
  }, [passwordChangeRequired, pathname, router]);

  async function handleLogout() {
    await logout({ method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  const accountItems = [
    {
      key: "account",
      icon: <UserCircleIcon size={17} />,
      label: <Link href="/admin/account">Account settings</Link>,
    },
    { type: "divider" as const },
    {
      key: "logout",
      icon: <SignOutIcon size={17} />,
      label: "Sign out",
      danger: true,
      onClick: handleLogout,
    },
  ];

  return (
    <Layout className="admin-shell">
      <Sider className="admin-sider" breakpoint="lg" collapsedWidth="0" width={232}>
        <Link href={passwordChangeRequired ? "/admin/account" : "/admin"} className="admin-brand">
          <span className="admin-brand-mark">N</span>
          <span>Nail Platform</span>
        </Link>
        <Menu
          mode="inline"
          selectedKeys={selectedNavigation(pathname, visibleNavigation)}
          items={visibleNavigation
            .filter(
              (item) => currentOrganization?.simulatorEnabled || !item.key.endsWith("/simulator"),
            )
            .map((item) => ({
              ...item,
              disabled: passwordChangeRequired,
            }))}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
          <Space>
            <Select
              aria-label="Organization"
              value={organizationId ?? undefined}
              placeholder="Choose organization"
              options={organizations.map((organization) => ({
                value: organization.id,
                label: `${organization.name}${organization.status === "archived" ? " (archived)" : ""}`,
              }))}
              onChange={(id) => router.push(`/admin/organizations/${id}`)}
              style={{ minWidth: 220 }}
            />
            {currentOrganization ? (
              <Typography.Text type="secondary">{currentOrganization.name}</Typography.Text>
            ) : null}
          </Space>
          <Dropdown menu={{ items: accountItems }} placement="bottomRight" trigger={["click"]}>
            <Button type="text" loading={isMutating}>
              <Space>
                <Avatar size={30}>
                  {(admin.displayName || admin.email).slice(0, 1).toUpperCase()}
                </Avatar>
                <Typography.Text>{admin.displayName || admin.email}</Typography.Text>
              </Space>
            </Button>
          </Dropdown>
        </Header>
        <Content className="admin-content">
          {passwordChangeRequired && pathname !== "/admin/account" ? (
            <Alert
              type="warning"
              showIcon
              title="Redirecting to the required initial password change"
            />
          ) : (
            children
          )}
        </Content>
      </Layout>
    </Layout>
  );
}
