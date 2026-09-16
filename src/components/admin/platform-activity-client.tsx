"use client";

import {
  Alert,
  Button,
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
import { useState } from "react";
import useSWR from "swr";

import type {
  ActivityChannel,
  AIBreakdown,
  AIUsageLogs,
  PlatformActivity,
} from "@/features/analytics/platform-types";
import { apiKeys } from "@/lib/api/keys";

const Line = dynamic(() => import("@ant-design/charts").then((module) => module.Line), {
  ssr: false,
});
const number = (value: number | null) =>
  value === null ? "Unavailable" : value.toLocaleString("en-GB");
const usd = (value: number) =>
  value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  });
const kindLabel = (kind: string) => (kind === "chat_text" ? "Chat text" : "Image generation");
const channelLabel = (channel: string) => (channel === "whatsapp" ? "WhatsApp" : "Simulator");

function AISummary({ rows, kind }: { rows: AIBreakdown[]; kind: AIBreakdown["kind"] }) {
  const selected = rows.filter((row) => row.kind === kind);
  const calls = selected.reduce((total, row) => total + row.calls, 0);
  const unpriced = selected.reduce((total, row) => total + row.unpriced_calls, 0);
  const cost = selected.reduce((total, row) => total + row.cost, 0);
  return (
    <Card title={kindLabel(kind)} style={{ height: "100%" }}>
      <Statistic title="AI requests" value={calls} />
      <Typography.Paragraph style={{ marginTop: 12, marginBottom: 8 }}>
        {number(selected.reduce((total, row) => total + row.input_tokens, 0))} input tokens ·{" "}
        {number(selected.reduce((total, row) => total + row.output_tokens, 0))} output tokens
        {kind === "image_generation"
          ? ` · ${number(selected.reduce((total, row) => total + row.images, 0))} images generated`
          : ""}
      </Typography.Paragraph>
      <Typography.Text strong>
        {unpriced && unpriced === calls
          ? "Estimate unavailable"
          : `${usd(cost)} estimated${unpriced ? " (partial subtotal)" : ""}`}
      </Typography.Text>
      {unpriced ? (
        <div>
          <Typography.Text type="secondary">
            {unpriced} requests without a cost estimate
          </Typography.Text>
        </div>
      ) : null}
    </Card>
  );
}

function UsageLog({ from, to, channel }: { from: string; to: string; channel: ActivityChannel }) {
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState("all");
  const { data, error, isLoading, mutate } = useSWR<AIUsageLogs>(
    apiKeys.aiUsage(from, to, channel, page, kind),
    { refreshInterval: 15000 },
  );
  return (
    <Card
      title="AI request log"
      style={{ marginTop: 16 }}
      extra={
        <Select
          aria-label="Filter AI request type"
          value={kind}
          style={{ width: 170 }}
          onChange={(value) => {
            setKind(value);
            setPage(1);
          }}
          options={[
            { label: "All AI requests", value: "all" },
            { label: "Chat text", value: "chat_text" },
            { label: "Image generation", value: "image_generation" },
          ]}
        />
      }
    >
      {error ? (
        <Alert
          type="error"
          showIcon
          title="Could not load AI request log"
          action={
            <Button size="small" onClick={() => void mutate().catch(() => undefined)}>
              Retry
            </Button>
          }
        />
      ) : null}
      <Typography.Paragraph type="secondary">
        Each chat tool round and image generation call has its own record. A started request may
        still be running or have an interrupted usage update. Times use your browser timezone.
      </Typography.Paragraph>
      <Table
        rowKey="id"
        size="small"
        loading={isLoading}
        dataSource={data?.items ?? []}
        scroll={{ x: 1200 }}
        locale={{ emptyText: "No recorded AI requests in this period" }}
        pagination={{
          current: page,
          pageSize: data?.pageSize ?? 25,
          total: data?.total ?? 0,
          showSizeChanger: false,
          onChange: setPage,
        }}
        columns={[
          {
            title: "Started",
            dataIndex: "started_at",
            render: (value: string) => new Date(value).toLocaleString("en-GB"),
          },
          { title: "Type", dataIndex: "kind", render: kindLabel },
          { title: "Model", dataIndex: "model" },
          { title: "Source", dataIndex: "channel", render: channelLabel },
          {
            title: "Status",
            dataIndex: "status",
            render: (value: string) => (
              <Tag
                color={
                  value === "failed" ? "error" : value === "completed" ? "success" : "processing"
                }
              >
                {value}
              </Tag>
            ),
          },
          { title: "Input tokens", dataIndex: "input_tokens", render: number },
          { title: "Cached input", dataIndex: "cached_input_tokens", render: number },
          { title: "Text input", dataIndex: "input_text_tokens", render: number },
          { title: "Image input", dataIndex: "input_image_tokens", render: number },
          { title: "Output tokens", dataIndex: "output_tokens", render: number },
          { title: "Images", dataIndex: "image_count" },
          {
            title: "Estimated USD",
            dataIndex: "estimated_cost_usd",
            render: (value: number | null) => (value === null ? "Unavailable" : usd(value)),
          },
        ]}
      />
    </Card>
  );
}

