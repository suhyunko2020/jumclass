// ── 포맷 유틸리티 ──────────────────────────────────────────
export const formatPrice = (n: number) => '₩' + n.toLocaleString('ko-KR');

export const discountRate = (orig: number, price: number) => {
  if (!orig || orig <= 0) return 0;
  return Math.round((1 - price / orig) * 100);
};

// 9999일 이상이면 "무제한 시청"
export const formatDays = (days: number) =>
  days >= 9999 ? '무제한 시청' : `${days}일 수강 기간`;

export const formatDaysShort = (days: number) =>
  days >= 9999 ? '무제한' : `${days}일 수강`;
