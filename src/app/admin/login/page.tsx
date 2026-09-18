"use client";

import { LoginForm } from "@/components/admin/login-form";

export default function AdminLoginPage() {
  return (
    <main className="max-admin-lg:grid-cols-1 grid min-h-dvh grid-cols-[minmax(360px,0.85fr)_minmax(460px,1.15fr)] bg-[#eef1f4]">
      <section className="flex items-center justify-center bg-white p-10">
        <div className="w-[min(100%,390px)]">
          <div className="text-admin-ink flex h-16 items-center gap-2.5 text-[15px] font-bold whitespace-nowrap">
            <span className="bg-accent grid size-[30px] flex-none place-items-center rounded-[9px] text-[13px] text-white">
              N
            </span>
            <span>Nail Platform</span>
          </div>
          <h1 className="mt-8 mb-2 text-[31px] tracking-[-0.04em]">Welcome back</h1>
          <p className="text-admin-muted mt-0 mb-[30px]">
            Sign in to manage salons, bookings, and platform usage.
          </p>
          <LoginForm />
        </div>
      </section>
      <aside className="max-admin-lg:hidden flex min-h-full flex-col justify-between bg-[#22242b] p-[clamp(44px,7vw,96px)] text-[#f7f8fa]">
        <strong className="max-w-[12ch] text-[clamp(40px,5vw,72px)] leading-[1.02] tracking-[-0.055em]">
          One view for every salon.
        </strong>
        <p className="max-w-[48ch] leading-[1.6] text-[#b7bec8]">
          Track booking activity, returning customers, bot operations, and the figures used for
          monthly owner reporting.
        </p>
      </aside>
    </main>
  );
}
