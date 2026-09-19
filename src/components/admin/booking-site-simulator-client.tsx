"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { Alert, Button, Card, DatePicker, Form, Input, Select, Skeleton, Typography } from "antd";
import { formatInTimeZone } from "date-fns-tz";
import dayjs, { type Dayjs } from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import {
  buildBookingIntentPreviewUrl,
  catalogSum,
  formatCatalogDuration,
  formatCatalogPrice,
  isOutsideOpenHours,
  resolveStartsAtIssue,
  servicesForSalon,
  techniciansForSalon,
} from "@/features/booking-intents/booking-site-simulator";
import type { PublicCatalog } from "@/features/organizations/contracts";
import { ApiClientError, apiErrorMessage, apiGet } from "@/lib/api/client";
import { apiKeys } from "@/lib/api/keys";

dayjs.extend(customParseFormat);

const MINUTE_STEPS = [5, 10, 15, 20, 30] as const;

type FormValues = {
  salonId?: string;
  serviceIds?: string[];
  technicianRef?: string;
  startsAt?: Dayjs;
  additionalRequest?: string;
};

type OrganizationProviderReadiness = { provider: { readiness: string } };

export function BookingSiteSimulatorClient({ organizationId }: { organizationId: string }) {
  const {
    data: catalog,
    error,
    isLoading,
    isValidating,
    mutate,
  } = useSWR<PublicCatalog>(apiKeys.publicCatalog(organizationId), apiGet);
  const { data: settings } = useSWR<OrganizationProviderReadiness>(
    apiKeys.organizationSettings(organizationId),
    apiGet,
  );
  const [form] = Form.useForm<FormValues>();
  // Lazy initializers, not an effect: the whole admin dashboard renders only
  // after AdminClientBoundary confirms we're on the client
  // (src/components/admin/admin-client-boundary.tsx), so this component never
  // takes part in SSR or hydration -- reading these here cannot mismatch.
  const [now, setNow] = useState(() => Date.now());
  const [browserTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [browserOrigin] = useState(() => window.location.origin);

  // The interval is the only part that needs an effect: it subscribes to an
  // external clock and calls setState from its callback when time moves on,
  // rather than synchronously within the effect body.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const watchedSalonId = Form.useWatch<string | undefined>("salonId", form);
  const watchedServiceIds = Form.useWatch<string[] | undefined>("serviceIds", form) ?? [];
  const watchedTechnicianRef = Form.useWatch<string | undefined>("technicianRef", form);
  const watchedStartsAt = Form.useWatch<Dayjs | undefined>("startsAt", form);
  const watchedAdditionalRequest = Form.useWatch<string | undefined>("additionalRequest", form);

  const effectiveSalonId = catalog
    ? catalog.salonSelection === "required"
      ? (watchedSalonId ?? null)
      : (catalog.salons[0]?.id ?? null)
    : null;

  const availableServices = useMemo(
    () => (catalog ? servicesForSalon(catalog.services, effectiveSalonId) : []),
    [catalog, effectiveSalonId],
  );
  const availableTechnicians = useMemo(
    () => (catalog ? techniciansForSalon(catalog.technicians, effectiveSalonId) : []),
    [catalog, effectiveSalonId],
  );

  // Cascade-clear now-invalid selections when the salon changes -- otherwise a
  // stale id is silently dropped server-side and the admin never learns why.
  useEffect(() => {
    if (!catalog) return;
    const allowedServiceIds = new Set(availableServices.map((service) => service.id));
    const selectedServiceIds: string[] = form.getFieldValue("serviceIds") ?? [];
    const keptServiceIds = selectedServiceIds.filter((id) => allowedServiceIds.has(id));
    if (keptServiceIds.length !== selectedServiceIds.length) {
      form.setFieldValue("serviceIds", keptServiceIds);
    }
    const technicianRef: string | undefined = form.getFieldValue("technicianRef");
    if (
      technicianRef &&
      !availableTechnicians.some((technician) => technician.id === technicianRef)
    ) {
      form.setFieldValue("technicianRef", undefined);
    }
  }, [catalog, availableServices, availableTechnicians, form]);

  if (isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;

  if (error) {
    const notAvailable =
      error instanceof ApiClientError && error.code === "organization_not_available";
    return (
      <Alert
        type="error"
        showIcon
        title={
          notAvailable ? "This organization is not available" : "Could not load the public catalog"
        }
        description={
          notAvailable
            ? "The catalog endpoint returns this for an unknown, malformed, or archived organization ID -- a setup problem, not something to retry."
            : apiErrorMessage(error)
        }
        action={
          notAvailable ? undefined : (
            <Button onClick={() => void mutate().catch(() => undefined)}>Retry</Button>
          )
        }
      />
    );
  }

  if (!catalog) return null;

  const minuteStep = MINUTE_STEPS.find((step) => step === catalog.bookingIntervalMinutes) ?? 5;
  const catalogEmpty =
    !catalog.salons.length && !catalog.services.length && !catalog.technicians.length;

  const wallClock = watchedStartsAt ? watchedStartsAt.format("YYYY-MM-DDTHH:mm") : null;
  const startsAtIssue = resolveStartsAtIssue(
    wallClock,
    catalog.bookingTimezone,
    catalog.rules.minLeadTimeMinutes,
    now,
  );
  const previewUrl =
    startsAtIssue === null && wallClock
      ? buildBookingIntentPreviewUrl(catalog.bookingUrl, {
          startsAt: wallClock,
          salonId: catalog.salonSelection === "required" ? (watchedSalonId ?? null) : null,
          serviceIds: watchedServiceIds,
          technicianRef: watchedTechnicianRef ?? null,
          additionalRequest: watchedAdditionalRequest ?? null,
        })
      : null;

  const selectedServices = catalog.services.filter((service) =>
    watchedServiceIds.includes(service.id),
  );
  const priceTotal = catalogSum(selectedServices.map((service) => service.price));
  const durationTotal = catalogSum(selectedServices.map((service) => service.durationMinutes));

  const bookingUrlOrigin = (() => {
    try {
      return new URL(catalog.bookingUrl).origin;
    } catch {
      return null;
    }
  })();
  const originMismatch = Boolean(bookingUrlOrigin && bookingUrlOrigin !== browserOrigin);
  const readiness = settings?.provider.readiness;

  return (
    <>
      <Alert
        className="mb-4"
        type="info"
        showIcon
        title="This tab reads the public catalog directly from the browser"
        description="Deliberately, not through an admin API -- this is the same GET /api/public/{organizationId}/catalog request an external booking website makes. See docs/integrations/external-booking-website.md."
      />
      {catalogEmpty ? (
        <Alert
          className="mb-4"
          type="info"
          showIcon
          title="Nothing to pick yet"
          description="This organization has no active salons, services, or technicians. Only the appointment time is required -- the generated URL still works."
        />
      ) : null}
      <div className="mb-4 flex justify-end">
        <Button
          icon={<ArrowClockwiseIcon size={16} />}
          loading={isValidating}
          onClick={() => void mutate().catch(() => undefined)}
        >
          Refresh catalog
        </Button>
      </div>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,360px),1fr))] items-start gap-5">
        <Card title="Customer selections">
          <Form form={form} layout="vertical">
            {catalog.salonSelection === "required" ? (
              <Form.Item
                name="salonId"
                label="Salon"
                rules={[{ required: true, message: "Choose a salon." }]}
              >
                <Select
                  aria-label="Salon"
                  showSearch={{ optionFilterProp: "label" }}
                  style={{ width: "100%" }}
                  options={catalog.salons.map((salon) => ({
                    value: salon.id,
                    label: `${salon.name} — ${salon.locationLabel}`,
                  }))}
                />
              </Form.Item>
            ) : (
              <Typography.Paragraph type="secondary">
                {catalog.salonSelection === "none"
                  ? "No active salon — salonId is omitted from the URL."
                  : `One active salon (${catalog.salons[0]?.name}) — chosen automatically, salonId is omitted from the URL.`}
              </Typography.Paragraph>
            )}
            <Form.Item
              name="serviceIds"
              label="Services"
              extra={`Optional. Up to ${catalog.rules.maxServiceIds}.`}
            >
              <Select
                aria-label="Services"
                mode="multiple"
                maxCount={catalog.rules.maxServiceIds}
                showSearch={{ optionFilterProp: "label" }}
                style={{ width: "100%" }}
                disabled={!availableServices.length}
                notFoundContent="No active services"
                options={availableServices.map((service) => ({
                  value: service.id,
                  label: service.name,
                }))}
              />
            </Form.Item>
            {effectiveSalonId ? (
              <Form.Item name="technicianRef" label="Technician" extra="Optional.">
                <Select
                  aria-label="Technician"
                  allowClear
                  style={{ width: "100%" }}
                  disabled={!availableTechnicians.length}
                  notFoundContent="No active technicians"
                  options={availableTechnicians.map((technician) => ({
                    value: technician.id,
                    label: technician.displayName,
                  }))}
                />
              </Form.Item>
            ) : null}
            <Form.Item
              name="startsAt"
              label="Appointment time"
              required
              extra={
                <>
                  Now in {catalog.bookingTimezone}:{" "}
                  {formatInTimeZone(now, catalog.bookingTimezone, "yyyy-MM-dd HH:mm")}
                  {browserTimezone !== catalog.bookingTimezone
                    ? ` · your browser (${browserTimezone}): ${formatInTimeZone(now, browserTimezone, "yyyy-MM-dd HH:mm")}`
                    : ""}
                  . A time inside a spring-forward DST gap is silently shifted, not rejected.
                </>
              }
              rules={[
                {
                  validator: async (_, value: Dayjs | undefined) => {
                    const issue = resolveStartsAtIssue(
                      value ? value.format("YYYY-MM-DDTHH:mm") : null,
                      catalog.bookingTimezone,
                      catalog.rules.minLeadTimeMinutes,
                      now,
                    );
                    if (issue === "missing")
                      return Promise.reject(new Error("Pick an appointment time."));
                    if (issue === "too_soon")
                      return Promise.reject(
                        new Error(
                          `Must be at least ${catalog.rules.minLeadTimeMinutes} minutes from now.`,
                        ),
                      );
                    if (issue === "unparseable")
                      return Promise.reject(new Error("Pick a valid date and time."));
                    return Promise.resolve();
                  },
                },
                {
                  warningOnly: true,
                  validator: async (_, value: Dayjs | undefined) => {
                    if (!value) return Promise.resolve();
                    return isOutsideOpenHours(
                      value.format("HH:mm"),
                      catalog.openTime,
                      catalog.closeTime,
                    )
                      ? Promise.reject(
                          new Error(
                            `Outside default hours ${catalog.openTime}–${catalog.closeTime}. The server accepts it anyway -- open hours are advisory only.`,
                          ),
                        )
                      : Promise.resolve();
                  },
                },
              ]}
            >
              <DatePicker
                aria-label="Appointment time"
                showTime={{ format: "HH:mm", minuteStep }}
                format="YYYY-MM-DD HH:mm"
                showNow={false}
                style={{ width: "100%" }}
              />
            </Form.Item>
            <Button
              size="small"
              className="mb-4"
              onClick={() => {
                const wallClockNow = formatInTimeZone(
                  now + 3_600_000,
                  catalog.bookingTimezone,
                  "yyyy-MM-dd'T'HH:mm",
                );
                form.setFieldValue("startsAt", dayjs(wallClockNow, "YYYY-MM-DDTHH:mm", true));
              }}
            >
              Fill 1 hour from now
            </Button>
            <Form.Item name="additionalRequest" label="Additional request" extra="Optional.">
              <Input.TextArea
                showCount
                maxLength={catalog.rules.maxAdditionalRequestLength}
                autoSize={{ minRows: 2, maxRows: 5 }}
              />
            </Form.Item>
          </Form>
        </Card>
        <div className="flex flex-col gap-5">
          <Card title="Selected services">
            {selectedServices.length ? (
              <>
                <ul className="m-0 list-none p-0">
                  {selectedServices.map((service) => (
                    <li
                      key={service.id}
                      className="border-admin-line flex items-center justify-between gap-3 border-b border-dashed py-1.5 last:border-0"
                    >
                      <span>{service.name}</span>
                      <span className="text-admin-muted text-sm">
                        {formatCatalogPrice(service.price, catalog.currency) ?? "Not set"} ·{" "}
                        {formatCatalogDuration(service.durationMinutes) ?? "Not set"}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 text-sm">
                  {priceTotal.total !== null ? (
                    <div>Total: {formatCatalogPrice(priceTotal.total, catalog.currency)}</div>
                  ) : (
                    <div className="text-admin-muted">
                      Total unavailable — {priceTotal.missing} of {selectedServices.length} services
                      have no price set.
                    </div>
                  )}
                  {durationTotal.total !== null ? (
                    <div>Total listed duration: {formatCatalogDuration(durationTotal.total)}</div>
                  ) : (
                    <div className="text-admin-muted">
                      Total listed duration unavailable — {durationTotal.missing} of{" "}
                      {selectedServices.length} services have no duration set.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <Typography.Text type="secondary">No services selected.</Typography.Text>
            )}
          </Card>
          <Card title="Hand-off URL">
            <Alert
              className="mb-3"
              type="warning"
              showIcon
              title="Opening this URL has real side effects"
              description="It inserts a booking_intents row and may spend an OpenAI call to author the prefilled message (capped at 20 AI-authored intents per hour per organization, then a deterministic template). Identical selections within 4 hours reuse the same intent. A redirect to WhatsApp means handed off, not validated -- a rejected id or a past time still redirects with a plain 👋."
            />
            {readiness && readiness !== "enabled" ? (
              <Alert
                className="mb-3"
                type="warning"
                showIcon
                title="This URL will return JSON, not a redirect"
                description='WhatsApp Account readiness must be "enabled" before the booking-intent endpoint redirects to WhatsApp. Right now it answers 404 booking_intent_unavailable.'
              />
            ) : null}
            {originMismatch ? (
              <Alert
                className="mb-3"
                type="warning"
                showIcon
                title="This URL points at a different environment"
                description={`bookingUrl points at ${bookingUrlOrigin}, not this dashboard's origin (${browserOrigin}). Opening it creates the booking intent in that environment.`}
              />
            ) : null}
            {previewUrl ? (
              <>
                <Typography.Text
                  code
                  copyable={{ text: previewUrl }}
                  className="[overflow-wrap:anywhere]"
                >
                  {previewUrl}
                </Typography.Text>
                <div className="mt-3">
                  <Button
                    type="primary"
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open hand-off URL
                  </Button>
                </div>
              </>
            ) : (
              <Typography.Text type="secondary">
                Pick a valid appointment time to generate the URL.
              </Typography.Text>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
