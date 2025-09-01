import { Resend } from "resend";
import { Logger } from "@medusajs/framework/types";
import MinioFileProviderService from "../modules/minio-file/service";

type EmailOptions = {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
  }>;
};

export class EmailService {
  private resend: Resend;
  private logger: Logger;
  private from: string;
  private minio?: MinioFileProviderService;

  constructor(logger: Logger) {
    this.resend = new Resend(process.env.RESEND_API_KEY);
    this.logger = logger;
    this.from = process.env.RESEND_FROM_EMAIL!;
    
    // Initialize MinIO service if needed for attachments
    try {
      this.minio = new MinioFileProviderService(
        { logger },
        {
          endPoint: process.env.MINIO_ENDPOINT || "",
          accessKey: process.env.MINIO_ACCESS_KEY || "",
          secretKey: process.env.MINIO_SECRET_KEY || "",
          bucket: process.env.MINIO_BUCKET,
        }
      );
    } catch (error) {
      this.logger.warn("MinIO service not available for email attachments");
      this.minio = undefined;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const emailData: any = {
        from: this.from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      };

      // Add attachments if provided
      if (options.attachments && options.attachments.length > 0) {
        emailData.attachments = options.attachments;
      }

      const { data, error } = await this.resend.emails.send(emailData);

      if (error) {
        this.logger.error("Failed to send email via Resend:", error);
        return false;
      }

      this.logger.info(`Email sent successfully: ${data?.id}`);
      return true;
    } catch (error) {
      this.logger.error("Email service error:", error);
      return false;
    }
  }

  async sendOrderConfirmation(order: any, invoiceData?: any): Promise<boolean> {
    const html = this.getOrderConfirmationHtml(order);
    
    // Prepare email options
    const emailOptions: EmailOptions = {
      to: order.email,
      subject: "Order Confirmation - Warawul Coffee",
      html,
    };

    // Add invoice attachment if available
    if (invoiceData?.r2Key && this.minio) {
      try {
        const presignedUrl = await this.minio.getPresignedDownloadUrl({ fileKey: invoiceData.r2Key });
        const response = await fetch(presignedUrl);
        const invoicePdf = Buffer.from(await response.arrayBuffer());
        // Use branded filename with invoice number if available
        const invoiceNumber = invoiceData.invoiceNumber;
        const orderDisplayId = order.display_id || 'unknown';
        const filename = invoiceNumber 
          ? `Warawul Coffee Rechnung ${invoiceNumber}.pdf`
          : `Warawul Coffee Rechnung ${orderDisplayId}.pdf`;
          
        emailOptions.attachments = [
          {
            filename: filename,
            content: invoicePdf,
          },
        ];
        this.logger.info(`Invoice PDF attached to email for order ${order.id}`);
      } catch (error) {
        this.logger.error("Failed to attach invoice PDF to email", error);
        // Don't fail the email sending if attachment fails
      }
    }

    return this.sendEmail(emailOptions);
  }

  async sendOrderShipped(order: any, trackingInfo?: any): Promise<boolean> {
    const html = this.getOrderShippedHtml(order, trackingInfo);
    return this.sendEmail({
      to: order.email,
      subject: "Your Warawul Coffee Order Has Shipped! ✈️",
      html,
    });
  }

  async sendOrderDelivered(order: any): Promise<boolean> {
    const html = this.getOrderDeliveredHtml(order);
    return this.sendEmail({
      to: order.email,
      subject: "Your Warawul Coffee Order Has Been Delivered! ☕",
      html,
    });
  }

  private getOrderConfirmationHtml(order: any): string {
    // Extract customer name from various possible sources
    const customerName = this.getCustomerName(order);
    
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: white;">
        <div style="background: #8B4513; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">Warawul Coffee</h1>
        </div>
        <div style="padding: 20px;">
          <h2 style="color: #8B4513;">Thank you for your order!</h2>
          <p>Hi ${customerName},</p>
          <p>Your order <strong>#${order?.display_id || order?.id}</strong> has been received and is being processed.</p>
          
          <div style="border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #8B4513; margin-top: 0;">Order Details</h3>
            ${order?.items?.map((item: any) => `
              <div style="border-bottom: 1px solid #eee; padding: 10px 0; display: flex; justify-content: space-between;">
                <div>
                  <strong>${item.product_title}</strong>
                  ${item.variant_title ? `<br><small style="color: #666;">${item.variant_title}</small>` : ''}
                  <br><small>Qty: ${item.quantity}</small>
                </div>
                <div style="font-weight: bold;">
                  €${((item.total || 0) / 100).toFixed(2)}
                </div>
              </div>
            `).join('') || '<p>No items found</p>'}
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Subtotal:</span>
              <span>€${((order?.item_total || 0) / 100).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Shipping:</span>
              <span>€${((order?.shipping_total || 0) / 100).toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
              <span>Tax:</span>
              <span>€${((order?.tax_total || 0) / 100).toFixed(2)}</span>
            </div>
            <hr style="border: none; border-top: 2px solid #8B4513; margin: 15px 0;">
            <div style="display: flex; justify-content: space-between; font-size: 18px; font-weight: bold;">
              <span>Total:</span>
              <span style="color: #8B4513;">€${((order?.total || 0) / 100).toFixed(2)}</span>
            </div>
          </div>
          
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; border-left: 4px solid #28a745;">
            <p style="margin: 0; color: #155724;"><strong>What's next?</strong></p>
            <p style="margin: 5px 0 0 0; color: #155724;">We'll send you another email once your order ships with tracking information.</p>
          </div>
        </div>
        <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 12px; color: #666;">
          <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@warawulcoffee.com" style="color: #8B4513;">support@warawulcoffee.com</a></p>
          <p style="margin: 10px 0 0 0;">© ${new Date().getFullYear()} Warawul Coffee. All rights reserved.</p>
        </div>
      </div>
    `;
  }

  private getOrderShippedHtml(order: any, trackingInfo?: any): string {
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
          
          ${trackingInfo?.tracking_number ? `
            <div style="background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #2196f3;">
              <p style="margin: 0; color: #0d47a1;"><strong>📋 Tracking Information</strong></p>
              <p style="margin: 5px 0; color: #0d47a1;">Tracking Number: <strong>${trackingInfo.tracking_number}</strong></p>
              ${trackingInfo.tracking_url ? `
                <p style="margin: 10px 0 0 0;">
                  <a href="${trackingInfo.tracking_url}" style="background: #2196f3; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; display: inline-block;">
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
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.STOREFRONT_URL || 'https://warawulcoffee.com'}/products" 
               style="background: #8B4513; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Shop More Coffee
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
          
          <div style="background: #fff3e0; padding: 15px; border-radius: 8px; border-left: 4px solid #ff9800; margin: 20px 0;">
            <p style="margin: 0; color: #e65100;"><strong>📝 How was your experience?</strong></p>
            <p style="margin: 5px 0 0 0; color: #e65100;">We'd love to hear about your experience with our coffee and service. Your feedback helps us improve!</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.STOREFRONT_URL || 'https://warawulcoffee.com'}/products" 
               style="background: #8B4513; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold; margin-right: 10px;">
              Order Again
            </a>
            <a href="mailto:support@warawulcoffee.com?subject=Feedback for Order #${order?.display_id || order?.id}" 
               style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Leave Feedback
            </a>
          </div>
          
          <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; text-center; margin: 20px 0;">
            <p style="margin: 0; color: #6c757d;"><strong>Thank you for choosing Warawul Coffee!</strong></p>
            <p style="margin: 5px 0 0 0; color: #6c757d;">Follow us on social media for brewing tips, new arrivals, and special offers.</p>
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