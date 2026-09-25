import "server-only";

import { createHash } from "node:crypto";

export type ReceiptPdfInput = {
  txRef: string;
  donorName: string | null;
  receiptEmail: string;
  campaignTitle: string;
  ownerName: string;
  amountVnd: number;
  completedAt: string;
  paymentMethod: string;
};

function ascii(value: string) {
  return value
    .replace(/[đĐ]/g, (character) => character === "đ" ? "d" : "D")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "?");
}

function pdfText(value: string) {
  return ascii(value).replace(/([\\()])/g, "\\$1");
}

function money(value: number) {
  return `${new Intl.NumberFormat("vi-VN").format(value)} VND`;
}

/**
 * Creates a small deterministic PDF without a browser runtime. Standard PDF
 * fonts are used, so receipt text is transliterated to ASCII for portability.
 */
export function generateDonationReceiptPdf(input: ReceiptPdfInput) {
  const completed = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(input.completedAt));
  const lines = [
    [20, "THIEN NGUYEN - BIEN NHAN DIEN TU"],
    [11, `Ma giao dich: ${input.txRef}`],
    [11, `Ghi nhan luc: ${completed}`],
    [11, `Nguoi ung ho: ${input.donorName || "An danh"}`],
    [11, `Email: ${input.receiptEmail}`],
    [11, `Chien dich: ${input.campaignTitle}`],
    [11, `Don vi thu huong: ${input.ownerName}`],
    [11, `Phuong thuc: ${input.paymentMethod}`],
    [15, `SO TIEN DA GHI NHAN: ${money(input.amountVnd)}`],
    [9, `Xac thuc: https://thiennguyen.com.vn - ${input.txRef}`],
  ] as const;

  const content = [
    "BT",
    "/F1 20 Tf",
    "58 790 Td",
    ...lines.flatMap(([size, line], index) => [
      index === 0 ? "" : `0 -${index === 1 ? 46 : index === 8 ? 38 : 27} Td`,
      `/F1 ${size} Tf`,
      `(${pdfText(line)}) Tj`,
    ]).filter(Boolean),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
  ];

  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%THIENNGUYEN\n", "ascii")];
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(chunks.reduce((total, chunk) => total + chunk.length, 0));
    chunks.push(Buffer.from(`${index + 1} 0 obj\n${objects[index]}\nendobj\n`, "ascii"));
  }
  const xrefOffset = chunks.reduce((total, chunk) => total + chunk.length, 0);
  const xref = [
    `xref\n0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    `startxref\n${xrefOffset}`,
    "%%EOF",
  ].join("\n");
  chunks.push(Buffer.from(`${xref}\n`, "ascii"));
  return new Uint8Array(Buffer.concat(chunks));
}

export function sha256Hex(content: Uint8Array) {
  return createHash("sha256").update(content).digest("hex");
}
