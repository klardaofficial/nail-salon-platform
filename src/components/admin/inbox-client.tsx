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
import { apiKeys } from "@/lib/api/keys";
import { ChatMessageBubble } from "./chat-message";
import { PageHeading } from "./page-heading";
import styles from "./inbox.module.css";

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
  channel,
  onBack,
}: {
  thread: InboxThread;
  channel: InboxChannel;
  onBack: () => void;
}) {
  const { data, error, isLoading, isValidating, size, setSize, mutate } =
    useSWRInfinite<InboxMessages>(
      (page: number, previous: InboxMessages | null) => {
        if (page && !previous?.nextCursor) return null;
        return apiKeys.inboxMessages(channel, thread.waId, previous?.nextCursor);
      },
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
    <section className={styles.conversation} aria-label={`Chat with ${thread.name}`}>
      <div className={styles.chatHeader}>
        <Button
          className={styles.back}
          type="text"
          icon={<ArrowLeftIcon size={18} />}
          aria-label="Back to conversations"
          onClick={onBack}
        />
        <Avatar>{thread.name.slice(0, 1).toUpperCase()}</Avatar>
        <div className={styles.identity}>
          <h2>{thread.name}</h2>
          <span>+{thread.waId}</span>
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
        className={styles.transcript}
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
            className={styles.older}
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
      <div className={styles.footer}>
        Stored message history · Times shown in your browser timezone · Refreshes every 10 seconds
      </div>
    </section>
  );
}

export function InboxClient() {
  const [channel, setChannel] = useState<InboxChannel>("whatsapp");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<InboxRole>("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<InboxThread | null>(null);
  const { data, error, isLoading, isValidating, mutate } = useSWR<InboxThreads>(
    apiKeys.inbox(channel, search, role, page),
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
      <div className={styles.toolbar}>
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
        <Typography.Text type="secondary">
          Browse stored conversations and staff notifications.
        </Typography.Text>
      </div>
      <div className={`${styles.inbox} ${selectedThread ? styles.hasSelection : ""}`}>
        <aside className={styles.sidebar} aria-label="Conversations">
          <div className={styles.filters}>
            <Space style={{ justifyContent: "space-between", width: "100%" }}>
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
          <div className={styles.threadList}>
            {isLoading ? <Skeleton active paragraph={{ rows: 8 }} /> : null}
            {!isLoading && !error && !data?.conversations.length ? (
              <Empty description="No matching conversations" />
            ) : null}
            {data?.conversations.map((thread) => (
              <button
                type="button"
                key={thread.waId}
                className={`${styles.thread} ${selected?.waId === thread.waId ? styles.selected : ""}`}
                aria-pressed={selected?.waId === thread.waId}
                onClick={() => setSelected(thread)}
              >
                <Avatar>{thread.name.slice(0, 1).toUpperCase()}</Avatar>
                <span className={styles.threadText}>
                  <strong>{thread.name}</strong>
                  <span className={styles.number}>+{thread.waId}</span>
                  <span>
                    <Roles roles={thread.roles} />
                  </span>
                  <span className={styles.preview}>
                    {thread.direction === "outbound" ? "You: " : ""}
                    {thread.lastMessage}
                  </span>
                  <time dateTime={thread.lastMessageAt}>
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
              className={styles.pagination}
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
            channel={channel}
            thread={selectedThread}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className={styles.placeholder}>
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
