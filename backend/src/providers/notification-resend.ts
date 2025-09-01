import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils";
import { Logger } from "@medusajs/framework/types";
import {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types";
import { Resend } from "resend";

type InjectedDependencies = {
  logger: Logger;
};

type ResendOptions = {
  api_key: string;
  from: string;
};

export default class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "resend";
  
  private resendClient: Resend;
  private options: ResendOptions;
  private logger: Logger;

  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super();
    this.resendClient = new Resend(options.api_key);
    this.options = options;
    this.logger = logger;
  }

  static validateOptions(options: ResendOptions) {
    if (!options.api_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `api_key` is required in the provider's options."
      );
    }
    if (!options.from) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Option `from` is required in the provider's options."
      );
    }
  }

  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    
    this.logger.info(`Sending email via Resend to ${notification.to}`);

    try {
      const { data, error } = await this.resendClient.emails.send({
        from: this.options.from,
        to: [notification.to],
        subject: this.getSubject(notification.template),
        html: this.getHtml(notification),
      });

      if (error) {
        this.logger.error("Resend API error:", error);
        return {};
      }

      this.logger.info(`Email sent successfully: ${data?.id}`);
      return { id: data?.id };
    } catch (error) {
      this.logger.error("Failed to send email via Resend:", error);
      return {};
    }
  }

  private getSubject(template: string): string {
    const subjects: Record<string, string> = {
      "order.placed": "Order Confirmation - Warawul Coffee",
      "order.shipped": "Your Warawul Coffee Order Has Shipped! ✈️",
      "order.delivered": "Your Warawul Coffee Order Has Been Delivered! 🎉",
      "order.ready_for_pickup": "Your Warawul Coffee Order is Ready for Pickup! 📦",
      "customer.signup_verification": "Welcome to Warawul Coffee - Verify Your Account ☕",
      "customer.password_reset": "Reset Your Warawul Coffee Password 🔐",
      "admin.signup_verification": "Warawul Coffee Admin Access - Verify Your Account",
      "admin.password_reset": "Admin Password Reset - Warawul Coffee",
      "refund.in_process": "Your Warawul Coffee Refund is Being Processed 💳",
      "refund.processed": "Your Warawul Coffee Refund is Complete! ✅",
    };
    return subjects[template] || "Warawul Coffee - Notification";
  }

  private getHtml(notification: ProviderSendNotificationDTO): string {
    const data = notification.data as any;
    const order = data?.order;
    const fulfillment = data?.fulfillment;
    
    switch (notification.template) {
      case "order.placed":
        return this.getOrderPlacedHtml(order);
      case "order.shipped":
        return this.getOrderShippedHtml(order, fulfillment);
      case "order.delivered":
        return this.getOrderDeliveredHtml(order);
      case "order.ready_for_pickup":
        return this.getOrderReadyForPickupHtml(order);
      default:
        return `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #8B4513; color: white; padding: 20px; text-align: center;">
              <h1>Warawul Coffee</h1>
            </div>
            <div style="padding: 20px;">
              <h2>Notification</h2>
              <p>This is a notification from Warawul Coffee.</p>
              <p>Template: ${notification.template}</p>
            </div>
            <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
              © ${new Date().getFullYear()} Warawul Coffee. All rights reserved.
            </div>
          </div>
        `;
    }
  }

  private getOrderPlacedHtml(order: any): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #8B4513; color: white; padding: 20px; text-align: center;">
          <h1>Warawul Coffee</h1>
        </div>
        <div style="padding: 20px;">
          <h2>Thank you for your order!</h2>
          <p>Hi ${order?.customer?.first_name || 'Customer'},</p>
          <p>Your order #${order?.display_id} has been received and is being processed.</p>
          
          ${order?.items?.map((item: any) => `
            <div style="border-bottom: 1px solid #eee; padding: 10px 0;">
              <strong>${item.product_title}</strong> ${item.variant_title ? `(${item.variant_title})` : ''}
              <br>Qty: ${item.quantity}
            </div>
          `).join('') || ''}
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #8B4513;">
            <strong>Total: €${(order?.total / 100).toFixed(2) || '0.00'}</strong>
          </div>
        </div>
        <div style="background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          © ${new Date().getFullYear()} Warawul Coffee. All rights reserved.
        </div>
      </div>
    `;
  }

  private getOrderShippedHtml(order: any, fulfillment?: any): string {
    const customerName = this.getCustomerName(order);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: #8B4513; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Warawul Coffee</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #8B4513;">📦 Your order is on its way!</h2>
          <p>Hi ${customerName},</p>
          <p>Great news! Your order <strong>#${order?.display_id || order?.id}</strong> has been shipped and is on its way to you.</p>
          
          ${fulfillment?.tracking_number ? `
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
              <p style="margin: 0; color: #0d47a1;"><strong>📋 Tracking Information</strong></p>
              <p style="margin: 5px 0; color: #0d47a1;">Tracking Number: <strong>${fulfillment.tracking_number}</strong></p>
              ${fulfillment.tracking_url ? `
                <p style="margin: 10px 0 0 0;">
                  <a href="${fulfillment.tracking_url}" style="background: #2196f3; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">
                    Track Your Package
                  </a>
                </p>
              ` : ''}
            </div>
          ` : ''}
          
          <div style="background: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
            <p style="margin: 0; color: #e65100;"><strong>☕ Coffee Care Tip</strong></p>
            <p style="margin: 5px 0 0 0; color: #e65100;">For the best flavor, consume your coffee beans within 2-4 weeks of the roast date. Store in an airtight container away from light and heat.</p>
          </div>
        </div>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@warawulcoffee.com" style="color: #8B4513;">support@warawulcoffee.com</a></p>
          <p style="margin: 10px 0 0 0;">© ${new Date().getFullYear()} Warawul Coffee. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  private getOrderDeliveredHtml(order: any): string {
    const customerName = this.getCustomerName(order);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: #8B4513; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Warawul Coffee</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #8B4513;">🎉 Your order has been delivered!</h2>
          <p>Hi ${customerName},</p>
          <p>Great news! Your order <strong>#${order?.display_id || order?.id}</strong> has been successfully delivered.</p>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <p style="margin: 0; color: #155724;"><strong>☕ Time to brew the perfect cup!</strong></p>
            <p style="margin: 5px 0 0 0; color: #155724;">We hope you enjoy your fresh Warawul coffee. Don't forget to follow our brewing guide for the best taste experience.</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.STOREFRONT_URL || 'https://warawulcoffee.com'}/products" 
               style="background: #8B4513; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Order Again
            </a>
          </div>
        </div>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@warawulcoffee.com" style="color: #8B4513;">support@warawulcoffee.com</a></p>
          <p style="margin: 10px 0 0 0;">© ${new Date().getFullYear()} Warawul Coffee. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  private getOrderReadyForPickupHtml(order: any): string {
    const customerName = this.getCustomerName(order);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: #8B4513; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Warawul Coffee</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #8B4513;">📦 Your order is ready for pickup!</h2>
          <p>Hi ${customerName},</p>
          <p>Great news! Your order <strong>#${order?.display_id || order?.id}</strong> is ready for pickup at our location.</p>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745; margin: 20px 0;">
            <p style="margin: 0; color: #155724;"><strong>📍 Pickup Location</strong></p>
            <p style="margin: 5px 0 0 0; color: #155724;">Please bring a valid ID and your order number when picking up your coffee.</p>
          </div>
          
          <div style="background: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800;">
            <p style="margin: 0; color: #e65100;"><strong>⏰ Pickup Hours</strong></p>
            <p style="margin: 5px 0 0 0; color: #e65100;">We'll hold your order for 5 business days. After that, refunds will be processed automatically.</p>
          </div>
        </div>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@warawulcoffee.com" style="color: #8B4513;">support@warawulcoffee.com</a></p>
          <p style="margin: 10px 0 0 0;">© ${new Date().getFullYear()} Warawul Coffee. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  private getCustomerName(order: any): string {
    // Try multiple sources for customer name
    if (order?.customer?.first_name) {
      return order.customer.first_name;
    }
    if (order?.shipping_address?.first_name) {
      return order.shipping_address.first_name;
    }
    if (order?.billing_address?.first_name) {
      return order.billing_address.first_name;
    }
    if (order?.email) {
      // Extract name from email if available
      const emailPart = order.email.split('@')[0];
      return emailPart.charAt(0).toUpperCase() + emailPart.slice(1);
    }
    return 'Customer';
  }
}