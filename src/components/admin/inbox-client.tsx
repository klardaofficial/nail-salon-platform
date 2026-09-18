"use client";

import { ArrowClockwiseIcon, ArrowLeftIcon, ChatCircleDotsIcon } from "@phosphor-icons/react";
import {
  Alert,
  Avatar,
  Button,
  Empty,
  Input,
  Pagination,
  Segmented,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

import type {
  InboxChannel,
  InboxMessages,
  InboxRole,
  InboxThread,
  InboxThreads,
} from "@/features/inbox/contracts";
import { apiGet } from "@/lib/api/client";
import { apiKeys } from "@/lib/api/keys";
import { ChatMessageBubble } from "./chat-message";
import { PageHeading } from "./page-heading";

function Roles({ roles }: { roles: InboxThread["roles"] }) {
  return roles.length ? (
    roles.map((role) => (
      <Tag key={role} color={role === "owner" ? "purple" : "blue"}>
        {role === "owner" ? "Owner" : "Technician"}
      </Tag>
    ))
  ) : (
    <Tag>Customer</Tag>
  );
}

function Conversation({
  thread,
  organizationId,
  channel,
  onBack,
}: {
  thread: InboxThread;
  organizationId: string;
  channel: InboxChannel;
  onBack: () => void;
}) {
  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<InboxMessages>(
      (page: number, previous: InboxMessages | null) => {
        if (page && !previous?.nextCursor) return null;
        return apiKeys.inboxMessages(organizationId, channel, thread.waId, previous?.nextCursor);
      },
      apiGet,
      { refreshInterval: 10000, revalidateAll: true },
    );
  const messages = useMemo(
    () =>
      [
        ...new Map(
          (data ?? []).flatMap((page) => page.messages).map((item) => [item.id, item]),
        ).values(),
      ].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
    [data],
  );
  const transcript = useRef<HTMLDivElement>(null);
  const followingLatest = useRef(true);
  const olderScroll = useRef<{ height: number; top: number; count: number } | null>(null);
  useEffect(() => {
    const element = transcript.current;
    if (!element) return;
    if (olderScroll.current && messages.length > olderScroll.current.count) {
      element.scrollTop =
        olderScroll.current.top + element.scrollHeight - olderScroll.current.height;
      olderScroll.current = null;
    } else if (followingLatest.current) element.scrollTop = element.scrollHeight;
  }, [messages]);

  return (
    <section className="flex min-h-0 min-w-0 flex-col" aria-label={`Chat with ${thread.name}`}>
      <div className="max-admin-md:py-3 max-admin-md:px-3 max-admin-md:gap-2 flex items-center gap-3 px-5 py-4">
        <Button
          className="max-admin-md:inline-flex hidden"
          type="text"
          icon={<ArrowLeftIcon size={18} />}
          aria-label="Back to conversations"
          onClick={onBack}
        />
        <Avatar>{thread.name.slice(0, 1).toUpperCase()}</Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="[margin:0_0_3px] text-[17px] [overflow-wrap:anywhere]">{thread.name}</h2>
          <span className="text-admin-muted mb-[5px] block text-xs">+{thread.waId}</span>
          <div>
            <Roles roles={thread.roles} />
          </div>
        </div>
        <Tag>Read only</Tag>
        <Button
          type="text"
          icon={<ArrowClockwiseIcon size={18} />}
          aria-label="Refresh conversation"
          loading={isValidating}
          onClick={() => void mutate().catch(() => undefined)}
        />
      </div>
      {error ? (
        <Alert
          type="error"
          showIcon
          title="Could not load conversation"
          action={
            <Button size="small" onClick={() => void mutate().catch(() => undefined)}>
              Retry
            </Button>
          }
        />
      ) : null}
      <div
        ref={transcript}
        className="border-admin-line max-admin-md:px-3 max-admin-md:py-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [overscroll-behavior:contain] border-y bg-[#f0f3f1] p-6 [overflow-anchor:none]"
        role="log"
        aria-label={`Messages for ${thread.name}`}
        aria-live="polite"
        aria-relevant="additions text"
        onScroll={() => {
          const element = transcript.current;
          if (element)
            followingLatest.current =
              element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
      >
        {data?.at(-1)?.nextCursor ? (
          <Button
            className="shrink-0 self-center"
            size="small"
            loading={isValidating && size > (data?.length ?? 0)}
            disabled={isValidating}
            onClick={() => {
              const element = transcript.current;
              if (element)
                olderScroll.current = {
                  height: element.scrollHeight,
                  top: element.scrollTop,
                  count: messages.length,
                };
              followingLatest.current = false;
              void setSize(size + 1).catch(() => undefined);
            }}
          >
            Load older messages
          </Button>
        ) : null}
        {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : null}
        {!isLoading && !error && !messages.length ? (
          <Empty description="No stored messages for this conversation" />
        ) : null}
        {messages.map((item) => (
          <ChatMessageBubble
            key={item.id}
            message={item}
            contactName={thread.name}
            perspective="business"
          />
        ))}
      </div>
      <div className="text-admin-muted px-5 py-3 text-center text-[11px]">
        Stored message history · Times shown in your browser timezone · Refreshes every 10 seconds
      </div>
    </section>
  );
}

export function InboxClient({
  organizationId = "00000000-0000-4000-8000-000000000101",
}: {
  organizationId?: string;
}) {
  const [channel, setChannel] = useState<InboxChannel>("whatsapp");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<InboxRole>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InboxThread | null>(null);
  const { data: organizationData } = useSWR<{
    organizations: { id: string; simulatorEnabled: boolean }[];
  }>(apiKeys.organizations, apiGet);
  const simulatorEnabled = Boolean(
    organizationData?.organizations.find((item) => item.id === organizationId)?.simulatorEnabled,
  );
  const { data, error, isLoading, isValidating, mutate } = useSWR<InboxThreads>(
    apiKeys.inbox(organizationId, channel, search, role, page),
    apiGet,
    { refreshInterval: 10000 },
  );
  const selectedThread =
    data?.conversations.find((item) => item.waId === selected?.waId) ?? selected;

  return (
    <>
      <PageHeading
        title="WhatsApp inbox"
        description="Read customer, owner, and technician conversations with your business account."
      />
      <div className="mb-5 flex flex-wrap items-center gap-4">
        {simulatorEnabled ? (
          <Segmented
            aria-label="Inbox source"
            value={channel}
            options={[
              { label: "WhatsApp", value: "whatsapp" },
              { label: "Simulator", value: "whatsapp_simulator" },
            ]}
            onChange={(value) => {
              setChannel(value as InboxChannel);
              setSelected(null);
              setPage(1);
            }}
          />
        ) : null}
        <Typography.Text type="secondary">
          Browse stored conversations and staff notifications.
        </Typography.Text>
      </div>
      <div className="border-admin-line-strong max-admin-xl:grid-cols-[280px_minmax(0,1fr)] max-admin-md:grid-cols-1 max-admin-md:h-[calc(100dvh-210px)] max-admin-md:min-h-[420px] grid h-[min(760px,calc(100dvh-240px))] min-h-[480px] grid-cols-[320px_minmax(0,1fr)] overflow-hidden rounded-xl border bg-white">
        <aside
          className={`border-admin-line-strong max-admin-md:border-r-0 flex min-h-0 flex-col border-r ${selectedThread ? "max-admin-md:hidden" : ""}`}
          aria-label="Conversations"
        >
          <div className="border-admin-line flex flex-col gap-3 border-b px-4 pt-3 pb-4">
            <Space className="w-full justify-between">
              <Typography.Text strong>
                Conversations{data ? ` (${data.total})` : ""}
              </Typography.Text>
              <Button
                type="text"
                aria-label="Refresh conversations"
                icon={<ArrowClockwiseIcon size={18} />}
                loading={isValidating}
                onClick={() => void mutate().catch(() => undefined)}
              />
            </Space>
            <Input.Search
              aria-label="Search conversations"
              placeholder="Search name or WhatsApp number"
              maxLength={120}
              allowClear
              onSearch={(value) => {
                setSearch(value.trim());
                setPage(1);
              }}
            />
            <Select
              aria-label="Filter conversation roles"
              value={role}
              style={{ width: "100%" }}
              options={[
                { label: "All roles", value: "all" },
                { label: "Customers", value: "customer" },
                { label: "Owners", value: "owner" },
                { label: "Technicians", value: "technician" },
              ]}
              onChange={(value: InboxRole) => {
                setRole(value);
                setPage(1);
              }}
            />
          </div>
          {error ? (
            <Alert
              type="error"
              showIcon
              title="Could not load conversations"
              action={
                <Button size="small" onClick={() => void mutate().catch(() => undefined)}>
                  Retry
                </Button>
              }
            />
          ) : null}
          <div className="admin-thread-list min-h-0 flex-1 overflow-y-auto">
            {isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : null}
            {!isLoading && !error && !data?.conversations.length ? (
              <Empty description="No matching conversations" />
            ) : null}
            {data?.conversations.map((thread) => (
              <button
                type="button"
                key={thread.waId}
                className={`focus-visible:outline-accent-strong flex w-full cursor-pointer items-start gap-3 border-0 border-b border-[#edf0f2] bg-white p-4 text-left text-inherit [font:inherit] hover:bg-[#f7f9f8] focus-visible:outline-2 focus-visible:outline-offset-[-2px] ${selected?.waId === thread.waId ? "bg-[#edf5ef] hover:bg-[#edf5ef]" : ""}`}
                aria-pressed={selected?.waId === thread.waId}
                onClick={() => setSelected(thread)}
              >
                <Avatar>{thread.name.slice(0, 1).toUpperCase()}</Avatar>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <strong className="[overflow-wrap:anywhere]">{thread.name}</strong>
                  <span className="text-admin-muted text-[11px]">+{thread.waId}</span>
                  <span>
                    <Roles roles={thread.roles} />
                  </span>
                  <span className="truncate text-[13px] text-[#58695e]">
                    {thread.direction === "outbound" ? "You: " : ""}
                    {thread.lastMessage}
                  </span>
                  <time className="text-admin-muted text-[11px]" dateTime={thread.lastMessageAt}>
                    {new Date(thread.lastMessageAt).toLocaleString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </span>
              </button>
            ))}
          </div>
          {data && data.total > data.pageSize ? (
            <Pagination
              className="border-admin-line border-t p-3.5"
              simple
              current={page}
              pageSize={data.pageSize}
              total={data.total}
              showSizeChanger={false}
              onChange={setPage}
            />
          ) : null}
        </aside>
        {selectedThread ? (
          <Conversation
            key={`${channel}:${selectedThread.waId}`}
            organizationId={organizationId}
            channel={channel}
            thread={selectedThread}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="text-admin-muted max-admin-md:hidden flex flex-col items-center justify-center bg-[#f7f9f8] p-[30px] text-center">
            <ChatCircleDotsIcon size={48} />
            <Typography.Title level={4}>Your WhatsApp conversations</Typography.Title>
            <Typography.Text type="secondary">
              Select a conversation to read its history.
            </Typography.Text>
          </div>
        )}
      </div>
    </>
  );
}
