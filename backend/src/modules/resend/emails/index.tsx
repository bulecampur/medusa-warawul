import { ReactNode } from "react";
import { MedusaError } from "@medusajs/framework/utils";
import { InviteUserEmail, INVITE_USER, isInviteUserData } from "./invite-user";
import { orderPlacedEmail, ORDER_PLACED } from "./order-placed";
import { customerWelcomeEmail, CUSTOMER_WELCOME } from "./customer-welcome";
import { passwordResetEmail, PASSWORD_RESET } from "./password-reset";

export const EmailTemplates = {
  INVITE_USER,
  ORDER_PLACED,
  CUSTOMER_WELCOME,
  PASSWORD_RESET,
} as const;

export type EmailTemplateType = keyof typeof EmailTemplates;

export function generateEmailTemplate(
  templateKey: string,
  data: unknown
): ReactNode {
  switch (templateKey) {
    case EmailTemplates.INVITE_USER:
      if (!isInviteUserData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.INVITE_USER}"`
        );
      }
      return <InviteUserEmail {...data} />;

    case EmailTemplates.ORDER_PLACED:
      return orderPlacedEmail(data as any);

    case EmailTemplates.CUSTOMER_WELCOME:
      return customerWelcomeEmail(data as any);

    case EmailTemplates.PASSWORD_RESET:
      return passwordResetEmail(data as any);

    default:
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown template key: "${templateKey}"`
      );
  }
}

export { InviteUserEmail, orderPlacedEmail, customerWelcomeEmail, passwordResetEmail };
