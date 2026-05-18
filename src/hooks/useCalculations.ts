/* eslint-disable */
import { useMemo } from 'react';
import { Asset, Portfolio, SortConfig } from '../types/portfolio';

export function useCalculations(portfolios: Portfolio[], exchangeRate: number) {
  // 전체 자산 계산
  const totals = useMemo(() => {
    let totalStockInvestmentKRW = 0;
    let totalStockCurrentValueKRW = 0;
    let totalCashKRW = 0;
    let totalKRWAssets = 0;
    let totalUSDAssets = 0;
    let totalUSDAssetsKRW = 0;

    const weightMap: { [key: string]: number } = {
      'KR_STOCK': 0,
      'US_STOCK': 0,
      'CUSTOM': 0,
      'CASH': 0
    };

    portfolios.forEach(p => {
      p.assets.forEach(asset => {
        const rate = asset.currency === 'USD' ? exchangeRate : 1;
        const investValue = (asset.avgPrice * asset.quantity) * rate;
        const currentValue = (asset.currentPrice * asset.quantity) * rate;

        if (asset.type === 'CASH') {
          totalCashKRW += currentValue;
          weightMap['CASH'] += currentValue;

          if (asset.currency === 'KRW') {
            totalKRWAssets += (asset.currentPrice * asset.quantity);
          } else if (asset.currency === 'USD') {
            totalUSDAssets += (asset.currentPrice * asset.quantity);
            totalUSDAssetsKRW += currentValue;
          }
        } else {
          totalStockInvestmentKRW += investValue;
          totalStockCurrentValueKRW += currentValue;
          weightMap[asset.type] += currentValue;
        }
      });
    });

    const totalInvestmentKRW = totalStockInvestmentKRW;
    const totalCurrentValueKRW = totalStockCurrentValueKRW + totalCashKRW;
    const totalReturnAmountKRW = totalStockCurrentValueKRW - totalStockInvestmentKRW;
    const totalReturnPercent = totalInvestmentKRW > 0 ? (totalReturnAmountKRW / totalInvestmentKRW) * 100 : 0;

    const totalPieData: { name: string, value: number }[] = [];
    if (weightMap['KR_STOCK'] > 0) totalPieData.push({ name: '🇰🇷 한국 주식', value: weightMap['KR_STOCK'] });
    if (weightMap['US_STOCK'] > 0) totalPieData.push({ name: '🇺🇸 미국 주식', value: weightMap['US_STOCK'] });
    if (weightMap['CUSTOM'] > 0) totalPieData.push({ name: '🏅 커스텀 자산', value: weightMap['CUSTOM'] });
    if (weightMap['CASH'] > 0) totalPieData.push({ name: '💵 현금', value: weightMap['CASH'] });
    totalPieData.sort((a, b) => b.value - a.value);

    return {
      totalInvestmentKRW,
      totalCurrentValueKRW,
      totalReturnAmountKRW,
      totalReturnPercent,
      totalPieData,
      totalKRWAssets,
      totalUSDAssets,
      totalUSDAssetsKRW
    };
  }, [portfolios, exchangeRate]);

  return { totals };
}

// [교육용 설명]
// 정렬 함수에 exchangeRate(환율) 파라미터를 추가했습니다.
// 이제 미국 주식의 경우 환율을 적용하여 원화로 환산한 뒤 비교하므로,
// 한국 주식과 미국 주식이 올바른 가치 기준으로 정렬됩니다.
export function getSortedAssets(assets: Asset[], config: SortConfig | null, exchangeRate: number): Asset[] {
  return [...assets].sort((a, b) => {
    const getPriority = (type: Asset['type']) => {
      if (type === 'KR_STOCK' || type === 'US_STOCK') return 1;
      if (type === 'CUSTOM') return 2;
      if (type === 'CASH') return 3;
      return 4;
    };

    const priorityA = getPriority(a.type);
    const priorityB = getPriority(b.type);

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    if (!config) return 0;
    const { key, direction } = config;
    let aVal: any = 0; let bVal: any = 0;

    // 각 자산의 통화에 맞는 환율을 적용합니다.
    const aRate = a.currency === 'USD' ? exchangeRate : 1;
    const bRate = b.currency === 'USD' ? exchangeRate : 1;
    
    // [교육용 설명]
    // 이전에는 환율을 곱하지 않아 1000달러가 100000원보다 작게 인식되었으나,
    // 이제는 환율(예: 1300원)을 곱한 원화 환산 금액으로 정합성 있게 비교합니다.
    const aInvest = (a.avgPrice * a.quantity) * aRate;
    const bInvest = (b.avgPrice * b.quantity) * bRate;
    const aCurrent = (a.currentPrice * a.quantity) * aRate;
    const bCurrent = (b.currentPrice * b.quantity) * bRate;
    
    switch (key) {
      case 'name': aVal = a.name; bVal = b.name; break;
      case 'quantity': aVal = a.quantity; bVal = b.quantity; break;
      case 'avgPrice': aVal = a.avgPrice; bVal = b.avgPrice; break;
      case 'currentPrice': aVal = a.changePercent ?? 0; bVal = b.changePercent ?? 0; break;
      case 'investment': aVal = aInvest; bVal = bInvest; break;
      case 'current': aVal = aCurrent; bVal = bCurrent; break;
      case 'returnAmount': aVal = aCurrent - aInvest; bVal = bCurrent - bInvest; break;
      case 'returnPercent': aVal = (aCurrent - aInvest) / (aInvest || 1); bVal = (bCurrent - bInvest) / (bInvest || 1); break;
    }
    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}
