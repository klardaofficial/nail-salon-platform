"use client";

import {
  BuildingsIcon,
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
import { Alert, Avatar, Button, Dropdown, Layout, Menu, Space, Typography } from "antd";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import useSWRMutation from "swr/mutation";

import type { AdminIdentity } from "@/lib/auth/admin";
import { apiMutation } from "@/lib/api/client";

const { Header, Content, Sider } = Layout;

const navigation = [
  { key: "/admin", icon: <HouseLineIcon size={18} />, label: <Link href="/admin">Overview</Link> },
  {
    key: "/admin/bookings",
    icon: <CalendarDotsIcon size={18} />,
    label: <Link href="/admin/bookings">Bookings</Link>,
  },
  {
    key: "/admin/businesses",
    icon: <BuildingsIcon size={18} />,
    label: <Link href="/admin/businesses">Business</Link>,
  },
  {
    key: "/admin/salons",
    icon: <StorefrontIcon size={18} />,
    label: <Link href="/admin/salons">Salons</Link>,
  },
  {
    key: "/admin/services",
    icon: <ScissorsIcon size={18} />,
    label: <Link href="/admin/services">Services</Link>,
  },
  {
    key: "/admin/technicians",
    icon: <UsersThreeIcon size={18} />,
    label: <Link href="/admin/technicians">Technicians</Link>,
  },
  {
    key: "/admin/analytics",
    icon: <ChartLineUpIcon size={18} />,
    label: <Link href="/admin/analytics">Analytics</Link>,
  },
  {
    key: "/admin/inbox",
    icon: <ChatCircleDotsIcon size={18} />,
    label: <Link href="/admin/inbox">WhatsApp inbox</Link>,
  },
  {
    key: "/admin/simulator",
    icon: <ChatCircleDotsIcon size={18} />,
    label: <Link href="/admin/simulator">WhatsApp simulator</Link>,
  },
  {
    key: "/admin/settings",
    icon: <GearSixIcon size={18} />,
    label: <Link href="/admin/settings">Settings</Link>,
  },
];

function selectedNavigation(pathname: string) {
  if (pathname === "/admin") return ["/admin"];
  return navigation
    .filter((item) => item.key !== "/admin" && pathname.startsWith(item.key))
    .map((item) => item.key);
}

export function AdminShell({
  admin,
  children,
  simulatorEnabled = false,
}: {
  admin: AdminIdentity;
  children: ReactNode;
  simulatorEnabled?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { trigger: logout, isMutating } = useSWRMutation("/api/admin/auth/logout", apiMutation);
  const passwordChangeRequired = admin.mustChangePassword;

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
          selectedKeys={selectedNavigation(pathname)}
          items={navigation
            .filter((item) => simulatorEnabled || item.key !== "/admin/simulator")
            .map((item) => ({
              ...item,
              disabled: passwordChangeRequired,
            }))}
        />
      </Sider>
      <Layout>
        <Header className="admin-header">
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
