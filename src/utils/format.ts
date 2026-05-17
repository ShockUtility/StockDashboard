export const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#84cc16'];

export const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${dayNames[date.getDay()]})`;
};

export const formatMoney = (amount: number, currency: string) => {
  return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'ko-KR', {
    style: 'currency',
    currency: currency
  }).format(amount);
};
