/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef } from 'react';
import { Asset, SortConfig } from '../types/portfolio';
import { usePortfolio } from '../hooks/usePortfolio';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { useCalculations, getSortedAssets } from '../hooks/useCalculations';
import { formatMoney, COLORS } from '../utils/format';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

// UI Components
import { DashboardSummary } from '../components/DashboardSummary';
import { PortfolioSection } from '../components/PortfolioSection';
import { AssetStatusSection } from '../components/AssetStatusSection';
import { IndexStatusSection } from '../components/IndexStatusSection';
import { NewsSection } from '../components/NewsSection';

// Modals
import { PieModal } from '../components/modals/PortfolioPieModal';
import { ExchangeRateModal } from '../components/modals/ExchangeChartPopup';
import { AddStockModal } from '../components/modals/AddStockModal';
import { StockDetailModal } from '../components/modals/StockDetailModal';

export default function Home() {
  const {
    isMounted, portfolios, setPortfolios, currentPortfolioId, setCurrentPortfolioId,
    handleAddPortfolio, handleRenamePortfolio, handleDeletePortfolio,
    handleDeleteAsset, handleMoveAsset, handleEditAsset
  } = usePortfolio();

  const { exchangeRate, exchangeHistory, fetchExchangeRate } = useExchangeRate();
  const { totals } = useCalculations(portfolios, exchangeRate);

  const getCategoryColor = (name: string, index: number) => {
    if (name.includes('현금')) return '#f59e0b'; // Amber
    if (name.includes('커스텀')) return '#10b981'; // Green
    if (name.includes('한국')) return '#3b82f6'; // Blue
    if (name.includes('미국')) return '#8b5cf6'; // Purple
    return COLORS[index % COLORS.length];
  };

  // UI State
  const [activeMainTab, setActiveMainTab] = useState<'MANAGE' | 'ASSET' | 'INDEX' | 'NEWS'>('MANAGE');
  const [collapsedPortfolios, setCollapsedPortfolios] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState<number>(0);
  const [refreshingStockIds, setRefreshingStockIds] = useState<string[]>([]);
  const [pendingStockIds, setPendingStockIds] = useState<string[]>([]);

  // Modals State
  const [showPieModal, setShowPieModal] = useState(false);
  const [pieModalTitle, setPieModalTitle] = useState("");
  const [pieModalData, setPieModalData] = useState<{ name: string, value: number }[]>([]);

  const [showManageModal, setShowManageModal] = useState(false);
  const [showMoveSub, setShowMoveSub] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const [managingAssetInfo, setManagingAssetInfo] = useState<{ fromPid: string, asset: Asset } | null>(null);

  const [showExchangeModal, setShowExchangeModal] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState<Asset['type']>('KR_STOCK');

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });

  // Form State
  const [code, setCode] = useState('');
  const [actualCode, setActualCode] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Actions ---

  const handleRefreshPrices = async () => {
    setLoading(true);
    setRefreshIndex(0);

    try {
      await fetchExchangeRate();
      
      // 모든 계좌에서 종목별 자산 ID 매핑 (중복 업데이트용)
      const codeToAssetIds: { [code: string]: string[] } = {};
      portfolios.forEach(p => {
        p.assets.forEach(a => {
          if (a.type === 'KR_STOCK' || a.type === 'US_STOCK') {
            if (!codeToAssetIds[a.code]) {
              codeToAssetIds[a.code] = [a.id];
            } else {
              codeToAssetIds[a.code].push(a.id);
            }
          }
        });
      });

      // 화면에 보이는 순서(정렬 기준 적용)대로 고유 종목 리스트 생성
      const stockList: { code: string, type: 'KR_STOCK' | 'US_STOCK', assetIds: string[] }[] = [];
      const seenCodes = new Set<string>();

      portfolios.forEach(p => {
        // 현재 적용된 정렬 기준(sortConfig)으로 자산 정렬
        const sortedAssets = getSortedAssets(p.assets, sortConfig);
        
        sortedAssets.forEach(a => {
          if ((a.type === 'KR_STOCK' || a.type === 'US_STOCK') && !seenCodes.has(a.code)) {
            seenCodes.add(a.code);
            stockList.push({ code: a.code, type: a.type, assetIds: codeToAssetIds[a.code] });
          }
        });
      });

      const totalCount = stockList.length;
      if (totalCount === 0) { setLoading(false); return; }

      // UI 표시를 위해 모든 자산 ID를 대기열에 추가
      const allAssetIds = stockList.flatMap(s => s.assetIds);
      setPendingStockIds(allAssetIds);

      for (const stock of stockList) {
        // 해당 종목을 가진 모든 자산 ID를 로딩 상태로 변경
        setRefreshingStockIds(prev => [...prev, ...stock.assetIds]);
        setPendingStockIds(prev => prev.filter(id => !stock.assetIds.includes(id)));

        const countryParam = stock.type === 'US_STOCK' ? 'US' : 'KR';
        try {
          const res = await fetch(`/api/stock?code=${encodeURIComponent(stock.code)}&country=${countryParam}`);
          if (res.ok) {
            const data = await res.json();
            
            // 모든 포트폴리오에서 동일한 코드를 가진 자산을 일괄 업데이트
            setPortfolios(prev => prev.map(p => ({
              ...p,
              assets: p.assets.map(a => a.code === stock.code ? { ...a, currentPrice: data.currentPrice, changePercent: data.changePercent } : a)
            })));
          }
        } catch (err) {
          console.error(`[${stock.code}] 업데이트 실패:`, err);
        } finally {
          setRefreshingStockIds(prev => prev.filter(id => !stock.assetIds.includes(id)));
          setRefreshIndex(prev => prev + 1);
        }
      }
    } catch (error) {
      console.error("업데이트 실패:", error);
      alert('시세 새로고침 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setRefreshingStockIds([]);
      setPendingStockIds([]);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (addModalType !== 'CASH' && (!code || !avgPrice || !quantity)) return setErrorMsg('모든 필드를 입력해 주세요.');
    if (addModalType === 'CASH' && !quantity) return setErrorMsg('금액을 입력해 주세요.');

    setLoading(true);
    try {
      let newItem: Asset;
      if (addModalType === 'CASH') {
        const cashAmount = parseFloat(avgPrice);
        newItem = { id: Date.now().toString(), type: 'CASH', name: code || (currency === 'USD' ? '현금 (USD)' : '현금 (KRW)'), code: 'CASH', quantity: 1, avgPrice: cashAmount, currentPrice: cashAmount, currency };
      } else if (addModalType === 'CUSTOM') {
        newItem = { id: Date.now().toString(), type: 'CUSTOM', name: code, code: 'MANUAL', quantity: parseFloat(quantity), avgPrice: parseFloat(avgPrice), currentPrice: parseFloat(avgPrice), currency };
      } else {
        const finalCode = actualCode || code.trim();
        const country = addModalType === 'KR_STOCK' ? 'KR' : 'US';
        const res = await fetch(`/api/stock?code=${encodeURIComponent(finalCode)}&country=${country}&withName=true`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '항목 정보를 불러오지 못했습니다.');
        newItem = { id: Date.now().toString(), type: addModalType, code: data.code, name: data.name, currentPrice: data.currentPrice, changePercent: data.changePercent, currency: data.currency as 'KRW' | 'USD', avgPrice: parseFloat(avgPrice), quantity: parseFloat(quantity) };
      }

      setPortfolios(prev => prev.map(p => p.id === currentPortfolioId ? { ...p, assets: [...p.assets, newItem] } : p));
      setCode(''); setAvgPrice(''); setQuantity(''); setActualCode('');
      setShowAddModal(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const exportData = { version: '2.0', portfolios, timestamp: new Date().toISOString() };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.version === '2.0' && Array.isArray(json.portfolios)) {
          setPortfolios(json.portfolios);
          if (json.portfolios.length > 0) setCurrentPortfolioId(json.portfolios[0].id);
          alert('데이터를 성공적으로 불러왔습니다.');
        } else {
          throw new Error('지원하지 않는 파일 형식입니다. (V2 백업 파일 필요)');
        }
      } catch (error: any) {
        alert('오류 발생: ' + error.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('모든 데이터가 삭제됩니다. 초기화하시겠습니까?')) {
      const initPortfolio = { id: 'init-' + Date.now(), name: '나의 포트폴리오', assets: [{ id: 'cash-' + Date.now(), type: 'CASH' as const, name: '현금 (KRW)', code: 'CASH', quantity: 0, avgPrice: 1, currentPrice: 1, currency: 'KRW' as const }] };
      setPortfolios([initPortfolio]);
      setCurrentPortfolioId(initPortfolio.id);
      alert('초기화되었습니다.');
    }
  };

  if (!isMounted) return null; // Hydration 이슈 방지

  return (
    <main style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .clickable-stock-name:hover strong { color: #c4b5fd; }
      `}</style>

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem', textAlign: 'left', marginBottom: '10px', marginTop: 0 }}>내 자산 포트폴리오 Vibe</h1>
          <p className="text-secondary" style={{ textAlign: 'left', margin: 0 }}>주식부터 금현물까지, 실시간 자산 현황을 한눈에 관리하세요.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="glass-button" style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.2)', whiteSpace: 'nowrap' }} onClick={handleExport}>⬇️ 데이터 내보내기</button>
          <button className="glass-button" style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.2)', whiteSpace: 'nowrap' }} onClick={() => { if (confirm('기존 데이터가 덮어쓰기 됩니다.')) fileInputRef.current?.click(); }}>⬆️ 데이터 불러오기</button>
          <button className="glass-button" style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.2)', whiteSpace: 'nowrap' }} onClick={handleResetData}>🗑️ 초기화</button>
          <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportFileChange} style={{ display: 'none' }} />
        </div>
      </header>

      <div className="dashboard-grid">
        <DashboardSummary
          totalInvestmentKRW={totals.totalInvestmentKRW}
          totalCurrentValueKRW={totals.totalCurrentValueKRW}
          totalReturnAmountKRW={totals.totalReturnAmountKRW}
          totalReturnPercent={totals.totalReturnPercent}
          totalKRWAssets={totals.totalKRWAssets}
          totalUSDAssets={totals.totalUSDAssets}
          exchangeRate={exchangeRate}
          loading={loading}
          refreshIndex={refreshIndex}
          totalStockCount={new Set(portfolios.flatMap(p => p.assets.filter(a => a.type === 'KR_STOCK' || a.type === 'US_STOCK').map(a => a.code))).size}
          onRefreshPrices={handleRefreshPrices}
          onShowExchangeModal={() => setShowExchangeModal(true)}
        />

        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: '1.5rem' }}>📊 자산 비중</h2>
          <div className="pie-chart-container" style={{ width: '100%', height: '240px', marginBottom: '16px', cursor: 'pointer' }} onClick={() => { setPieModalTitle('전체 자산 비중'); setPieModalData(totals.totalPieData); setShowPieModal(true); }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={totals.totalPieData} cx="50%" cy="50%" innerRadius={70} outerRadius={110} paddingAngle={5} dataKey="value" stroke="none">
                  {totals.totalPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={getCategoryColor(entry.name, index)} />)}
                </Pie>
                <Tooltip formatter={(value: any) => formatMoney(Number(value), 'KRW')} contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="pie-chart-legend" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 16px', maxWidth: '400px', margin: '0 auto' }}>
            {totals.totalPieData.map((entry, index) => {
              const totalValue = totals.totalPieData.reduce((sum, e) => sum + e.value, 0);
              const percent = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
              return (
                <div key={`legend-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.85rem', background: 'rgba(255,255,255,0.03)', padding: '8px 12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getCategoryColor(entry.name, index), flexShrink: 0 }}></span>
                    <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }} title={entry.name}>{entry.name}</span>
                  </div>
                  <strong style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>{percent.toFixed(1)}%</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div style={{ position: 'sticky', top: '20px', zIndex: 100 }}>
        <div style={{ background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(10px)', padding: '6px', borderRadius: '20px', border: '1px solid rgba(255, 255, 255, 0.1)', display: 'flex', gap: '4px', boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)' }}>
          <button onClick={() => setActiveMainTab('MANAGE')} style={{ padding: '10px 24px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, transition: 'all 0.3s', background: activeMainTab === 'MANAGE' ? 'rgba(59, 130, 246, 0.8)' : 'transparent', color: activeMainTab === 'MANAGE' ? '#fff' : 'rgba(255, 255, 255, 0.6)' }}><span>📂</span> 계좌 관리</button>
          <button onClick={() => setActiveMainTab('ASSET')} style={{ padding: '10px 24px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, transition: 'all 0.3s', background: activeMainTab === 'ASSET' ? 'rgba(139, 92, 246, 0.8)' : 'transparent', color: activeMainTab === 'ASSET' ? '#fff' : 'rgba(255, 255, 255, 0.6)' }}><span>📊</span> 자산별 현황</button>
          <button onClick={() => setActiveMainTab('INDEX')} style={{ padding: '10px 24px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, transition: 'all 0.3s', background: activeMainTab === 'INDEX' ? 'rgba(16, 185, 129, 0.8)' : 'transparent', color: activeMainTab === 'INDEX' ? '#fff' : 'rgba(255, 255, 255, 0.6)' }}><span>📈</span> 지수 현황</button>
          <button onClick={() => setActiveMainTab('NEWS')} style={{ padding: '10px 24px', borderRadius: '16px', border: 'none', cursor: 'pointer', fontSize: '0.95rem', fontWeight: 600, transition: 'all 0.3s', background: activeMainTab === 'NEWS' ? 'rgba(245, 158, 11, 0.8)' : 'transparent', color: activeMainTab === 'NEWS' ? '#fff' : 'rgba(255, 255, 255, 0.6)' }}><span>📰</span> 뉴스</button>
        </div>
      </div>

      {activeMainTab === 'MANAGE' && (
        <>
          {portfolios.map(p => (
            <PortfolioSection
              key={p.id}
              portfolio={p}
              isCollapsed={!!collapsedPortfolios[p.id]}
              exchangeRate={exchangeRate}
              sortConfig={sortConfig}
              setSortConfig={setSortConfig}
              togglePortfolio={(id) => setCollapsedPortfolios(prev => ({ ...prev, [id]: !prev[id] }))}
              handleRenamePortfolio={handleRenamePortfolio}
              handleDeletePortfolio={handleDeletePortfolio}
              onShowPieChart={(p) => {
                setPieModalTitle(`${p.name} 비중 현황`);
                setPieModalData(p.assets.filter(a => a.currentPrice * a.quantity > 0).map(a => ({ name: a.name, value: (a.currentPrice * a.quantity) * (a.currency === 'USD' ? exchangeRate : 1) })));
                setCurrentPortfolioId(p.id);
                setShowPieModal(true);
              }}
              onAddAsset={(pId) => {
                setCurrentPortfolioId(pId);
                setAddModalType('KR_STOCK');
                setErrorMsg(''); setCode(''); setActualCode(''); setAvgPrice(''); setQuantity('');
                setShowAddModal(true);
              }}
              onShowDetail={(asset) => { setSelectedAsset(asset); setShowDetailModal(true); }}
              onManageAsset={(e, pId, asset) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setMenuPosition({ top: rect.bottom + window.scrollY + 8, left: rect.left + window.scrollX - 120 });
                setManagingAssetInfo({ fromPid: pId, asset });
                setShowManageModal(true);
                setShowMoveSub(false);
              }}
              saveEditAsset={handleEditAsset}
              refreshingStockIds={refreshingStockIds}
              pendingStockIds={pendingStockIds}
              showManageModal={showManageModal}
              managingAssetId={managingAssetInfo?.asset.id}
            />
          ))}
          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
            <button className="glass-button" style={{ padding: '16px 32px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', background: 'rgba(59, 130, 246, 0.3)' }} onClick={handleAddPortfolio}>
              <span style={{ fontSize: '1.5rem' }}>+</span> 새 포트폴리오 추가
            </button>
          </div>
        </>
      )}

      {activeMainTab === 'ASSET' && (
        <AssetStatusSection
          portfolios={portfolios}
          exchangeRate={exchangeRate}
          onShowPieChart={(title, data) => { setPieModalTitle(title); setPieModalData(data); setShowPieModal(true); }}
          onShowDetail={(asset) => { setSelectedAsset(asset); setShowDetailModal(true); }}
        />
      )}

      {activeMainTab === 'INDEX' && (
        <IndexStatusSection />
      )}

      {activeMainTab === 'NEWS' && (
        <NewsSection portfolios={portfolios} exchangeRate={exchangeRate} />
      )}

      {/* 플로팅 관리 메뉴 */}
      {showManageModal && managingAssetInfo && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 10000 }} onClick={() => { setShowManageModal(false); setShowMoveSub(false); }} />
          <div style={{ position: 'absolute', top: menuPosition.top, left: menuPosition.left, zIndex: 10001 }}>
            <div className="glass-panel" style={{ width: '160px', padding: '8px', background: '#1a1a1f', position: 'relative' }} onClick={e => e.stopPropagation()}>
              <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>{managingAssetInfo.asset.name}</div>
              {showMoveSub && (
                <div className="glass-panel" style={{ position: 'absolute', right: 'calc(100% + 8px)', top: '0', width: '180px', padding: '8px', background: '#1a1a1f' }}>
                  <div style={{ padding: '8px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', borderBottom: '1px solid rgba(255,255,255,0.05)', marginBottom: '4px' }}>이동할 대상 선택</div>
                  {portfolios.filter(p => p.id !== managingAssetInfo.fromPid).map(p => (
                    <button key={p.id} className="glass-button" style={{ background: 'transparent', border: 'none', textAlign: 'left', padding: '10px 12px', fontSize: '0.85rem' }} onClick={() => { handleMoveAsset(managingAssetInfo.fromPid, p.id, managingAssetInfo.asset.id); setShowManageModal(false); setShowMoveSub(false); }}>📁 {p.name}</button>
                  ))}
                </div>
              )}
              <button className="glass-button" style={{ background: showMoveSub ? 'rgba(59, 130, 246, 0.2)' : 'transparent', border: 'none', display: 'flex', justifyContent: 'space-between', padding: '10px 12px', fontSize: '0.9rem' }} onMouseEnter={() => setShowMoveSub(true)} onClick={(e) => { e.stopPropagation(); setShowMoveSub(!showMoveSub); }}><span>🚚 이동</span><span style={{ fontSize: '0.7rem' }}>▶</span></button>
              <button className="glass-button" style={{ background: 'transparent', border: 'none', color: '#ff5555', textAlign: 'left', padding: '10px 12px', fontSize: '0.9rem' }} onMouseEnter={() => setShowMoveSub(false)} onClick={(e) => { e.stopPropagation(); handleDeleteAsset(managingAssetInfo.fromPid, managingAssetInfo.asset.id); setShowManageModal(false); }}>🗑️ 삭제</button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <PieModal isOpen={showPieModal} onClose={() => setShowPieModal(false)} title={pieModalTitle} data={pieModalData} formatMoney={formatMoney} />
      <ExchangeRateModal isOpen={showExchangeModal} onClose={() => setShowExchangeModal(false)} exchangeHistory={exchangeHistory} exchangeRate={exchangeRate} />
      <AddStockModal isOpen={showAddModal} onClose={() => setShowAddModal(false)} type={addModalType} setType={setAddModalType} code={code} setCode={setCode} actualCode={actualCode} setActualCode={setActualCode} avgPrice={avgPrice} setAvgPrice={setAvgPrice} quantity={quantity} setQuantity={setQuantity} loading={loading} errorMsg={errorMsg} setErrorMsg={setErrorMsg} currency={currency} setCurrency={setCurrency} onSubmit={handleAddStock} />
      <StockDetailModal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} asset={selectedAsset} formatMoney={formatMoney} />
    </main>
  );
}
