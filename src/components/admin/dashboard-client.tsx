"use client";

import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  CalendarCheckIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import {
  Alert,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Select,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import dynamic from "next/dynamic";
import dayjs, { type Dayjs } from "dayjs";
import { useMemo, useState } from "react";
import useSWR from "swr";

import type { DashboardData } from "@/features/analytics/types";
import { apiGet } from "@/lib/api/client";
import { apiKeys } from "@/lib/api/keys";
import { PageHeading } from "./page-heading";
import { PlatformActivityClient } from "./platform-activity-client";

const Line = dynamic(() => import("@ant-design/charts").then((module) => module.Line), {
  ssr: false,
});
const Column = dynamic(() => import("@ant-design/charts").then((module) => module.Column), {
  ssr: false,
});

export function DashboardClient({
  organizationId = "00000000-0000-4000-8000-000000000101",
}: {
  organizationId?: string;
}) {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([
    dayjs().startOf("month"),
    dayjs().endOf("month"),
  ]);
  const [source, setSource] = useState<"real" | "simulator" | "both">("real");
  const { data: organizationData } = useSWR<{
    organizations: { id: string; simulatorEnabled: boolean }[];
  }>(apiKeys.organizations, apiGet);
  const simulatorEnabled = Boolean(
    organizationData?.organizations.find((item) => item.id === organizationId)?.simulatorEnabled,
  );
  const { data, error, isLoading } = useSWR<DashboardData>(
    apiKeys.dashboard(
      organizationId,
      range[0].format("YYYY-MM-DD"),
      range[1].format("YYYY-MM-DD"),
      simulatorEnabled ? source : "real",
    ),
    apiGet,
  );

  function setPreset(start: Dayjs, end: Dayjs) {
    setRange([start, end]);
  }

  const lineData = useMemo(
    () =>
      data?.trends.flatMap((point) => [
        { date: point.date, value: point.confirmed, status: "Confirmed" },
        { date: point.date, value: point.cancelled, status: "Cancelled" },
      ]) ?? [],
    [data],
  );
  const statusData = data
    ? [
        { status: "Confirmed", value: data.totals.confirmed },
        { status: "Cancelled", value: data.totals.cancelled },
      ]
    : [];

  return (
    <>
      <PageHeading
        title="Business overview"
        description="Bookings, customer return signals, messaging activity, and AI usage."
      />
      <Space wrap style={{ marginBottom: 22 }}>
        <DatePicker.RangePicker
          aria-label="Reporting date range"
          value={range}
          format="DD MMM YYYY"
          allowClear={false}
          onChange={(values) => {
            if (values?.[0] && values[1]) setRange([values[0], values[1]]);
          }}
          renderExtraFooter={() => {
            const today = dayjs();
            return (
              <div className="admin-date-range-presets">
                <Typography.Link
                  onClick={() => setPreset(today.startOf("month"), today.endOf("month"))}
                >
                  This month
                </Typography.Link>
                <Typography.Link
                  onClick={() =>
                    setPreset(
                      today.subtract(1, "month").startOf("month"),
                      today.subtract(1, "month").endOf("month"),
                    )
                  }
                >
                  Last month
                </Typography.Link>
                <Typography.Link onClick={() => setPreset(today.subtract(29, "day"), today)}>
                  Last 30 days
                </Typography.Link>
                <Typography.Link onClick={() => setPreset(today.subtract(89, "day"), today)}>
                  Last 90 days
                </Typography.Link>
              </div>
            );
          }}
        />
        {simulatorEnabled ? (
          <Select
            aria-label="Booking source"
            value={source}
            style={{ width: 160 }}
            onChange={setSource}
            options={[
              { label: "Real", value: "real" },
              { label: "Simulator", value: "simulator" },
              { label: "Both", value: "both" },
            ]}
          />
        ) : null}
      </Space>

      {error ? (
        <Alert type="error" showIcon title={error.message} style={{ marginBottom: 20 }} />
      ) : null}
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 10 }} />
      ) : data ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <Card className="admin-stat-card">
                <Statistic
                  title="Total bookings"
                  value={data.totals.total}
                  prefix={<CalendarCheckIcon size={22} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card className="admin-stat-card">
                <Statistic
                  title="Confirmed"
                  value={data.totals.confirmed}
                  styles={{ content: { color: "#317159" } }}
                  prefix={<ArrowUpRightIcon size={22} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card className="admin-stat-card">
                <Statistic
                  title="Cancelled"
                  value={data.totals.cancelled}
                  styles={{ content: { color: "#a33a4a" } }}
                  prefix={<ArrowDownRightIcon size={22} />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <Card className="admin-stat-card">
                <Statistic
                  title="Returning customers"
                  value={data.totals.returningCustomers}
                  suffix={data.totals.uniqueCustomers ? ` / ${data.totals.uniqueCustomers}` : ""}
                  prefix={<UsersIcon size={22} />}
                />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={16}>
              <Card title="Booking trend" className="admin-chart-card">
                {lineData.length ? (
                  <Line
                    data={lineData}
                    xField="date"
                    yField="value"
                    colorField="status"
                    scale={{ color: { range: ["#317159", "#a33a4a"] } }}
                    axis={{ y: { labelFormatter: (value: number) => `${value}` } }}
                  />
                ) : (
                  <Empty description="No bookings in this period" />
                )}
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card title="Current status" className="admin-chart-card">
                {data.totals.total ? (
                  <Column
                    data={statusData}
                    xField="status"
                    yField="value"
                    colorField="status"
                    scale={{ color: { range: ["#317159", "#a33a4a"] } }}
                  />
                ) : (
                  <Empty description="No status data" />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} xl={16}>
              <Card title="Recent bookings">
                <Table
                  rowKey="id"
                  pagination={false}
                  locale={{ emptyText: "No bookings yet" }}
                  dataSource={data.recentBookings}
                  columns={[
                    { title: "Customer", dataIndex: "customerName" },
                    { title: "Salon", dataIndex: "salonName" },
                    {
                      title: "Starts",
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
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} xl={8}>
              <Card title="Current queue health">
                <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                  <Statistic title="Failed jobs" value={data.health.failedJobs} />
                  <Statistic title="Pending messages" value={data.health.pendingMessages} />
                  <Statistic title="Preview failures" value={data.health.previewFailures} />
                  <Typography.Text type="secondary">
                    Current backlog across all dates and sources. Reporting timezone:{" "}
                    {data.period.timezone}
                  </Typography.Text>
                </Space>
              </Card>
            </Col>
          </Row>

          <Card title="Accessible trend data" style={{ marginTop: 16 }}>
            <Table
              rowKey="date"
              size="small"
              pagination={{ pageSize: 10 }}
              dataSource={data.trends}
              columns={[
                { title: "Date", dataIndex: "date" },
                { title: "Total", dataIndex: "total" },
                { title: "Confirmed", dataIndex: "confirmed" },
                { title: "Cancelled", dataIndex: "cancelled" },
              ]}
            />
          </Card>
        </>
      ) : (
        <Empty description="Dashboard data is unavailable" />
      )}
      <PlatformActivityClient
        organizationId={organizationId}
        simulatorEnabled={simulatorEnabled}
        from={range[0].format("YYYY-MM-DD")}
        to={range[1].format("YYYY-MM-DD")}
      />
    </>
  );
}
