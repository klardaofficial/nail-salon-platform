"use client";

import {
  ArrowClockwiseIcon,
  ChatCircleDotsIcon,
  PaperPlaneRightIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react";
import {
  Alert,
  App,
  Avatar,
  Button,
  Empty,
  Form,
  Input,
  Modal,
  Segmented,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import useSWR from "swr";
import useSWRMutation from "swr/mutation";

import {
  simulatorCustomerSchema,
  type SimulatorActorsResponse,
  type SimulatorChatMessage,
  type SimulatorCustomer,
  type SimulatorIdentity,
  type SimulatorMessagesResponse,
  type SimulatorSendInput,
} from "@/features/simulator/contracts";
import { apiMutation } from "@/lib/api/client";
import { apiKeys } from "@/lib/api/keys";
import { PageHeading } from "./page-heading";
import styles from "./simulator.module.css";

const customerStorageKey = "nail-salon.simulator.customers";
let fallbackCustomers = "[]";
function readCustomers() {
  try {
    return localStorage.getItem(customerStorageKey) ?? fallbackCustomers;
  } catch {
    return fallbackCustomers;
  }
}
function subscribeCustomers(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("simulator-customers", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("simulator-customers", callback);
  };
}
function saveCustomers(customers: SimulatorCustomer[]) {
  fallbackCustomers = JSON.stringify(customers);
  try {
    localStorage.setItem(customerStorageKey, fallbackCustomers);
  } catch {
    /* Keep windows in memory when storage is unavailable. */
  }
  window.dispatchEvent(new Event("simulator-customers"));
}
const serverCustomers = () => "[]";

function messageState(state: string) {
  const labels: Record<string, string> = {
    pending: "Queued",
    dispatched: "Queued",
    processing: "Processing",
    completed: "Processed",
    processed: "Processed",
    sending: "Sending",
    sent: "Sent",
    captured: "Simulated delivery",
    failed: "Failed · check Inngest",
  };
  return labels[state] ?? state;
}

function ChatWindow({ actor, onRemove }: { actor: SimulatorIdentity; onRemove?: () => void }) {
  const { data, error, isLoading, mutate } = useSWR<SimulatorMessagesResponse>(
    apiKeys.simulatorMessages(actor.waId),
    { refreshInterval: 2000 },
  );
  const { trigger, isMutating } = useSWRMutation(
    apiKeys.simulatorSend,
    apiMutation<{ providerEventId: string }, SimulatorSendInput>,
  );
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const pending = useRef<{ fingerprint: string; requestId: string } | null>(null);
  const inFlight = useRef(false);
  const transcript = useRef<HTMLDivElement>(null);
  const followingLatest = useRef(true);
  const messages = data?.messages;

  useEffect(() => {
    if (followingLatest.current && transcript.current)
      transcript.current.scrollTop = transcript.current.scrollHeight;
  }, [messages]);

  async function send(message: SimulatorSendInput["message"]) {
    if (inFlight.current) return;
    const identity: SimulatorSendInput["identity"] = actor.roles.length
      ? { kind: "staff", waId: actor.waId }
      : { kind: "customer", waId: actor.waId, name: actor.name };
    const fingerprint = JSON.stringify({ identity, message });
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, requestId: crypto.randomUUID() };
    inFlight.current = true;
    setSendError(null);
    try {
      await trigger({ body: { identity, message, requestId: pending.current.requestId } });
      pending.current = null;
      if (message.kind === "text")
        setDraft((current) => (current.trim() === message.text ? "" : current));
      followingLatest.current = true;
      void mutate().catch(() => undefined);
    } catch (failure) {
      setSendError(
        failure instanceof Error ? failure.message : "Message could not be sent. Try again.",
      );
    } finally {
      inFlight.current = false;
    }
  }

  function sendText() {
    if (draft.trim()) void send({ kind: "text", text: draft.trim() });
  }

  function renderMessage(message: SimulatorChatMessage) {
    const payload = message.payload;
    const interactive = payload?.kind === "buttons" || payload?.kind === "list" ? payload : null;
    const delivered = message.state === "captured" || message.state === "sent";
    return (
      <div
        key={message.id}
        className={`${styles.bubble} ${message.direction === "inbound" ? styles.fromActor : styles.fromBot}`}
      >
        <span className={styles.sender}>
          {message.direction === "inbound" ? actor.name : "Salon assistant"}
        </span>
        <div className={styles.messageText}>{message.text}</div>
        {interactive ? (
          <div className={styles.choices}>
            {interactive.kind === "list" ? (
              <span className={styles.sender}>
                {interactive.buttonLabel} · {interactive.sectionTitle}
              </span>
            ) : null}
            {interactive.options.map((option) => {
              const title = option.title.slice(0, interactive.kind === "buttons" ? 20 : 24);
              return (
                <Button
                  key={option.id}
                  block
                  size="small"
                  className={styles.choice}
                  disabled={isMutating || !delivered}
                  onClick={() =>
                    void send({
                      kind: "interactive",
                      replyType: interactive.kind === "buttons" ? "button_reply" : "list_reply",
                      id: option.id.slice(0, interactive.kind === "buttons" ? 256 : 200),
                      title,
                    })
                  }
                >
                  <span>
                    {title}
                    {option.description ? <small>{option.description.slice(0, 72)}</small> : null}
                  </span>
                </Button>
              );
            })}
          </div>
        ) : null}
        <div className={`${styles.messageMeta} ${message.state === "failed" ? styles.failed : ""}`}>
          <time dateTime={message.createdAt}>
            {new Date(message.createdAt).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
          <span>{messageState(message.state)}</span>
        </div>
      </div>
    );
  }

  return (
    <section className={styles.chat} aria-label={`Chat with ${actor.name}`}>
      <div className={styles.chatHeader}>
        <Avatar className={styles.avatar}>{actor.name.slice(0, 1).toUpperCase()}</Avatar>
        <div className={styles.identity}>
          <h2>{actor.name}</h2>
          <span className={styles.waId}>{actor.waId}</span>
        </div>
        {onRemove ? (
          <Button
            type="text"
            icon={<XIcon size={17} />}
            aria-label={`Remove customer ${actor.name}`}
            onClick={onRemove}
          />
        ) : null}
      </div>
      <div className={styles.roleLine}>
        {actor.roles.length ? (
          actor.roles.map((role) => (
            <Tag key={role} color={role === "owner" ? "purple" : "blue"}>
              {role === "owner" ? "Owner" : "Technician"}
            </Tag>
          ))
        ) : (
          <Tag>Customer</Tag>
        )}
        <span>{[...actor.businesses, ...actor.salons].join(" · ") || "Test customer"}</span>
      </div>
      {error ? (
        <Alert
          type="error"
          showIcon
          title="Could not load this conversation"
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
        aria-label={`Messages for ${actor.name}`}
        aria-live="polite"
        aria-relevant="additions text"
        onScroll={() => {
          const element = transcript.current;
          if (element)
            followingLatest.current =
              element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
      >
        {isLoading ? <Skeleton active paragraph={{ rows: 5 }} /> : null}
        {!isLoading && !error && !messages?.length ? (
          <div className={styles.emptyChat}>
            <ChatCircleDotsIcon size={32} />
            <p>Send a message to start this conversation.</p>
          </div>
        ) : null}
        {messages?.length === data?.limit ? (
          <p className={styles.historyNotice}>Showing the latest {data?.limit} messages.</p>
        ) : null}
        {messages?.map(renderMessage)}
      </div>
      <form
        className={styles.composer}
        onSubmit={(event) => {
          event.preventDefault();
          sendText();
        }}
      >
        {sendError ? <Alert type="error" showIcon title={sendError} /> : null}
        <label className={styles.composerLabel} htmlFor={`message-${actor.waId}`}>
          Message as {actor.name}
        </label>
        <Input.TextArea
          id={`message-${actor.waId}`}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={4096}
          autoSize={{ minRows: 2, maxRows: 5 }}
          placeholder="Type a message…"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              sendText();
            }
          }}
        />
        <div className={styles.composerFooter}>
          <span>Enter to send · Shift+Enter for a new line</span>
          <Button
            type="primary"
            htmlType="submit"
            icon={<PaperPlaneRightIcon size={16} />}
            loading={isMutating}
            disabled={!draft.trim()}
          >
            Send
          </Button>
        </div>
      </form>
    </section>
  );
}

export function SimulatorClient() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<SimulatorActorsResponse>(
    apiKeys.simulatorActors,
    { refreshInterval: 10000 },
  );
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState("All chats");
  const [form] = Form.useForm<SimulatorCustomer>();
  const { message } = App.useApp();
  const savedCustomers = useSyncExternalStore(subscribeCustomers, readCustomers, serverCustomers);
  const customers = useMemo(() => {
    try {
      const parsed = simulatorCustomerSchema.array().safeParse(JSON.parse(savedCustomers));
      return parsed.success ? parsed.data : [];
    } catch {
      return [];
    }
  }, [savedCustomers]);
  const staff = data?.actors ?? [];
  const actors: SimulatorIdentity[] = [
    ...customers
      .filter((customer) => !staff.some((actor) => actor.waId === customer.waId))
      .map((customer) => ({ ...customer, roles: [], businesses: [], salons: [] })),
    ...staff,
  ];
  const visible = actors.filter(
    (actor) =>
      filter === "All chats" ||
      (filter === "Customers"
        ? !actor.roles.length
        : actor.roles.includes(filter === "Owners" ? "owner" : "technician")),
  );

  function addCustomer(values: SimulatorCustomer) {
    const parsed = simulatorCustomerSchema.safeParse(values);
    if (!parsed.success) return;
    if (actors.some((actor) => actor.waId === parsed.data.waId)) {
      form.setFields([{ name: "waId", errors: ["A chat already exists for this WhatsApp ID."] }]);
      return;
    }
    saveCustomers([...customers, parsed.data]);
    setAdding(false);
    setFilter("All chats");
    form.resetFields();
  }

  return (
    <>
      <PageHeading
        title="WhatsApp simulator"
        description="Try customer, owner, and technician conversations side by side."
      />
      <Alert
        className={styles.notice}
        type="info"
        showIcon
        title="Simulated chats run alongside real WhatsApp"
        description="Replies and notifications from these chats stay in the simulator. Conversations use the configured database: bookings and business changes are real. Text and interactive replies are supported; image upload is unavailable."
      />
      {data && !data.aiConfigured ? (
        <Alert
          className={styles.notice}
          type="warning"
          showIcon
          title="OpenAI is not configured"
          description="Greetings and fallback replies work. Add OPENAI_API_KEY and restart or redeploy to test natural conversations and booking tools."
        />
      ) : null}
      <div className={styles.toolbar}>
        <Segmented
          aria-label="Filter chat windows"
          value={filter}
          onChange={(value) => setFilter(String(value))}
          options={["All chats", "Customers", "Owners", "Technicians"]}
        />
        <Space>
          <Button
            icon={<ArrowClockwiseIcon size={16} />}
            loading={isValidating}
            onClick={() => void mutate().catch(() => undefined)}
          >
            Refresh identities
          </Button>
          <Button
            type="primary"
            icon={<PlusIcon size={16} />}
            disabled={!data || Boolean(error)}
            onClick={() => setAdding(true)}
          >
            Add customer
          </Button>
        </Space>
      </div>
      <Typography.Paragraph type="secondary">
        {customers.length} customer windows ·{" "}
        {staff.filter((actor) => actor.roles.includes("owner")).length} owners ·{" "}
        {staff.filter((actor) => actor.roles.includes("technician")).length} technicians. Owners
        come from business owner mappings; technicians must be active. Customer windows are saved in
        this browser.
      </Typography.Paragraph>
      {error ? (
        <Alert
          type="error"
          showIcon
          title="Could not load simulator identities"
          description={error.message}
          action={<Button onClick={() => void mutate().catch(() => undefined)}>Retry</Button>}
        />
      ) : null}
      {isLoading ? <Skeleton active paragraph={{ rows: 6 }} /> : null}
      {!isLoading && !error && !visible.length ? (
        <Empty
          className={styles.empty}
          description={
            filter === "Owners" || filter === "Technicians"
              ? "No matching identities. Add owner mappings under Businesses or active records under Technicians, then refresh."
              : "No chat windows yet. Add a test customer, or configure owners and technicians in the dashboard."
          }
        />
      ) : null}
      {!error && data ? (
        <div className={styles.grid}>
          {visible.map((actor) => (
            <ChatWindow
              key={actor.waId}
              actor={actor}
              onRemove={
                actor.roles.length
                  ? undefined
                  : () => {
                      saveCustomers(customers.filter((customer) => customer.waId !== actor.waId));
                      message.info("Customer window removed. Conversation history is kept.");
                    }
              }
            />
          ))}
        </div>
      ) : null}
      <Modal
        title="Add test customer"
        open={adding}
        onCancel={() => {
          setAdding(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="Add customer"
        forceRender
      >
        <Form form={form} layout="vertical" onFinish={addCustomer}>
          <Form.Item
            name="name"
            label="Name"
            rules={[
              { required: true, whitespace: true, message: "Enter a customer name." },
              { max: 120 },
            ]}
          >
            <Input autoComplete="off" maxLength={120} />
          </Form.Item>
          <Form.Item
            name="waId"
            label="WhatsApp ID (wa_id)"
            extra="Include the country code. Use digits only, without + or spaces."
            rules={[
              { required: true, message: "Enter a WhatsApp ID." },
              { pattern: /^\d{5,32}$/, message: "Use 5–32 digits." },
            ]}
          >
            <Input
              autoComplete="off"
              inputMode="numeric"
              maxLength={32}
              placeholder="4915112345678"
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
