import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

export interface NotificationInput {
  to: string
  channel: string
  template: string
  data: any
}

export const sendNotificationStep = createStep(
  "send-notification",
  async (notifications: NotificationInput[], { container }): Promise<StepResponse<any[]>> => {
    const logger = container.resolve("logger")
    const notificationModuleService = container.resolve("notification")

    try {
      logger.info(`Sending ${notifications.length} notification(s)`)
      
      const results: any[] = []
      for (const notification of notifications) {
        logger.info(`Sending notification to ${notification.to} using template ${notification.template}`)
        logger.info(`Notification data structure: ${JSON.stringify({
          order: {
            id: notification.data.order?.id,
            email: notification.data.order?.email,
            customer_id: notification.data.order?.customer_id,
            customer: notification.data.order?.customer,
          },
          hasInvoiceData: !!notification.data.invoiceData,
          invoiceData: notification.data.invoiceData,
          fullDataKeys: Object.keys(notification.data)
        }, null, 2)}`)
        
        const result = await notificationModuleService.createNotifications({
          to: notification.to,
          channel: notification.channel,
          template: notification.template,
          data: notification.data,
        })
        
        results.push(result)
        logger.info(`✅ Notification sent successfully to ${notification.to}`)
      }

      return new StepResponse(results)
    } catch (error) {
      logger.error("Failed to send notifications:", error)
      throw error
    }
  }
)

export const createNotificationsStep = createStep(
  "create-notifications",
  async (notification: NotificationInput, { container }): Promise<StepResponse<any>> => {
    const logger = container.resolve("logger")
    const notificationModuleService = container.resolve("notification")

    try {
      logger.info(`Sending single notification to ${notification.to} using template ${notification.template}`)
      
      const result = await notificationModuleService.createNotifications({
        to: notification.to,
        channel: notification.channel,
        template: notification.template,
        data: notification.data,
      })
      
      logger.info(`✅ Notification sent successfully to ${notification.to}`)
      return new StepResponse(result)
    } catch (error) {
      logger.error("Failed to send notification:", error)
      throw error
    }
  }
)