"use client";

import { DownloadSimpleIcon } from "@phosphor-icons/react";
import { Alert, Button, Descriptions, Select, Skeleton, Table, Tag } from "antd";
import { useState } from "react";
import useSWR from "swr";

import type { AdminBookingRow } from "@/features/bookings/types";
import { apiGet } from "@/lib/api/client";
import { apiKey } from "@/lib/api/keys";

import { PageHeading } from "./page-heading";

type BookingResponse = { items: AdminBookingRow[]; simulatorEnabled?: boolean };

function BookingDetail({ row }: { row: AdminBookingRow }) {
  return (
    <Descriptions
      bordered
      size="small"
      column={{ xs: 1, sm: 2, lg: 3 }}
      items={[
        { key: "reference", label: "Reference", children: row.id },
        {
          key: "source",
          label: "Source",
          children: (
            <Tag color={row.simulated ? "warning" : "default"}>
              {row.simulated ? "Simulator" : "Real"}
            </Tag>
          ),
        },
        {
          key: "localTime",
          label: "Booked local time",
          children: `${row.localTimeLabel} (${row.timezone})`,
        },
        {
          key: "services",
          label: "Services",
          span: 3,
          children: row.serviceDetails.length ? (
            <div className="flex flex-wrap gap-2">
              {row.serviceDetails.map((service) => (
                <span key={service.position}>
                  {service.name}
                  {service.custom ? (
                    <Tag color="processing" className="ml-1">
                      Custom
                    </Tag>
                  ) : null}
                </span>
              ))}
            </div>
          ) : (
            "[N/A]"
          ),
        },
        {
          key: "additionalRequest",
          label: "Additional request",
          span: 3,
          children: row.additionalRequest || "[N/A]",
        },
        ...(row.status === "cancelled"
          ? [
              {
                key: "cancelledAt",
                label: "Cancelled at",
                children: row.cancelledAt
                  ? new Date(row.cancelledAt).toLocaleString("en-GB")
                  : "[N/A]",
              },
              {
                key: "cancellationReason",
                label: "Cancellation reason",
                children: row.cancellationReason || "[N/A]",
              },
            ]
          : []),
        {
          key: "updatedAt",
          label: "Last updated",
          children: new Date(row.updatedAt).toLocaleString("en-GB"),
        },
      ]}
    />
  );
}

export function BookingsClient({ organizationId }: { organizationId: string }) {
  const [status, setStatus] = useState<string>();
  const [source, setSource] = useState("real");
  const base = `/api/admin/organizations/${organizationId}/bookings`;
  const query = new URLSearchParams({ source, ...(status ? { status } : {}) }).toString();
  const key = apiKey("bookings", `${base}?${query}`, organizationId, source, status);
  const { data, error, isLoading } = useSWR<BookingResponse>(key, apiGet);

  return (
    <>
      <PageHeading
        title="Bookings"
        description="Confirmed and cancelled booking records. Attendance is not inferred."
      />
      <div className="mb-4 flex items-center justify-between gap-3">
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
        {data?.simulatorEnabled ? (
          <Select
            value={source}
            onChange={setSource}
            options={[
              { value: "real", label: "Real" },
              { value: "simulator", label: "Simulator" },
              { value: "both", label: "Both" },
            ]}
            style={{ width: 150 }}
          />
        ) : null}
        <Button
          icon={<DownloadSimpleIcon size={17} />}
          href={`/api/admin/organizations/${organizationId}/reports/bookings.csv?${query}`}
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
          expandable={{ expandedRowRender: (row) => <BookingDetail row={row} /> }}
          columns={[
            { title: "Customer", dataIndex: "customerName" },
            { title: "Salon", dataIndex: "salonName" },
            { title: "Services", dataIndex: "services" },
            {
              title: "Technician",
              dataIndex: "technicianName",
              render: (value: string | null) => value || "[N/A]",
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
