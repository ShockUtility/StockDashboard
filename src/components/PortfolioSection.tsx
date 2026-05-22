import { useState } from 'react';
import { Portfolio, Asset, SortConfig, SortKey } from '../types/portfolio';
import { formatMoney } from '../utils/format';
import { getSortedAssets } from '../hooks/useCalculations';

interface PortfolioSectionProps {
  portfolio: Portfolio;
  isCollapsed: boolean;
  exchangeRate: number;
  togglePortfolio: (id: string) => void;
  handleRenamePortfolio: (id: string, newName: string) => void;
  handleDeletePortfolio: (id: string) => void;
  onShowPieChart: (p: Portfolio) => void;
  onAddAsset: (pId: string) => void;
  onShowDetail: (asset: Asset) => void;
  onManageAsset: (e: React.MouseEvent, pId: string, asset: Asset) => void;
  saveEditAsset: (portfolioId: string, assetId: string, updatedData: Partial<Asset>) => void;
  refreshingStockIds: string[];
  pendingStockIds: string[];
  showManageModal: boolean;
  managingAssetId?: string;
  onSortAssets: (pId: string, config: SortConfig) => void;
}

export const PortfolioSection = ({
  portfolio, isCollapsed, exchangeRate,
  togglePortfolio, handleRenamePortfolio, handleDeletePortfolio,
  onShowPieChart, onAddAsset, onShowDetail, onManageAsset,
  saveEditAsset, refreshingStockIds, pendingStockIds, showManageModal, managingAssetId, onSortAssets
}: PortfolioSectionProps) => {
  // [교육용 설명]
  // 정렬 기준(sortConfig)을 내부 상태(Local State)가 아닌 portfolio 객체에서 직접 참조합니다.
  // 실제 배열(portfolio.assets) 자체가 부모에서 이미 정렬되어 내려오기 때문에, 여기서는 화면에 그대로 뿌려주기만 하면 됩니다.
  const sortConfig = portfolio.sortConfig;
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editAssetData, setEditAssetData] = useState({ name: '', quantity: '', avgPrice: '', currentPrice: '' });

  let pInvestKRW = 0;
  let pCurrentKRW = 0;
  let pTotalAssetKRW = 0;
  let pStockCurrentKRW = 0;

  portfolio.assets.forEach(a => {
    const rate = a.currency === 'USD' ? exchangeRate : 1;
    const invest = (a.avgPrice * a.quantity) * rate;
    const current = (a.currentPrice * a.quantity) * rate;

    pTotalAssetKRW += current;
    if (a.type !== 'CASH') {
      pInvestKRW += invest;
      pCurrentKRW += current;
      pStockCurrentKRW += current;
    }
  });

  const pReturnAmount = pStockCurrentKRW - pInvestKRW;
  
  // [교육용 설명]
  // 부모에서 이미 물리적으로 정렬된 배열을 내려주기 때문에, 별도의 동적 정렬 함수를 호출하지 않습니다.
  const sortedAssets = portfolio.assets;

  const handleSort = (key: SortKey) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    // [교육용 설명] 내부 상태를 바꾸는 대신 부모에게 "이 기준으로 배열 전체를 다시 정렬해서 덮어써달라"고 요청합니다.
    onSortAssets(portfolio.id, { key, direction });
  };

  const startEditAsset = (asset: Asset, field: string = 'name') => {
    setEditingAssetId(asset.id);
    setEditingField(field);
    setEditAssetData({
      name: asset.name,
      quantity: String(asset.quantity),
      avgPrice: String(asset.avgPrice),
      currentPrice: String(asset.currentPrice)
    });
  };

  const handleSaveEdit = (assetId: string) => {
    const a = portfolio.assets.find(as => as.id === assetId);
    if (!a) return;
    saveEditAsset(
      portfolio.id,
      assetId,
      {
        name: editAssetData.name || a.name,
        quantity: parseFloat(editAssetData.quantity) || 0,
        avgPrice: parseFloat(editAssetData.avgPrice) || 0,
        currentPrice: parseFloat(editAssetData.currentPrice) || a.currentPrice
      }
    );
    setEditingAssetId(null);
  };

  const renderSortIcon = (columnKey: SortKey) => {
    if (!sortConfig || sortConfig.key !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '4px', fontSize: '0.7em' }}>↕</span>;
    return <span style={{ marginLeft: '4px', fontSize: '0.8em', color: 'var(--text-primary)' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
  };

  return (
    <section className="glass-panel" style={{ marginTop: '32px' }}>
      <div className="flex-between portfolio-header" style={{ marginBottom: isCollapsed ? '0' : '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <span
            onClick={() => togglePortfolio(portfolio.id)}
            style={{ fontSize: '1.2rem', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s', cursor: 'pointer' }}
          >
            ▼
          </span>
          <input
            className="transparent-input"
            style={{ fontSize: '1.5rem', fontWeight: 700, background: 'none', border: 'none', color: '#fff', width: 'auto', minWidth: '100px' }}
            value={portfolio.name}
            onChange={(e) => handleRenamePortfolio(portfolio.id, e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            placeholder="포트폴리오 이름"
          />
        </div>

        <div className="header-stats" style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div className="stat-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '40px', background: 'rgba(0,0,0,0.3)', padding: '0 20px', borderRadius: '10px', border: '1px solid var(--glass-border)', whiteSpace: 'nowrap' }}>
            <span className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 500 }}>총 평가액:</span>
            <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{formatMoney(pTotalAssetKRW, 'KRW')}</strong>
          </div>
          <button
            className="glass-button"
            style={{ width: '40px', height: '40px', padding: 0, borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)', color: '#fff' }}
            onClick={() => onShowPieChart(portfolio)}
            title="비중 확인"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
          </button>
          <button
            className="glass-button"
            style={{ width: '40px', height: '40px', padding: 0, borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#fff', fontWeight: 600 }}
            onClick={() => onAddAsset(portfolio.id)}
            title="자산 추가"
          >
            <span style={{ fontSize: '1.5rem' }}>+</span>
          </button>
          <button
            className="delete-button"
            onClick={() => handleDeletePortfolio(portfolio.id)}
            style={{ width: '40px', height: '40px', borderRadius: '10px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fff', cursor: 'pointer', transition: 'all 0.2s' }}
            title="포트폴리오 삭제"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div className="glass-table-container">
          {portfolio.assets.length === 0 ? (
            <p className="text-secondary" style={{ textAlign: 'center', padding: '40px 0' }}>등록된 자산이 없습니다. 오른쪽 상단의 + 버튼을 눌러 추가하세요.</p>
          ) : (
            <table className="glass-table">
              <thead>
                <tr>
                  <th style={{ cursor: 'pointer', width: '200px' }} onClick={() => handleSort('name')}>종목명 {renderSortIcon('name')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('quantity')}>수량 {renderSortIcon('quantity')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('avgPrice')}>평균단가 {renderSortIcon('avgPrice')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('currentPrice')}>현재가 {renderSortIcon('currentPrice')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('investment')}>투자금액 (KRW) {renderSortIcon('investment')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('current')}>평가금액 (KRW) {renderSortIcon('current')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('returnAmount')}>수익 (수익률) {renderSortIcon('returnAmount')}</th>
                  <th style={{ cursor: 'pointer' }} onClick={() => handleSort('current')}>비중 {renderSortIcon('current')}</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {sortedAssets.map(asset => {
                  const rate = asset.currency === 'USD' ? exchangeRate : 1;
                  const investmentKRW = (asset.avgPrice * asset.quantity) * rate;
                  const currentKRW = (asset.currentPrice * asset.quantity) * rate;
                  const returnAmountKRW = currentKRW - investmentKRW;
                  const returnPercent = investmentKRW > 0 ? (returnAmountKRW / investmentKRW) * 100 : 0;
                  const weightPercent = pCurrentKRW > 0 ? (currentKRW / pCurrentKRW) * 100 : 0;

                  return (
                    <tr key={asset.id} className={showManageModal ? "" : "hover-dim"} style={{ opacity: asset.type === 'CASH' ? 0.9 : 1 }}>
                      <td>
                        {editingAssetId === asset.id ? (
                          <input
                            type="text"
                            className="glass-input"
                            style={{ padding: '4px 8px', width: '150px', background: 'rgba(0,0,0,0.5)', fontWeight: 'bold' }}
                            value={editAssetData.name}
                            onChange={(e) => setEditAssetData({ ...editAssetData, name: e.target.value })}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                            autoFocus={editingField === 'name'}
                          />
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '1.2rem' }}>
                              {asset.type === 'KR_STOCK' ? '🇰🇷' : asset.type === 'US_STOCK' ? '🇺🇸' : asset.type === 'CASH' ? '💵' : '🏅'}
                            </span>
                            <div>
                              {asset.type === 'KR_STOCK' || asset.type === 'US_STOCK' ? (
                                <strong
                                  onClick={() => onShowDetail(asset)}
                                  style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '150px', cursor: 'pointer', color: '#a78bfa', textDecoration: 'underline' }}
                                >
                                  {asset.name}
                                </strong>
                              ) : (
                                <strong
                                  onClick={() => startEditAsset(asset, 'name')}
                                  style={{ color: 'var(--text-primary)', cursor: 'pointer', borderBottom: '1px dashed rgba(255,255,255,0.3)', display: 'inline-block' }}
                                >
                                  {asset.name}
                                </strong>
                              )}
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{asset.code !== 'CASH' && asset.code !== 'MANUAL' ? asset.code : asset.type}</div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td>
                        {asset.type === 'CASH' ? '-' : (
                          editingAssetId === asset.id ? (
                            <input
                              type="number"
                              step="any"
                              className="glass-input"
                              style={{ padding: '4px 8px', width: '80px', background: 'rgba(0,0,0,0.5)' }}
                              value={editAssetData.quantity}
                              onChange={(e) => setEditAssetData({ ...editAssetData, quantity: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                              autoFocus={editingField === 'quantity'}
                            />
                          ) : (
                            <span onClick={() => startEditAsset(asset, 'quantity')} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>
                              {asset.quantity.toLocaleString()}
                            </span>
                          )
                        )}
                      </td>
                      <td>
                        {asset.type === 'CASH' ? (
                          editingAssetId === asset.id ? (
                            <input
                              type="number"
                              step="any"
                              className="glass-input"
                              style={{ padding: '4px 8px', width: '100px', background: 'rgba(0,0,0,0.5)' }}
                              value={editAssetData.avgPrice}
                              onChange={(e) => setEditAssetData({ ...editAssetData, avgPrice: e.target.value, currentPrice: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                              autoFocus={editingField === 'avgPrice'}
                            />
                          ) : (
                            <span onClick={() => startEditAsset(asset, 'avgPrice')} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>
                              {formatMoney(asset.avgPrice, asset.currency)}
                            </span>
                          )
                        ) : (
                          editingAssetId === asset.id ? (
                            <input
                              type="number"
                              step="any"
                              className="glass-input"
                              style={{ padding: '4px 8px', width: '100px', background: 'rgba(0,0,0,0.5)' }}
                              value={editAssetData.avgPrice}
                              onChange={(e) => setEditAssetData({ ...editAssetData, avgPrice: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                              autoFocus={editingField === 'avgPrice'}
                            />
                          ) : (
                            <span onClick={() => startEditAsset(asset, 'avgPrice')} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>
                              {formatMoney(asset.avgPrice, asset.currency)}
                            </span>
                          )
                        )}
                      </td>
                      <td>
                        {asset.type === 'CASH' ? '-' : (
                          (editingAssetId === asset.id && asset.type === 'CUSTOM') ? (
                            <input
                              type="number"
                              step="any"
                              className="glass-input"
                              style={{ padding: '4px 8px', width: '100px', background: 'rgba(0,0,0,0.5)' }}
                              value={editAssetData.currentPrice}
                              onChange={(e) => setEditAssetData({ ...editAssetData, currentPrice: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                              autoFocus={editingField === 'currentPrice'}
                            />
                          ) : (
                            <div style={{ minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
                              {refreshingStockIds.includes(asset.id) ? (
                                <div style={{ width: '16px', height: '16px', border: '2px solid rgba(59, 130, 246, 0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', opacity: pendingStockIds.includes(asset.id) ? 0.4 : 1 }}>
                                  <div
                                    className={pendingStockIds.includes(asset.id) ? '' : (asset.type === 'CUSTOM' ? '' : ((asset.changePercent || 0) >= 0 ? 'text-success' : 'text-danger'))}
                                    onClick={() => asset.type === 'CUSTOM' && startEditAsset(asset, 'currentPrice')}
                                    style={{ cursor: asset.type === 'CUSTOM' ? 'pointer' : 'default', fontWeight: 600, color: pendingStockIds.includes(asset.id) ? 'var(--text-secondary)' : (asset.type === 'CUSTOM' ? 'var(--text-primary)' : undefined), borderBottom: asset.type === 'CUSTOM' ? '1px dashed var(--text-secondary)' : 'none', display: asset.type === 'CUSTOM' ? 'inline-block' : 'block' }}
                                  >
                                    {formatMoney(asset.currentPrice, asset.currency)}
                                  </div>
                                  {asset.changePercent !== undefined && !pendingStockIds.includes(asset.id) && (
                                    <div className={(asset.changePercent || 0) >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '0.75rem' }}>
                                      {(asset.changePercent || 0) >= 0 ? '+' : ''}{(asset.changePercent || 0).toFixed(2)}%
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        )}
                      </td>
                      <td>{asset.type === 'CASH' ? '-' : formatMoney(investmentKRW, 'KRW')}</td>
                      <td>{asset.type === 'CASH' ? '-' : formatMoney(currentKRW, 'KRW')}</td>
                      <td className={asset.type === 'CASH' ? '' : (returnAmountKRW >= 0 ? 'text-success' : 'text-danger')} style={asset.type === 'CASH' ? { color: 'var(--text-primary)' } : {}}>
                        {asset.type === 'CASH' ? '-' : (
                          <>
                            <div style={{ fontWeight: 600 }}>{returnAmountKRW >= 0 ? '+' : ''}{formatMoney(returnAmountKRW, 'KRW')}</div>
                            <div style={{ fontSize: '0.75rem' }}>({returnPercent >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%)</div>
                          </>
                        )}
                      </td>
                      <td>{weightPercent.toFixed(1)}%</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={(e) => onManageAsset(e, portfolio.id, asset)}
                          className="glass-button"
                          style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', margin: '0 auto', background: showManageModal && managingAssetId === asset.id ? 'rgba(255,255,255,0.15)' : 'transparent' }}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="5" r="1.5"></circle><circle cx="12" cy="19" r="1.5"></circle></svg>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ fontWeight: 'bold' }}>
                <tr>
                  <td colSpan={4} style={{ textAlign: 'right' }}>포트폴리오 합계</td>
                  <td>{formatMoney(pInvestKRW, 'KRW')}</td>
                  <td>{formatMoney(pCurrentKRW, 'KRW')}</td>
                  <td className={pReturnAmount >= 0 ? 'text-success' : 'text-danger'}>
                    <div>{pReturnAmount >= 0 ? '+' : ''}{formatMoney(pReturnAmount, 'KRW')}</div>
                    <div style={{ fontSize: '0.85rem' }}>{pInvestKRW > 0 ? (pReturnAmount / pInvestKRW * 100).toFixed(2) : '0.00'}%</div>
                  </td>
                  <td>100.0%</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      )}
    </section>
  );
};
