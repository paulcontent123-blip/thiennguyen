import "server-only";

import { ResendEmailProvider } from "./resend-provider";
import { SendGridEmailProvider } from "./sendgrid-provider";
import { EmailProvider, type EmailMessage, type EmailSendResult } from "./provider";

let provider: EmailProvider | null = null;

export function getEmailProvider(): EmailProvider {
  if (provider) return provider;

  const providerName = (process.env.EMAIL_PROVIDER || "resend").trim().toLowerCase();
  if (providerName === "resend") provider = new ResendEmailProvider();
  else if (providerName === "sendgrid") provider = new SendGridEmailProvider();
  else throw new Error(`EMAIL_PROVIDER không được hỗ trợ: ${providerName}`);

  return provider;
}

export function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  return getEmailProvider().send(message);
}

export { EmailProvider, type EmailAttachment, type EmailMessage, type EmailSendResult } from "./provider";
