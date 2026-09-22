import "server-only";

export type EmailAttachment = {
  filename: string;
  content: Uint8Array;
  contentType?: string;
  contentId?: string;
};

export type EmailMessage = {
  from?: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  idempotencyKey?: string;
};

export type EmailSendResult = {
  provider: string;
  id: string | null;
};

export abstract class EmailProvider {
  abstract readonly name: string;
  abstract send(message: EmailMessage): Promise<EmailSendResult>;
}

export function getDefaultFromAddress() {
  const from = process.env.EMAIL_FROM?.trim() || process.env.RESCUE_INVITATION_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error("Thiếu EMAIL_FROM để gửi email.");
  }
  return from;
}

export function getRecipients(to: EmailMessage["to"]) {
  const recipients = Array.isArray(to) ? to : [to];
  const normalized = recipients.map((email) => email.trim()).filter(Boolean);
  if (normalized.length === 0) throw new Error("Email phải có ít nhất một người nhận.");
  return normalized;
}

export function assertEmailContent(message: EmailMessage) {
  if (!message.subject.trim()) throw new Error("Email phải có subject.");
  if (!message.html?.trim() && !message.text?.trim()) {
    throw new Error("Email phải có nội dung HTML hoặc text.");
  }
}

export function attachmentToBase64(attachment: EmailAttachment) {
  return Buffer.from(attachment.content).toString("base64");
}

export function parseFromAddress(from: string) {
  const match = from.match(/^\s*(.*?)\s*<([^<>\s]+)>\s*$/);
  if (!match) return { email: from.trim() };
  return { name: match[1].trim() || undefined, email: match[2].trim() };
}

export async function readProviderError(response: Response, providerName: string) {
  const raw = await response.text();
  let message = raw;
  try {
    const body = JSON.parse(raw) as { message?: string; error?: string; errors?: Array<{ message?: string }> };
    message = body.message || body.error || body.errors?.map((item) => item.message).filter(Boolean).join(", ") || raw;
  } catch {
    // Giữ nguyên body text khi provider không trả JSON.
  }
  return `${providerName} không gửi được email (${response.status}): ${message || response.statusText}`;
}
