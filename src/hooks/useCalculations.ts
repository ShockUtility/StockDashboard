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

export function getSortedAssets(assets: Asset[], config: SortConfig | null): Asset[] {
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
    const aInvest = a.avgPrice * a.quantity; const bInvest = b.avgPrice * b.quantity;
    const aCurrent = a.currentPrice * a.quantity; const bCurrent = b.currentPrice * b.quantity;
    
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
