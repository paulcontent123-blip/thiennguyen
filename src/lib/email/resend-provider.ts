import "server-only";

import {
  attachmentToBase64,
  assertEmailContent,
  EmailProvider,
  getDefaultFromAddress,
  getRecipients,
  readProviderError,
  type EmailMessage,
  type EmailSendResult,
} from "./provider";

type ResendResponse = { id?: string; message?: string };

export class ResendEmailProvider extends EmailProvider {
  readonly name = "resend";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    assertEmailContent(message);
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) throw new Error("Thiếu RESEND_API_KEY.");

    const attachments = message.attachments?.map((attachment) => ({
      filename: attachment.filename,
      content: attachmentToBase64(attachment),
      ...(attachment.contentId ? { content_id: attachment.contentId } : {}),
    }));

    const payload = {
      from: message.from || getDefaultFromAddress(),
      to: getRecipients(message.to),
      subject: message.subject,
      ...(message.html ? { html: message.html } : {}),
      ...(message.text ? { text: message.text } : {}),
      ...(attachments?.length ? { attachments } : {}),
      ...(message.headers ? { headers: message.headers } : {}),
    };

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(message.idempotencyKey ? { "Idempotency-Key": message.idempotencyKey } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(await readProviderError(response, "Resend"));
    const body = (await response.json()) as ResendResponse;
    return { provider: this.name, id: body.id ?? null };
  }
}
