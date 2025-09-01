import { SubscriberArgs, type SubscriberConfig } from "@medusajs/medusa";
import { Modules } from "@medusajs/framework/utils";

export default async function resetPasswordTokenHandler({
  event: {
    data: { entity_id: email, token, actor_type },
  },
  container,
}: SubscriberArgs<{ entity_id: string; token: string; actor_type: string }>) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION);
  const config = container.resolve("configModule");

  let urlPrefix = "";

  if (actor_type === "customer") {
    urlPrefix = config.admin.storefrontUrl || "https://localhost:8000";
  } else {
    const backendUrl =
      config.admin.backendUrl !== "/"
        ? config.admin.backendUrl
        : "http://localhost:9000";
    const adminPath = config.admin.path || "/app";
    urlPrefix = `${backendUrl}${adminPath}`;
  }

  await notificationModuleService.createNotifications({
    to: email,
    channel: "email",
    template: "customer.password_reset",
    data: {
      customer: { email, first_name: "", last_name: "" }, // Minimal customer data
      reset_token: token,
      reset_url: `${urlPrefix}/account/reset-password?token=${token}&email=${email}`,
      storefront_url: actor_type === "customer" ? (config.admin.storefrontUrl || "https://warawul.coffee") : undefined,
      expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
    },
  });
}

export const config: SubscriberConfig = {
  event: "auth.password_reset",
};
