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
import React from "react";
import { orderPlacedEmail } from "./emails/order-placed";
import { InviteUserEmail } from "./emails/invite-user";
import { passwordResetEmail } from "./emails/password-reset";

import MinioService from "../minio/service";

type InjectedDependencies = {
  logger: Logger;
};

enum Templates {
  ORDER_PLACED = "order.placed",
  INVITE_USER = "invite.user",
  PASSWORD_RESET = "customer.password_reset",
}

const templates: { [key in Templates]?: (props: unknown) => React.ReactNode } =
  {
    [Templates.ORDER_PLACED]: orderPlacedEmail,
    [Templates.INVITE_USER]: InviteUserEmail,
    [Templates.PASSWORD_RESET]: passwordResetEmail,
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
  private minio?: MinioService;

  constructor({ logger }: InjectedDependencies, options: ResendOptions) {
    super();
    this.resendClient = new Resend(options.api_key);
    this.options = options;
    this.logger = logger;

    // Initialize Minio service if needed for attachments
    try {
      this.minio = new MinioService(
        { logger },
        {
          endpoint: process.env.MINIO_ENDPOINT || "",
          accessKeyId: process.env.MINIO_ACCESS_KEY || "",
          secretAccessKey: process.env.MINIO_SECRET_KEY || "",
          bucket: process.env.MINIO_BUCKET,
        }
      );
    } catch (error) {
      this.logger.warn("Minio service not available for email attachments");
      this.minio = undefined;
    }
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

  getTemplate(template: string) {
    if (this.options.html_templates?.[template]) {
      return this.options.html_templates[template].content;
    }
    const allowedTemplates = Object.values(Templates);

    if (!allowedTemplates.includes(template as Templates)) {
      return null;
    }

    return templates[template as Templates];
  }

  getTemplateSubject(template: string) {
    if (this.options.html_templates?.[template]?.subject) {
      return this.options.html_templates[template].subject;
    }
    switch (template as Templates) {
      case Templates.ORDER_PLACED:
        return "Order Confirmation - Warawul Coffee";
      case Templates.PASSWORD_RESET:
        return "Reset Your Password - Warawul Coffee";
      case Templates.INVITE_USER:
        return "You've been invited - Warawul Coffee";

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
        `Couldn't find an email template for ${
          notification.template
        }. The valid options are ${Object.values(Templates)}`
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
    } else {
      emailOptions = {
        ...commonOptions,
        react: template(notification.data),
      };
    }

    // Add invoice attachment if available
    if ((notification.data as any)?.invoiceData?.r2Key && this.minio) {
      try {
        const invoicePdf = await this.minio.downloadFile(
          (notification.data as any).invoiceData.r2Key
        );
        // Use branded filename with invoice number if available
        const invoiceNumber = (notification.data as any)?.invoiceData
          ?.invoiceNumber;
        const orderDisplayId =
          (notification.data as any).order?.display_id || "unknown";
        const filename = invoiceNumber
          ? `Warawul Coffee Rechnung ${invoiceNumber}.pdf`
          : `Warawul Coffee Rechnung ${orderDisplayId}.pdf`;

        emailOptions.attachments = [
          {
            filename: filename,
            content: invoicePdf,
          },
        ];
        this.logger.info(
          `Invoice PDF attached to email for order ${
            (notification.data as any).order?.id
          }`
        );
      } catch (error) {
        this.logger.error("Failed to attach invoice PDF to email", error);
        // Don't fail the email sending if attachment fails
      }
    }

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
