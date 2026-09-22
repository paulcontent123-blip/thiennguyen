import "server-only";

import {
  attachmentToBase64,
  assertEmailContent,
  EmailProvider,
  getDefaultFromAddress,
  getRecipients,
  parseFromAddress,
  readProviderError,
  type EmailMessage,
  type EmailSendResult,
} from "./provider";

export class SendGridEmailProvider extends EmailProvider {
  readonly name = "sendgrid";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    assertEmailContent(message);
    const apiKey = process.env.SENDGRID_API_KEY?.trim();
    if (!apiKey) throw new Error("Thiếu SENDGRID_API_KEY.");

    const content = [
      ...(message.text ? [{ type: "text/plain", value: message.text }] : []),
      ...(message.html ? [{ type: "text/html", value: message.html }] : []),
    ];
    const attachments = message.attachments?.map((attachment) => ({
      content: attachmentToBase64(attachment),
      type: attachment.contentType || "application/octet-stream",
      filename: attachment.filename,
      disposition: attachment.contentId ? "inline" : "attachment",
      ...(attachment.contentId ? { content_id: attachment.contentId } : {}),
    }));
    const from = parseFromAddress(message.from || process.env.SENDGRID_FROM_EMAIL?.trim() || getDefaultFromAddress());

    const payload = {
      personalizations: [{ to: getRecipients(message.to).map((email) => ({ email })) }],
      from,
      subject: message.subject,
      content,
      ...(attachments?.length ? { attachments } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
    };

    const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(await readProviderError(response, "SendGrid"));
    return { provider: this.name, id: response.headers.get("x-message-id") };
  }
}
