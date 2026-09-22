export const SOS_NEEDS = ["Lương thực", "Y tế", "Xe cứu thương", "Xuồng máy", "Nơi trú ẩn"] as const;

export type SosNeed = (typeof SOS_NEEDS)[number];
