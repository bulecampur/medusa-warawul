import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

export default async function customerCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve("logger")

  try {
    logger.info(`Processing customer created event for customer: ${data.id}`)

    // Get customer details using query.graph
    const query = container.resolve("query")
    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: [
        "id",
        "email", 
        "first_name",
        "last_name",
        "created_at"
      ],
      filters: { id: data.id },
    })

    if (!customer || !customer.email) {
      logger.error(`❌ Customer ${data.id} not found or missing email address`)
      return
    }

    logger.info(`Sending welcome email to customer: ${customer.email}`)

    // Send welcome email using the notification service
    const notificationModuleService = container.resolve("notification")
    const notificationResult = await notificationModuleService.createNotifications({
      to: customer.email,
      channel: "email",
      template: "customer.created",
      data: {
        customer: customer,
        storefront_url: process.env.STORE_URL || "https://warawul.coffee"
      },
    })

    logger.info(`✅ Welcome email sent successfully to customer ${customer.email}`)
  } catch (error) {
    logger.error("Failed to send welcome email:", error)
  }
}

export const config: SubscriberConfig = {
  event: "customer.created",
}