export function PlatformActivityClient({ from, to }: { from: string; to: string }) {
  const [channel, setChannel] = useState<ActivityChannel>("whatsapp");
  const { data, error, isLoading, mutate } = useSWR<PlatformActivity>(
    apiKeys.platform(from, to, channel),
    { refreshInterval: 15000 },
  );
  const messageTrend =
    data?.trends.flatMap((point) => [
      { date: point.date, value: point.received, metric: "Received" },
      { date: point.date, value: point.sent, metric: "Sent" },
      { date: point.date, value: point.activeUsers, metric: "Active users" },
    ]) ?? [];
  const costTrend =
    data?.trends.flatMap((point) => [
      { date: point.date, value: point.chatCost, kind: "Chat text" },
      { date: point.date, value: point.imageCost, kind: "Image generation" },
    ]) ?? [];
  const hasPricedUsage = data?.ai.some((row) => row.calls > row.unpriced_calls);

  return (
    <section aria-label="Platform activity" style={{ marginTop: 36 }}>
      <Space wrap style={{ width: "100%", justifyContent: "space-between", marginBottom: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          Platform activity
        </Typography.Title>
        <Space wrap>
          <Select
            aria-label="Activity source"
            value={channel}
            onChange={setChannel}
            style={{ width: 170 }}
            options={[
              { label: "WhatsApp", value: "whatsapp" },
              { label: "Simulator", value: "whatsapp_simulator" },
              { label: "All sources", value: "all" },
            ]}
          />
          <Button href={apiKeys.platformCsv(from, to, channel)} disabled={!data || Boolean(error)}>
            Export activity CSV
          </Button>
        </Space>
      </Space>
      <Typography.Paragraph type="secondary">
        Uses the reporting date range above{data ? ` (${data.period.timezone})` : ""}. Active users
        sent at least one message in the period. Sent counts messages accepted for sending,
        including staff notifications. Choose All sources to include simulator AI costs.
      </Typography.Paragraph>
      {error ? (
        <Alert
          type="error"
          showIcon
          title="Could not load platform activity"
          action={
            <Button size="small" onClick={() => void mutate().catch(() => undefined)}>
              Retry
            </Button>
          }
        />
      ) : null}
      {isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : data ? (
        <>
          <Row gutter={[16, 16]}>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Messages received" value={data.received} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Messages sent" value={data.sent} />
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card>
                <Statistic title="Active users" value={data.activeUsers} />
              </Card>
            </Col>
          </Row>
          <Card title="Messaging and active user trend" style={{ marginTop: 16 }}>
            {data.received || data.sent ? (
              <Line
                data={messageTrend}
                xField="date"
                yField="value"
                colorField="metric"
                height={260}
              />
            ) : (
              <Empty description="No messages in this period" />
            )}
          </Card>
          <Typography.Title level={4} style={{ marginTop: 24 }}>
            AI usage and estimated cost
          </Typography.Title>
          <Typography.Paragraph type="secondary">
            Usage logging begins with this feature. Estimates use configured model prices in USD.
            Missing prices or provider usage leave an incomplete cost subtotal; historical tokens
            cannot be reconstructed. Provider billing may differ.
          </Typography.Paragraph>
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <AISummary rows={data.ai} kind="chat_text" />
            </Col>
            <Col xs={24} lg={12}>
              <AISummary rows={data.ai} kind="image_generation" />
            </Col>
          </Row>
          <Card title="Known estimated AI cost by day (USD)" style={{ marginTop: 16 }}>
            {hasPricedUsage ? (
              <Line data={costTrend} xField="date" yField="value" colorField="kind" height={260} />
            ) : (
              <Empty description="No priced AI usage in this period" />
            )}
          </Card>
          <Card title="AI usage by model and source" style={{ marginTop: 16 }}>
            <Table
              rowKey={(row) => `${row.kind}:${row.model}:${row.channel}`}
              size="small"
              dataSource={data.ai}
              scroll={{ x: 1450 }}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: "Type", dataIndex: "kind", render: kindLabel },
                { title: "Model", dataIndex: "model" },
                { title: "Source", dataIndex: "channel", render: channelLabel },
                { title: "Requests", dataIndex: "calls", render: number },
                { title: "Failed", dataIndex: "failed" },
                { title: "Started / incomplete", dataIndex: "incomplete" },
                { title: "Missing usage", dataIndex: "missing_usage" },
                { title: "Unpriced", dataIndex: "unpriced_calls" },
                { title: "Input tokens", dataIndex: "input_tokens", render: number },
                { title: "Cached input", dataIndex: "cached_input_tokens", render: number },
                { title: "Text input", dataIndex: "input_text_tokens", render: number },
                { title: "Image input", dataIndex: "input_image_tokens", render: number },
                { title: "Output tokens", dataIndex: "output_tokens", render: number },
                { title: "Images", dataIndex: "images", render: number },
                {
                  title: "Known USD subtotal",
                  dataIndex: "cost",
                  render: (value: number, row: AIBreakdown) =>
                    row.unpriced_calls === row.calls
                      ? "Unavailable"
                      : `${usd(value)}${row.unpriced_calls ? " (partial)" : ""}`,
                },
              ]}
            />
          </Card>
          <Card title="Accessible platform trend data" style={{ marginTop: 16 }}>
            <Table
              rowKey="date"
              size="small"
              dataSource={data.trends}
              scroll={{ x: 1050 }}
              pagination={{ pageSize: 10 }}
              columns={[
                { title: "Date", dataIndex: "date" },
                { title: "Received", dataIndex: "received" },
                { title: "Sent", dataIndex: "sent" },
                { title: "Active users", dataIndex: "activeUsers" },
                { title: "Chat requests", dataIndex: "chatCalls" },
                { title: "Image requests", dataIndex: "imageCalls" },
                { title: "Known chat USD", dataIndex: "chatCost", render: usd },
                { title: "Known image USD", dataIndex: "imageCost", render: usd },
                { title: "Unpriced requests", dataIndex: "unpricedCalls" },
              ]}
            />
          </Card>
        </>
      ) : null}
      <UsageLog key={`${from}:${to}:${channel}`} from={from} to={to} channel={channel} />
    </section>
  );
}
