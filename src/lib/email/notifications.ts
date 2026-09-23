import "server-only";

import { getEmailProvider, type EmailSendResult } from ".";

type CampaignUpdateEmailInput = {
  to: string;
  recipientName?: string;
  campaignId: string;
  campaignTitle: string;
  status: string;
  statusLabel: string;
  note?: string | null;
  campaignUrl?: string;
};

type DonationReceiptEmailInput = {
  to: string;
  donorName?: string;
  donationId: string;
  campaignTitle: string;
  amount: number;
  pdf: Uint8Array;
  filename?: string;
};

type DonationConfirmedEmailInput = {
  to: string;
  donorName?: string;
  txRef: string;
  campaignTitle: string;
  amount: number;
  campaignUrl?: string;
};

type RescueInvitationEmailInput = {
  to: string;
  recipientName: string;
  teamName: string;
  province: string;
  actionLink: string;
  invitationId: string;
  expiresAt: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[character] ?? character);
}

export function sendCampaignUpdateEmail(input: CampaignUpdateEmailInput): Promise<EmailSendResult> {
  const recipientName = input.recipientName ? escapeHtml(input.recipientName) : "bạn";
  const campaignTitle = escapeHtml(input.campaignTitle);
  const statusLabel = escapeHtml(input.statusLabel);
  const note = input.note ? escapeHtml(input.note) : "";
  const campaignUrl = input.campaignUrl ? escapeHtml(input.campaignUrl) : "";
  const urlText = input.campaignUrl ? ` Xem tại: ${input.campaignUrl}` : "";
  const urlHtml = input.campaignUrl ? `<p><a href="${campaignUrl}">Xem chiến dịch</a></p>` : "";

  return getEmailProvider().send({
    to: input.to,
    subject: `Cập nhật chiến dịch: ${input.campaignTitle}`,
    text: `Xin chào ${input.recipientName || "bạn"}, chiến dịch "${input.campaignTitle}" hiện có trạng thái: ${input.statusLabel}.${input.note ? ` Ghi chú: ${input.note}` : ""}${urlText}`,
    html: `<p>Xin chào ${recipientName},</p><p>Chiến dịch <strong>${campaignTitle}</strong> hiện có trạng thái: <strong>${statusLabel}</strong>.</p>${note ? `<p>Ghi chú: ${note}</p>` : ""}${urlHtml}`,
    idempotencyKey: `campaign-update:${input.campaignId}:${input.status}:${input.note || ""}`,
  });
}

export function sendDonationReceiptEmail(input: DonationReceiptEmailInput): Promise<EmailSendResult> {
  const donorName = input.donorName ? escapeHtml(input.donorName) : "bạn";
  const campaignTitle = escapeHtml(input.campaignTitle);
  const amount = new Intl.NumberFormat("vi-VN").format(input.amount);
  const filename = input.filename || `bien-nhan-${input.donationId}.pdf`;

  return getEmailProvider().send({
    to: input.to,
    subject: `Biên nhận ủng hộ chiến dịch ${input.campaignTitle}`,
    text: `Xin chào ${input.donorName || "bạn"}, cảm ơn bạn đã ủng hộ ${input.campaignTitle} với số tiền ${amount}đ. Biên nhận PDF được đính kèm email này.`,
    html: `<p>Xin chào ${donorName},</p><p>Cảm ơn bạn đã ủng hộ chiến dịch <strong>${campaignTitle}</strong> với số tiền <strong>${amount}đ</strong>.</p><p>Biên nhận PDF được đính kèm email này.</p>`,
    attachments: [{ filename, content: input.pdf, contentType: "application/pdf" }],
    idempotencyKey: `donation-receipt:${input.donationId}`,
  });
}

export function sendDonationConfirmedEmail(input: DonationConfirmedEmailInput): Promise<EmailSendResult> {
  const donorName = input.donorName ? escapeHtml(input.donorName) : "bạn";
  const campaignTitle = escapeHtml(input.campaignTitle);
  const amount = new Intl.NumberFormat("vi-VN").format(input.amount);
  const txRef = escapeHtml(input.txRef);
  const campaignUrl = input.campaignUrl ? escapeHtml(input.campaignUrl) : "";
  const urlHtml = input.campaignUrl ? `<p><a href="${campaignUrl}">Xem chiến dịch</a></p>` : "";

  return getEmailProvider().send({
    to: input.to,
    subject: `Đã xác nhận ủng hộ ${amount}đ — ${input.campaignTitle}`,
    text: `Xin chào ${input.donorName || "bạn"}, Admin đã đối soát và xác nhận giao dịch ${input.txRef} (${amount}đ) ủng hộ chiến dịch "${input.campaignTitle}" thành công. Cảm ơn tấm lòng của bạn!`,
    html: `<p>Xin chào ${donorName},</p><p>Admin đã đối soát và xác nhận giao dịch <strong>${txRef}</strong> (<strong>${amount}đ</strong>) ủng hộ chiến dịch <strong>${campaignTitle}</strong> thành công.</p><p>Cảm ơn tấm lòng của bạn!</p>${urlHtml}`,
    idempotencyKey: `donation-confirmed:${input.txRef}`,
  });
}

export function sendRescueInvitationEmail(input: RescueInvitationEmailInput): Promise<EmailSendResult> {
  const recipientName = escapeHtml(input.recipientName);
  const teamName = escapeHtml(input.teamName);
  const province = escapeHtml(input.province);
  const actionLink = escapeHtml(input.actionLink);
  const expiresAt = escapeHtml(input.expiresAt);

  return getEmailProvider().send({
    to: input.to,
    subject: `Lời mời tham gia đội cứu trợ Thiện Nguyện — ${input.teamName}`,
    text: [
      `Xin chào ${input.recipientName},`,
      `Admin đã tạo tài khoản đội cứu trợ "${input.teamName}" cho khu vực ${input.province}.`,
      "Bấm vào liên kết dưới đây để xác nhận lời mời và tự đặt mật khẩu:",
      input.actionLink,
      `Liên kết có hiệu lực đến ${input.expiresAt}.`,
      "Nếu bạn không mong đợi email này, hãy bỏ qua và liên hệ Admin Thiện Nguyện.",
    ].join("\n\n"),
    html: `<p>Xin chào <strong>${recipientName}</strong>,</p><p>Admin đã tạo tài khoản đội cứu trợ <strong>${teamName}</strong> cho khu vực <strong>${province}</strong>.</p><p><a href="${actionLink}">Xác nhận lời mời và đặt mật khẩu</a></p><p>Liên kết có hiệu lực đến ${expiresAt}.</p><p>Nếu bạn không mong đợi email này, hãy bỏ qua và liên hệ Admin Thiện Nguyện.</p>`,
    idempotencyKey: `rescue-invitation:${input.invitationId}`,
  });
}
