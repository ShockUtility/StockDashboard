import { useState } from 'react';
import { Portfolio, Asset, SortConfig, SortKey } from '../types/portfolio';
import { formatMoney } from '../utils/format';
import { getSortedAssets } from '../hooks/useCalculations';

interface AssetStatusSectionProps {
  portfolios: Portfolio[];
  exchangeRate: number;
  onShowPieChart: (title: string, data: { name: string; value: number }[]) => void;
  onShowDetail: (asset: Asset) => void;
}

export const AssetStatusSection = ({
  portfolios, exchangeRate, onShowPieChart, onShowDetail
}: AssetStatusSectionProps) => {
  // [교육용 설명] 미국 주식과 한국 주식 테이블 각각 독립된 정렬 상태를 가집니다
  const [usSortConfig, setUsSortConfig] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });
  const [krSortConfig, setKrSortConfig] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });
  const [collapsedUS, setCollapsedUS] = useState(false);
  const [collapsedKR, setCollapsedKR] = useState(false);

  const usStocks: { [code: string]: Asset & { totalInvestment: number; totalCurrent: number } } = {};
  const krStocks: { [code: string]: Asset & { totalInvestment: number; totalCurrent: number } } = {};

  portfolios.forEach(p => {
    p.assets.forEach(a => {
      const invest = a.avgPrice * a.quantity;
      const current = a.currentPrice * a.quantity;

      if (a.type === 'US_STOCK') {
        if (!usStocks[a.code]) {
          usStocks[a.code] = { ...a, totalInvestment: invest, totalCurrent: current };
        } else {
          const existing = usStocks[a.code];
          existing.quantity += a.quantity;
          existing.totalInvestment += invest;
          existing.totalCurrent += current;
          existing.avgPrice = existing.totalInvestment / existing.quantity;
        }
      } else if (a.type === 'KR_STOCK') {
        if (!krStocks[a.code]) {
          krStocks[a.code] = { ...a, totalInvestment: invest, totalCurrent: current };
        } else {
          const existing = krStocks[a.code];
          existing.quantity += a.quantity;
          existing.totalInvestment += invest;
          existing.totalCurrent += current;
          existing.avgPrice = existing.totalInvestment / existing.quantity;
        }
      }
    });
  });

  // [교육용 설명] getSortedAssets 호출 시 exchangeRate(환율)를 인자로 추가했습니다.
  const aggregatedUSStocks = getSortedAssets(Object.values(usStocks), usSortConfig, exchangeRate);
  const aggregatedKRStocks = getSortedAssets(Object.values(krStocks), krSortConfig, exchangeRate);

  const totalUSInvest = aggregatedUSStocks.reduce((sum, s) => sum + (s.avgPrice * s.quantity), 0);
  const totalUSCurrent = aggregatedUSStocks.reduce((sum, s) => sum + (s.currentPrice * s.quantity), 0);
  const totalUSReturn = totalUSCurrent - totalUSInvest;
  const totalUSReturnPercent = totalUSInvest > 0 ? (totalUSReturn / totalUSInvest * 100) : 0;

  const totalKRInvest = aggregatedKRStocks.reduce((sum, s) => sum + (s.avgPrice * s.quantity), 0);
  const totalKRCurrent = aggregatedKRStocks.reduce((sum, s) => sum + (s.currentPrice * s.quantity), 0);
  const totalKRReturn = totalKRCurrent - totalKRInvest;
  const totalKRReturnPercent = totalKRInvest > 0 ? (totalKRReturn / totalKRInvest * 100) : 0;

  // [교육용 설명] 미국 주식 테이블 전용 정렬 핸들러
  const handleUSSortChange = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (usSortConfig && usSortConfig.key === key && usSortConfig.direction === 'asc') direction = 'desc';
    setUsSortConfig({ key, direction });
  };
  // [교육용 설명] 한국 주식 테이블 전용 정렬 핸들러
  const handleKRSortChange = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (krSortConfig && krSortConfig.key === key && krSortConfig.direction === 'asc') direction = 'desc';
    setKrSortConfig({ key, direction });
  };

  const renderAssetSortIcon = (columnKey: SortKey, sortConfig: SortConfig | null) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '4px', fontSize: '0.7em' }}>↕</span>;
    return <span style={{ marginLeft: '4px', fontSize: '0.8em', color: 'var(--text-primary)' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '60px', marginTop: '32px' }}>
      {/* 미국 주식 */}
      <section className="glass-panel" style={{ padding: '24px', overflow: 'hidden' }}>
        <div>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', flex: '1 1 auto', minWidth: '250px' }} onClick={() => setCollapsedUS(prev => !prev)}>
              <span style={{ fontSize: '1.2rem', transform: collapsedUS ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s', display: 'inline-block' }}>▼</span>
              <div><h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>🇺🇸 미국 주식 통합 현황</h2></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flexShrink: 0 }}>
              <div className="stat-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '40px', background: 'rgba(0,0,0,0.3)', padding: '0 20px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                <span className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>총 평가액:</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatMoney(totalUSCurrent, 'USD')}</strong>
                <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>≈ {formatMoney(totalUSCurrent * exchangeRate, 'KRW')}</span>
              </div>
              <button
                className="glass-button"
                style={{ width: '40px', height: '40px', padding: 0, borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#fff', flexShrink: 0 }}
                onClick={(e) => {
                  e.stopPropagation(); // 접기 클릭 전파 방지
                  const usPieData = aggregatedUSStocks.map(s => ({ name: s.name, value: s.currentPrice * s.quantity }));
                  onShowPieChart('🇺🇸 미국 주식 비중 현황', usPieData);
                }}
                title="미국 주식 비중 차트 보기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
              </button>
            </div>
          </div>
          {!collapsedUS && (
            <div style={{ display: 'flex', gap: '24px', marginTop: '24px', marginBottom: '24px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ flex: 1 }}>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>총 투자 원금</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{formatMoney(totalUSInvest, 'USD')}</div>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '24px' }}>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>총 수익 현황</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }} className={totalUSReturn >= 0 ? 'text-success' : 'text-danger'}>
                  {totalUSReturn >= 0 ? '+' : ''}{formatMoney(totalUSReturn, 'USD')}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '2px' }} className={totalUSReturnPercent >= 0 ? 'text-success' : 'text-danger'}>
                  {totalUSReturnPercent >= 0 ? '▲' : '▼'} {totalUSReturnPercent.toFixed(2)}%
                </div>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '24px' }}>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>보유 종목 수</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{aggregatedUSStocks.length}개 종목</div>
              </div>
            </div>
          )}
        </div>
        {!collapsedUS && (
          <div className="glass-table-container">
            <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: '200px' }} onClick={() => handleUSSortChange('name')}>종목명 {renderAssetSortIcon('name', usSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleUSSortChange('quantity')}>수량 {renderAssetSortIcon('quantity', usSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleUSSortChange('avgPrice')}>평균단가 {renderAssetSortIcon('avgPrice', usSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleUSSortChange('currentPrice')}>현재가 {renderAssetSortIcon('currentPrice', usSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleUSSortChange('investment')}>투자금액 (USD) {renderAssetSortIcon('investment', usSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleUSSortChange('current')}>평가금액 (USD) {renderAssetSortIcon('current', usSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleUSSortChange('returnPercent')}>수익 (수익률) {renderAssetSortIcon('returnPercent', usSortConfig)}</th>
                  <th>비중</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedUSStocks.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>보유 중인 미국 주식이 없습니다.</td></tr>
                ) : (
                  aggregatedUSStocks.map((stock) => {
                    const stockInvest = stock.avgPrice * stock.quantity;
                    const stockCurrent = stock.currentPrice * stock.quantity;
                    const retAmount = stockCurrent - stockInvest;
                    const retPercent = stockInvest > 0 ? (retAmount / stockInvest * 100) : 0;
                    const weight = totalUSCurrent > 0 ? (stockCurrent / totalUSCurrent * 100) : 0;
                    return (
                      <tr key={stock.code} className="hover-dim">
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => onShowDetail(stock)} className="clickable-stock-name">
                            <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', color: '#a78bfa', textDecoration: 'underline' }}>{stock.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stock.code}</div>
                          </div>
                        </td>
                        <td>{stock.quantity.toLocaleString()}</td>
                        <td>{formatMoney(stock.avgPrice, 'USD')}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span className={stock.changePercent !== undefined && stock.changePercent >= 0 ? 'text-success' : 'text-danger'}>
                              {formatMoney(stock.currentPrice, 'USD')}
                            </span>
                            {/* 당일 등락률 표시 추가 */}
                            {stock.changePercent !== undefined && (
                              <span className={stock.changePercent >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '0.75rem' }}>
                                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{formatMoney(stockInvest, 'USD')}</td>
                        <td style={{ fontWeight: 600 }}>{formatMoney(stockCurrent, 'USD')}</td>
                        <td className={retAmount >= 0 ? 'text-success' : 'text-danger'}>
                          <div style={{ fontWeight: 600 }}>{retAmount >= 0 ? '+' : ''}{formatMoney(retAmount, 'USD')}</div>
                          <div style={{ fontSize: '0.75rem' }}>({retPercent >= 0 ? '+' : ''}{retPercent.toFixed(2)}%)</div>
                        </td>
                        <td>{weight.toFixed(1)}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 한국 주식 */}
      <section className="glass-panel" style={{ padding: '24px', overflow: 'hidden' }}>
        <div>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', flex: '1 1 auto', minWidth: '250px' }} onClick={() => setCollapsedKR(prev => !prev)}>
              <span style={{ fontSize: '1.2rem', transform: collapsedKR ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s', display: 'inline-block' }}>▼</span>
              <div><h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>🇰🇷 한국 주식 통합 현황</h2></div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flexShrink: 0 }}>
              <div className="stat-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '40px', background: 'rgba(0,0,0,0.3)', padding: '0 20px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                <span className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 500, whiteSpace: 'nowrap' }}>총 평가액:</span>
                <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatMoney(totalKRCurrent, 'KRW')}</strong>
              </div>
              <button
                className="glass-button"
                style={{ width: '40px', height: '40px', padding: 0, borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#fff', flexShrink: 0 }}
                onClick={(e) => {
                  e.stopPropagation(); // 접기 클릭 전파 방지
                  const krPieData = aggregatedKRStocks.map(s => ({ name: s.name, value: s.currentPrice * s.quantity }));
                  onShowPieChart('🇰🇷 한국 주식 비중 현황', krPieData);
                }}
                title="한국 주식 비중 차트 보기"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
              </button>
            </div>
          </div>
          {!collapsedKR && (
            <div style={{ display: 'flex', gap: '24px', marginTop: '24px', marginBottom: '24px', padding: '20px', background: 'rgba(0,0,0,0.2)', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ flex: 1 }}>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>총 투자 원금</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{formatMoney(totalKRInvest, 'KRW')}</div>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '24px' }}>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>총 수익 현황</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }} className={totalKRReturn >= 0 ? 'text-success' : 'text-danger'}>
                  {totalKRReturn >= 0 ? '+' : ''}{formatMoney(totalKRReturn, 'KRW')}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, marginTop: '2px' }} className={totalKRReturnPercent >= 0 ? 'text-success' : 'text-danger'}>
                  {totalKRReturnPercent >= 0 ? '▲' : '▼'} {totalKRReturnPercent.toFixed(2)}%
                </div>
              </div>
              <div style={{ flex: 1, borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '24px' }}>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '6px' }}>보유 종목 수</div>
                <div style={{ fontSize: '1.2rem', fontWeight: 600 }}>{aggregatedKRStocks.length}개 종목</div>
              </div>
            </div>
          )}
        </div>
        {!collapsedKR && (
          <div className="glass-table-container">
            <table className="glass-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: '200px' }} onClick={() => handleKRSortChange('name')}>종목명 {renderAssetSortIcon('name', krSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleKRSortChange('quantity')}>수량 {renderAssetSortIcon('quantity', krSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleKRSortChange('avgPrice')}>가중 평균단가 {renderAssetSortIcon('avgPrice', krSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleKRSortChange('currentPrice')}>현재가 {renderAssetSortIcon('currentPrice', krSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleKRSortChange('investment')}>투자금액 (KRW) {renderAssetSortIcon('investment', krSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleKRSortChange('current')}>평가금액 (KRW) {renderAssetSortIcon('current', krSortConfig)}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleKRSortChange('returnPercent')}>수익 (수익률) {renderAssetSortIcon('returnPercent', krSortConfig)}</th>
                  <th>비중</th>
                </tr>
              </thead>
              <tbody>
                {aggregatedKRStocks.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.3)' }}>보유 중인 한국 주식이 없습니다.</td></tr>
                ) : (
                  aggregatedKRStocks.map((stock) => {
                    const stockInvest = stock.avgPrice * stock.quantity;
                    const stockCurrent = stock.currentPrice * stock.quantity;
                    const retAmount = stockCurrent - stockInvest;
                    const retPercent = stockInvest > 0 ? (retAmount / stockInvest * 100) : 0;
                    const weight = totalKRCurrent > 0 ? (stockCurrent / totalKRCurrent * 100) : 0;
                    return (
                      <tr key={stock.code} className="hover-dim">
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => onShowDetail(stock)} className="clickable-stock-name">
                            <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px', color: '#a78bfa', textDecoration: 'underline' }}>{stock.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stock.code}</div>
                          </div>
                        </td>
                        <td>{stock.quantity.toLocaleString()}</td>
                        <td>{formatMoney(stock.avgPrice, 'KRW')}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                            <span className={stock.changePercent !== undefined && stock.changePercent >= 0 ? 'text-success' : 'text-danger'}>
                              {formatMoney(stock.currentPrice, 'KRW')}
                            </span>
                            {/* 당일 등락률 표시 추가 */}
                            {stock.changePercent !== undefined && (
                              <span className={stock.changePercent >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '0.75rem' }}>
                                {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{formatMoney(stockInvest, 'KRW')}</td>
                        <td style={{ fontWeight: 600 }}>{formatMoney(stockCurrent, 'KRW')}</td>
                        <td className={retAmount >= 0 ? 'text-success' : 'text-danger'}>
                          <div style={{ fontWeight: 600 }}>{retAmount >= 0 ? '+' : ''}{formatMoney(retAmount, 'KRW')}</div>
                          <div style={{ fontSize: '0.75rem' }}>({retPercent >= 0 ? '+' : ''}{retPercent.toFixed(2)}%)</div>
                        </td>
                        <td>{weight.toFixed(1)}%</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
