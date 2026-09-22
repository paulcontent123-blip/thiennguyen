export const RESCUE_RESOURCE_TYPES = ["Nhân lực cứu hộ", "Xe / Xuồng", "Y tế", "Lương thực"] as const;

export type RescueResourceType = (typeof RESCUE_RESOURCE_TYPES)[number];
