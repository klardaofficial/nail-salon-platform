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
import { useMemo, useState } from "react";
import useSWR from "swr";

import type { DashboardData } from "@/features/analytics/types";
import { apiKeys } from "@/lib/api/keys";
import { PageHeading } from "./page-heading";

const Line = dynamic(() => import("@ant-design/charts").then((module) => module.Line), {
  ssr: false,
});
const Column = dynamic(() => import("@ant-design/charts").then((module) => module.Column), {
  ssr: false,
});

export function DashboardClient() {
  const [days, setDays] = useState(30);
  const [businessId, setBusinessId] = useState<string>();
  const { data, error, isLoading } = useSWR<DashboardData>(apiKeys.dashboard(days, businessId));

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
        title="Platform overview"
        description="Booking activity and customer return signals across the platform."
      />
      <Space wrap style={{ marginBottom: 22 }}>
        <Select
          aria-label="Reporting period"
          value={days}
          onChange={setDays}
          options={[
            { value: 7, label: "Last 7 days" },
            { value: 30, label: "Last 30 days" },
            { value: 90, label: "Last 90 days" },
          ]}
        />
        <Select
          aria-label="Business filter"
          value={businessId}
          onChange={setBusinessId}
          allowClear
          placeholder="All businesses"
          style={{ minWidth: 220 }}
          options={data?.businesses.map((business) => ({
            value: business.id,
            label: business.name,
          }))}
        />
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
              <Card title="Operations">
                <Space orientation="vertical" size="large" style={{ width: "100%" }}>
                  <Statistic title="Failed jobs" value={data.health.failedJobs} />
                  <Statistic title="Pending messages" value={data.health.pendingMessages} />
                  <Statistic title="Preview failures" value={data.health.previewFailures} />
                  <Typography.Text type="secondary">
                    Period timezone: {data.period.timezone}
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
    </>
  );
}
