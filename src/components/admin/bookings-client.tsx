"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Alert, Button, Select, Skeleton, Table, Tag } from "antd";
import { useState } from "react";
import useSWR from "swr";

import { PageHeading } from "./page-heading";

type BookingRow = {
  id: string;
  customerName: string;
  salonName: string;
  services: string;
  technicianName: string | null;
  startsAt: string;
  status: "confirmed" | "cancelled";
  createdAt: string;
};

type BookingResponse = { items: BookingRow[] };

export function BookingsClient() {
  const [status, setStatus] = useState<string>();
  const key = `/api/admin/bookings${status ? `?status=${status}` : ""}`;
  const { data, error, isLoading } = useSWR<BookingResponse>(key);

  return (
    <>
      <PageHeading
        title="Bookings"
        description="Confirmed and cancelled booking records. Attendance is not inferred."
      />
      <div className="admin-table-toolbar">
        <Select
          allowClear
          placeholder="All statuses"
          value={status}
          onChange={setStatus}
          options={[
            { value: "confirmed", label: "Confirmed" },
            { value: "cancelled", label: "Cancelled" },
          ]}
          style={{ width: 180 }}
        />
        <Button
          icon={<DownloadSimpleIcon size={17} />}
          href={`/api/admin/reports/bookings.csv${status ? `?status=${status}` : ""}`}
        >
          Export CSV
        </Button>
      </div>
      {error ? <Alert type="error" showIcon title={error.message} /> : null}
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 9 }} />
      ) : (
        <Table
          rowKey="id"
          scroll={{ x: 1050 }}
          dataSource={data?.items ?? []}
          locale={{ emptyText: "No bookings found" }}
          columns={[
            { title: "Customer", dataIndex: "customerName" },
            { title: "Salon", dataIndex: "salonName" },
            { title: "Services", dataIndex: "services" },
            {
              title: "Technician",
              dataIndex: "technicianName",
              render: (value: string | null) => value || "Unassigned",
            },
            {
              title: "Start",
              dataIndex: "startsAt",
              render: (value: string) => new Date(value).toLocaleString("en-GB"),
            },
            {
              title: "Status",
              dataIndex: "status",
              render: (value: string) => (
                <Tag color={value === "confirmed" ? "success" : "error"}>{value}</Tag>
              ),
            },
            {
              title: "Created",
              dataIndex: "createdAt",
              render: (value: string) => new Date(value).toLocaleString("en-GB"),
            },
          ]}
        />
      )}
    </>
  );
}
