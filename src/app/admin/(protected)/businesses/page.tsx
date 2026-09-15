import { ResourceManager } from "@/components/admin/resource-manager";
import { getServerEnv } from "@/lib/config/env";

export default function BusinessesPage() {
  const webhookUrl = new URL("/api/whatsapp/webhook", getServerEnv().APP_URL).toString();
  return <ResourceManager resource="businesses" webhookUrl={webhookUrl} />;
}
