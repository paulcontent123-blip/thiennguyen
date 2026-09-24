export type MatchOffer = {
  resource_type: string;
  title: string;
  quantity: number;
  unit: string;
  province: string | null;
  preferred_campaign_id: string | null;
};

export type MatchNeed = {
  id: string;
  campaign_id: string;
  resource_type: string;
  name: string;
  unit: string;
  province: string | null;
  campaign_province: string | null;
  urgency: string;
  quantity_needed: number;
};

export type MatchSuggestion<N extends MatchNeed> = {
  need: N;
  score: number;
  remaining: number;
  suggestedQuantity: number;
  reasons: string[];
};

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string) {
  return normalize(value).split(" ").filter((word) => word.length > 1);
}

// Gợi ý chỉ để Admin tham khảo: mọi lượt ghép vẫn do Admin xác minh thủ công.
export function suggestNeedsForOffer<N extends MatchNeed>(
  offer: MatchOffer,
  needs: N[],
  remainingByNeed: Map<string, number>,
): MatchSuggestion<N>[] {
  const offerWords = new Set(tokens(offer.title));
  const offerProvince = offer.province ? normalize(offer.province) : null;

  return needs
    .filter((need) => need.resource_type === offer.resource_type)
    .flatMap<MatchSuggestion<N>>((need) => {
      const remaining = remainingByNeed.get(need.id) ?? need.quantity_needed;
      if (remaining <= 0) return [];

      let score = 10;
      const reasons = ["Cùng loại nguồn lực"];

      if (normalize(need.unit) === normalize(offer.unit)) {
        score += 15;
        reasons.push(`Cùng đơn vị (${need.unit})`);
      }
      const needWords = tokens(need.name);
      const shared = needWords.filter((word) => offerWords.has(word));
      if (shared.length) {
        score += Math.min(30, 12 * shared.length);
        reasons.push(`Trùng từ khoá: ${shared.slice(0, 3).join(", ")}`);
      }
      const needProvinces = [need.province, need.campaign_province].filter(Boolean).map((value) => normalize(value as string));
      if (offerProvince && needProvinces.includes(offerProvince)) {
        score += 25;
        reasons.push("Cùng tỉnh / khu vực");
      }
      if (offer.preferred_campaign_id && offer.preferred_campaign_id === need.campaign_id) {
        score += 30;
        reasons.push("Đúng chiến dịch người đóng góp mong muốn");
      }
      if (need.urgency === "urgent") {
        score += 8;
        reasons.push("Nhu cầu khẩn cấp");
      }
      if (remaining <= offer.quantity) {
        score += 6;
        reasons.push("Nguồn lực đủ lấp phần còn thiếu");
      }

      return [{ need, score, remaining, suggestedQuantity: Math.min(offer.quantity, remaining), reasons }];
    })
    .sort((a, b) => b.score - a.score);
}
