"use client";

import { LoginForm } from "@/components/admin/login-form";

export default function AdminLoginPage() {
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
          <LoginForm />
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
