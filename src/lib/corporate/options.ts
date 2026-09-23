export const BUDGET_RANGES = [
  { value: "lt_500m", label: "Dưới 500 triệu" },
  { value: "500m_2b", label: "500 triệu - 2 tỷ" },
  { value: "2b_10b", label: "2 tỷ - 10 tỷ" },
  { value: "gt_10b", label: "Trên 10 tỷ" },
] as const;

export const INQUIRY_INTERESTS = [
  { value: "co_branded", label: "Tài trợ công trình trọn gói" },
  { value: "matching_fund", label: "Gây quỹ đối ứng (Matching Fund)" },
  { value: "in_kind", label: "Nguồn lực phi tiền tệ" },
  { value: "esg_hub", label: "Ủy thác & số hóa ESG" },
  { value: "field_staff", label: "Cử nhân sự đồng hành thực địa" },
  { value: "other", label: "Tư vấn chung" },
] as const;

export type InquiryInterest = (typeof INQUIRY_INTERESTS)[number]["value"];

export const budgetLabel = (value: string) => BUDGET_RANGES.find((item) => item.value === value)?.label ?? value;
export const interestLabel = (value: string) => INQUIRY_INTERESTS.find((item) => item.value === value)?.label ?? value;
