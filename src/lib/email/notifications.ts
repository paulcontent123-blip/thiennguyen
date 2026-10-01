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
  txRef: string;
  campaignTitle: string;
  amount: number;
  pdf: Uint8Array;
  sha256: string;
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
    text: `Xin chào ${input.donorName || "bạn"}, cảm ơn bạn đã ủng hộ ${input.campaignTitle} với số tiền ${amount}đ. Biên nhận PDF được đính kèm email này. Mã giao dịch: ${input.txRef}. SHA-256: ${input.sha256}.`,
    html: `<p>Xin chào ${donorName},</p><p>Cảm ơn bạn đã ủng hộ chiến dịch <strong>${campaignTitle}</strong> với số tiền <strong>${amount}đ</strong>.</p><p>Biên nhận PDF được đính kèm email này.</p><p>Mã giao dịch: <strong>${escapeHtml(input.txRef)}</strong><br/>SHA-256: <code>${escapeHtml(input.sha256)}</code></p>`,
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

type PendingPaymentKind = "donation" | "wallet_topup";

type DonorPendingPaymentEmailInput = {
  to: string;
  donorName?: string;
  kind: PendingPaymentKind;
  txRef: string;
  amountVnd: number;
  campaignTitle?: string | null;
  bankName: string;
  accountNo: string;
  accountName: string;
  transferDescription: string;
};

export function sendDonorPendingPaymentEmail(input: DonorPendingPaymentEmailInput): Promise<EmailSendResult> {
  const donorName = input.donorName ? escapeHtml(input.donorName) : "bạn";
  const amount = new Intl.NumberFormat("vi-VN").format(input.amountVnd);
  const txRef = escapeHtml(input.txRef);
  const purposeText = input.kind === "donation"
    ? `ủng hộ chiến dịch "${input.campaignTitle || ""}"`
    : "nạp tiền vào ví";
  const purposeHtml = input.kind === "donation"
    ? `ủng hộ chiến dịch "${escapeHtml(input.campaignTitle || "")}"`
    : "nạp tiền vào ví";

  return getEmailProvider().send({
    to: input.to,
    subject: `Đã ghi nhận yêu cầu chuyển khoản ${amount}đ — chờ Admin đối soát`,
    text: `Xin chào ${input.donorName || "bạn"}, hệ thống đã ghi nhận yêu cầu ${purposeText} với mã giao dịch ${input.txRef}, số tiền ${amount}đ, chuyển tới tài khoản ${input.accountName} (${input.bankName} - ${input.accountNo}), nội dung chuyển khoản "${input.transferDescription}". Tiền này đi thẳng vào tài khoản trung tâm, CHƯA được Admin đối soát và CHƯA được ghi nhận thành công. Bạn sẽ nhận thêm email khi Admin xác nhận đã khớp sao kê ngân hàng.`,
    html: `<p>Xin chào ${donorName},</p><p>Hệ thống đã ghi nhận yêu cầu ${purposeHtml} với mã giao dịch <strong>${txRef}</strong>, số tiền <strong>${amount}đ</strong>.</p><p>Chuyển tới tài khoản: <strong>${escapeHtml(input.accountName)}</strong> (${escapeHtml(input.bankName)} - ${escapeHtml(input.accountNo)})<br/>Nội dung chuyển khoản: <strong>${escapeHtml(input.transferDescription)}</strong></p><p><strong>Lưu ý:</strong> tiền đi thẳng vào tài khoản trung tâm, hiện <strong>chưa được Admin đối soát</strong> và chưa được ghi nhận thành công. Bạn sẽ nhận thêm email khi Admin xác nhận đã khớp sao kê ngân hàng.</p>`,
    idempotencyKey: `pending-payment-donor:${input.txRef}`,
  });
}

type AdminPendingPaymentEmailInput = {
  to: string;
  kind: PendingPaymentKind;
  txRef: string;
  amountVnd: number;
  donorName?: string | null;
  contactEmail: string;
  campaignTitle?: string | null;
  adminUrl: string;
};

