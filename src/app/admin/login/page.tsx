import { Alert } from "antd";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/admin/login-form";
import { getAdminIdentity } from "@/lib/auth/admin";
import { hasSupabaseConfig } from "@/lib/config/env";

export default async function AdminLoginPage() {
  const currentAdmin = await getAdminIdentity();
  if (currentAdmin) {
    redirect(currentAdmin.mustChangePassword ? "/admin/account" : "/admin");
  }

  return (
    <main className="admin-login-page">
      <section className="admin-login-panel">
        <div className="admin-login-form">
          <div className="admin-brand">
            <span className="admin-brand-mark">N</span>
            <span>Nail Platform</span>
          </div>
          <h1>Welcome back</h1>
          <p>Sign in to manage salons, bookings, and platform usage.</p>
          {!hasSupabaseConfig() ? (
            <Alert
              type="warning"
              showIcon
              title="Local configuration required"
              description="Copy .env.example to .env.local and add your Supabase values before signing in."
              style={{ marginBottom: 24 }}
            />
          ) : null}
          <LoginForm disabled={!hasSupabaseConfig()} />
        </div>
      </section>
      <aside className="admin-login-aside">
        <strong>One view for every salon.</strong>
        <p>
          Track booking activity, returning customers, bot operations, and the figures used for
          monthly owner reporting.
        </p>
      </aside>
    </main>
  );
}
