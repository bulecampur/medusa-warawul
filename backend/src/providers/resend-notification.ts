import {
  AbstractNotificationProviderService,
  MedusaError,
} from "@medusajs/framework/utils";
import { Logger } from "@medusajs/framework/types";
import {
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types";
import { Resend, CreateEmailOptions } from "resend";
import { orderPlacedEmail } from "../modules/resend/emails/order-placed";
import { customerWelcomeEmail } from "../modules/resend/emails/customer-welcome";
import { passwordResetEmail } from "../modules/resend/emails/password-reset";
// import { orderShippedEmail } from "../modules/resend/emails/order-shipped";
// import { orderDeliveredEmail } from "../modules/resend/emails/order-delivered";
// import { orderReadyForPickupEmail } from "../modules/resend/emails/order-ready-pickup";
// import { customerSignupVerificationEmail } from "../modules/resend/emails/customer-signup-verification";
// import { customerPasswordResetEmail } from "../modules/resend/emails/customer-password-reset";
// import { adminSignupVerificationEmail } from "../modules/resend/emails/admin-signup-verification";
// import { adminPasswordResetEmail } from "../modules/resend/emails/admin-password-reset";
// import { refundInProcessEmail } from "../modules/resend/emails/refund-in-process";
// import { refundProcessedEmail } from "../modules/resend/emails/refund-processed";
// import R2Service from "../modules/r2/service";

type InjectedDependencies = {
  logger: Logger;
};

const templates: Record<string, string | ((data: any) => any)> = {
  "order.placed": orderPlacedEmail,
  "customer.created": customerWelcomeEmail,
  "customer.password_reset": passwordResetEmail,
  "order.shipped": `<h1>Order Shipped</h1><p>Your order has been shipped.</p>`,
  "order.delivered": `<h1>Order Delivered</h1><p>Your order has been delivered.</p>`,
  "order.ready_for_pickup": `<h1>Order Ready</h1><p>Your order is ready for pickup.</p>`,
  "order.canceled": `<h1>Order Canceled</h1><p>Your order has been canceled.</p>`,
  "customer.signup_verification": `<h1>Welcome!</h1><p>Please verify your account.</p>`,
  "admin.signup_verification": `<h1>Admin Access</h1><p>Please verify your admin account.</p>`,
  "admin.password_reset": `<h1>Admin Password Reset</h1><p>Reset your admin password.</p>`,
  "refund.in_process": `<h1>Refund Processing</h1><p>Your refund is being processed.</p>`,
  "refund.processed": `<h1>Refund Complete</h1><p>Your refund has been processed.</p>`,
};

type ResendOptions = {
  api_key: string;
  from: string;
  html_templates?: Record<
    string,
    {
      subject?: string;
      content: string;
    }
  >;
};

class ResendNotificationProviderService extends AbstractNotificationProviderService {
  static identifier = "resend";
  private resendClient: Resend;
  private options: ResendOptions;
  private logger: Logger;
  // private r2?: R2Service;
  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super();
    this.resendClient = new Resend(options.api_key);
    this.options = options;
    this.logger = logger;
    
    // Initialize R2 service if needed for attachments
    // try {
    //   this.r2 = new R2Service(
    //     { logger },
    //     {
    //       endpoint: process.env.S3_ENDPOINT || "",
    //       accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
    //       secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
    //       bucket: process.env.S3_BUCKET || "",
    //       region: process.env.S3_REGION || "auto",
    //       fileUrl: process.env.S3_FILE_URL,
    //     }
    //   );
    // } catch (error) {
    //   this.logger.warn("R2 service not available for email attachments");
    //   this.r2 = undefined;
    // }
  }
  static validateOptions(options: Record<any, any>) {
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
  getTemplate(template: string): string | ((data: any) => any) | null {
    if (this.options.html_templates?.[template]) {
      return this.options.html_templates[template].content;
    }

    if (templates[template]) {
      return templates[template];
    }

    return null;
  }

  getTemplateSubject(template: string) {
    if (this.options.html_templates?.[template]?.subject) {
      return this.options.html_templates[template].subject;
    }
    switch (template) {
      case "order.placed":
        return "Order Confirmation - Warawul Coffee";
      case "customer.created":
        return "Welcome to Warawul Coffee! ☕";
      case "customer.password_reset":
        return "Reset Your Warawul Coffee Password 🔐";
      case "order.shipped":
        return "Your Warawul Coffee Order Has Shipped! ✈️";
      case "order.delivered":
        return "Your Warawul Coffee Order Has Been Delivered! 🎉";
      case "order.ready_for_pickup":
        return "Your Warawul Coffee Order is Ready for Pickup! 📦";
      case "order.canceled":
        return "Order Canceled - Warawul Coffee";
      case "customer.signup_verification":
        return "Welcome to Warawul Coffee - Verify Your Account ☕";
      case "admin.signup_verification":
        return "Warawul Coffee Admin Access - Verify Your Account";
      case "admin.password_reset":
        return "Admin Password Reset - Warawul Coffee";
      case "refund.in_process":
        return "Your Warawul Coffee Refund is Being Processed 💳";
      case "refund.processed":
        return "Your Warawul Coffee Refund is Complete! ✅";
      default:
        return "Warawul Coffee - New Email";
    }
  }
  async send(
    notification: ProviderSendNotificationDTO
  ): Promise<ProviderSendNotificationResultsDTO> {
    const template = this.getTemplate(notification.template);

    if (!template) {
      this.logger.error(
        `Couldn't find an email template for ${notification.template}. The valid options are ${Object.keys(templates)}`
      );
      return {};
    }

    const commonOptions = {
      from: this.options.from,
      to: [notification.to],
      subject: this.getTemplateSubject(notification.template),
    };

    let emailOptions: CreateEmailOptions;
    if (typeof template === "string") {
      emailOptions = {
        ...commonOptions,
        html: template,
      };
    } else if (typeof template === "function") {
      emailOptions = {
        ...commonOptions,
        react: template(notification.data || {}),
      };
    } else {
      // Fallback to string template
      emailOptions = {
        ...commonOptions,
        html: String(template),
      };
    }

    // Add invoice attachment if available
    // if ((notification.data as any)?.invoiceData?.r2Key && this.r2) {
    //   try {
    //     const invoicePdf = await this.r2.downloadFile((notification.data as any).invoiceData.r2Key);
    //     // Use branded filename with invoice number if available
    //     const invoiceNumber = (notification.data as any)?.invoiceData?.invoiceNumber;
    //     const orderDisplayId = (notification.data as any).order?.display_id || 'unknown';
    //     const filename = invoiceNumber 
    //       ? `Warawul Coffee Rechnung ${invoiceNumber}.pdf`
    //       : `Warawul Coffee Rechnung ${orderDisplayId}.pdf`;
    //       
    //     emailOptions.attachments = [
    //       {
    //         filename: filename,
    //         content: invoicePdf,
    //       },
    //     ];
    //     this.logger.info(`Invoice PDF attached to email for order ${(notification.data as any).order?.id}`);
    //   } catch (error) {
    //     this.logger.error("Failed to attach invoice PDF to email", error);
    //     // Don't fail the email sending if attachment fails
    //   }
    // }

    const { data, error } = await this.resendClient.emails.send(emailOptions);

    if (error || !data) {
      if (error) {
        this.logger.error("Failed to send email", error);
      } else {
        this.logger.error("Failed to send email: unknown error");
      }
      return {};
    }

    return { id: data.id };
  }
}

export default ResendNotificationProviderService;