export function sendAdminPendingPaymentEmail(input: AdminPendingPaymentEmailInput): Promise<EmailSendResult> {
  const amount = new Intl.NumberFormat("vi-VN").format(input.amountVnd);
  const kindLabel = input.kind === "donation" ? `Ủng hộ chiến dịch${input.campaignTitle ? ` "${input.campaignTitle}"` : ""}` : "Nạp ví";

  return getEmailProvider().send({
    to: input.to,
    subject: `[Chờ đối soát] ${kindLabel} — ${amount}đ — ${input.txRef}`,
    text: `Có giao dịch mới chờ đối soát. Loại: ${kindLabel}. Mã: ${input.txRef}. Số tiền: ${amount}đ. Người gửi: ${input.donorName || "Ẩn danh"} (${input.contactEmail}). Kiểm tra sao kê ngân hàng rồi xác nhận tại: ${input.adminUrl}`,
    html: `<p>Có giao dịch mới chờ đối soát.</p><ul><li><strong>Loại:</strong> ${escapeHtml(kindLabel)}</li><li><strong>Mã giao dịch:</strong> ${escapeHtml(input.txRef)}</li><li><strong>Số tiền:</strong> ${amount}đ</li><li><strong>Người gửi:</strong> ${escapeHtml(input.donorName || "Ẩn danh")} (${escapeHtml(input.contactEmail)})</li></ul><p><a href="${escapeHtml(input.adminUrl)}">Kiểm tra sao kê và xác nhận trong Admin Portal →</a></p>`,
    idempotencyKey: `pending-payment-admin:${input.txRef}`,
  });
}

type WalletTopupCompletedEmailInput = {
  to: string;
  donorName?: string | null;
  txRef: string;
  amountVnd: number;
  balanceAfterVnd?: number;
  viaGateway?: boolean;
};

export function sendWalletTopupCompletedEmail(input: WalletTopupCompletedEmailInput): Promise<EmailSendResult> {
  const donorName = input.donorName ? escapeHtml(input.donorName) : "bạn";
  const amount = new Intl.NumberFormat("vi-VN").format(input.amountVnd);
  const txRef = escapeHtml(input.txRef);
  const balanceText = typeof input.balanceAfterVnd === "number" ? ` Số dư ví hiện tại: ${new Intl.NumberFormat("vi-VN").format(input.balanceAfterVnd)}đ.` : "";
  const confirmedBy = input.viaGateway ? "VNPAY đã xác nhận thanh toán tự động" : "Admin đã đối soát và xác nhận";

  return getEmailProvider().send({
    to: input.to,
    subject: `Đã cộng ${amount}đ vào ví — ${input.txRef}`,
    text: `Xin chào ${input.donorName || "bạn"}, ${confirmedBy} giao dịch nạp ví ${input.txRef} với số tiền ${amount}đ. Số dư đã được cộng vào ví của bạn.${balanceText}`,
    html: `<p>Xin chào ${donorName},</p><p>${confirmedBy} giao dịch nạp ví <strong>${txRef}</strong> với số tiền <strong>${amount}đ</strong>. Số dư đã được cộng vào ví của bạn.</p>${balanceText ? `<p>${balanceText}</p>` : ""}`,
    idempotencyKey: `wallet-topup-completed:${input.txRef}`,
  });
}

type CorporateInquiryEmailInput = {
  to: string;
  inquiryId: string;
  companyName: string;
  contactName: string;
  contactEmail: string;
  budgetLabel: string;
  focusArea?: string | null;
  interestLabel: string;
  campaignTitle?: string | null;
};

export function sendCorporateInquiryNotification(input: CorporateInquiryEmailInput): Promise<EmailSendResult> {
  const rows: [string, string][] = [
    ["Doanh nghiệp", input.companyName],
    ["Người liên hệ", `${input.contactName} <${input.contactEmail}>`],
    ["Hình thức quan tâm", input.interestLabel],
    ["Ngân sách CSR/năm", input.budgetLabel],
    ["Lĩnh vực ưu tiên", input.focusArea || "—"],
    ["Chiến dịch", input.campaignTitle || "—"],
  ];

  return getEmailProvider().send({
    to: input.to,
    subject: `Yêu cầu đồng hành mới: ${input.companyName}`,
    text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
    html: `<p>Có yêu cầu đồng hành mới từ trang Doanh nghiệp:</p><ul>${rows.map(([label, value]) => `<li><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</li>`).join("")}</ul>`,
    idempotencyKey: `corporate-inquiry:${input.inquiryId}`,
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
