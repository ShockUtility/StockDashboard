/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useRef, useEffect } from 'react';
import { Asset, SortConfig } from '../types/portfolio';
import { usePortfolio } from '../hooks/usePortfolio';
import { useExchangeRate } from '../hooks/useExchangeRate';
import { useCalculations, getSortedAssets } from '../hooks/useCalculations';
import { formatMoney, COLORS } from '../utils/format';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Menu, Landmark, DollarSign, TrendingUp, Calendar } from 'lucide-react';

// UI Components
import { DashboardSummary } from '../components/DashboardSummary';
import { PortfolioSection } from '../components/PortfolioSection';
import { AssetStatusSection } from '../components/AssetStatusSection';
import { IndexStatusSection } from '../components/IndexStatusSection';
// [교육용 주석] 신규 추가한 주요일정 메인 UI 섹션을 임포트합니다.
import { ScheduleSection } from '../components/ScheduleSection';

// Modals
import { PieModal } from '../components/modals/PortfolioPieModal';
import { ExchangeRateModal } from '../components/modals/ExchangeChartPopup';
import { AddStockModal } from '../components/modals/AddStockModal';
import { StockDetailModal } from '../components/modals/StockDetailModal';

// Hooks
// [교육용 주석] 신규 추가한 일정 관리 커스텀 훅을 임포트합니다.
import { useSchedule } from '../hooks/useSchedule';

export default function Home() {
  const {
    isMounted, portfolios, setPortfolios, currentPortfolioId, setCurrentPortfolioId,
    handleAddPortfolio, handleRenamePortfolio, handleDeletePortfolio,
    handleDeleteAsset, handleMoveAsset, handleEditAsset
  } = usePortfolio();

  const { exchangeRate, exchangeHistory, fetchExchangeRate } = useExchangeRate();
  const { totals } = useCalculations(portfolios, exchangeRate);

  // [교육용 주석] 일정 관련 상태와 제어 함수들을 가져옵니다.
  const {
    schedules, setSchedules, addSchedule, editSchedule, deleteSchedule, deleteSchedulesByStock, mergeAISchedules
  } = useSchedule();

  // 페이지가 브라우저에 처음 보여졌을 때(마운트될 때) 
  // 백그라운드에서 주식 종목 캐시를 갱신하도록 요청합니다.
  useEffect(() => {
    fetch('/api/update-stock-cache')
      .then(res => res.json())
      .then(data => {
        if (data.status === 'updating') {
          console.log('🚀 주식 캐시 갱신이 백그라운드에서 시작되었습니다.');
        } else if (data.status === 'ok') {
          console.log('✅ 주식 캐시가 이미 최신 상태입니다.');
        }
      })
      .catch(err => {
        console.error('❌ 캐시 갱신 요청 중 오류 발생:', err);
      });
  }, []);

  const getCategoryColor = (name: string, index: number) => {
    if (name.includes('현금')) return '#f59e0b'; // Amber
    if (name.includes('기타')) return '#10b981'; // Green
    if (name.includes('한국')) return '#3b82f6'; // Blue
    if (name.includes('미국')) return '#8b5cf6'; // Purple
    return COLORS[index % COLORS.length];
  };

  // UI State
  // [교육용 주석] 탭 상태 타입에 'SCHEDULE' (주요일정)을 추가해 줍니다.
  const [activeMainTab, setActiveMainTab] = useState<'MANAGE' | 'ASSET' | 'INDEX' | 'SCHEDULE'>('MANAGE');
  const [collapsedPortfolios, setCollapsedPortfolios] = useState<{ [key: string]: boolean }>({});
  const [loading, setLoading] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState<number>(0);
  const [refreshingStockIds, setRefreshingStockIds] = useState<string[]>([]);
  const [pendingStockIds, setPendingStockIds] = useState<string[]>([]);

  // Modals State
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
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

  // Form State
  const [code, setCode] = useState('');
  const [actualCode, setActualCode] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [currency, setCurrency] = useState<'KRW' | 'USD'>('KRW');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Actions ---

  const handleSortAssets = (pId: string, sortConfig: SortConfig) => {
    setPortfolios(prev => prev.map(p => {
      if (p.id === pId) {
        return {
          ...p,
          sortConfig,
          assets: getSortedAssets(p.assets, sortConfig, exchangeRate)
        };
      }
      return p;
    }));
  };

  const handleRefreshPrices = async () => {
    setLoading(true);
    setRefreshIndex(0);

    try {
      await fetchExchangeRate();

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

      const stockList: { code: string, type: 'KR_STOCK' | 'US_STOCK', assetIds: string[] }[] = [];
      const seenCodes = new Set<string>();

      portfolios.forEach(p => {
        p.assets.forEach(a => {
          if ((a.type === 'KR_STOCK' || a.type === 'US_STOCK') && !seenCodes.has(a.code)) {
            seenCodes.add(a.code);
            stockList.push({ code: a.code, type: a.type, assetIds: codeToAssetIds[a.code] });
          }
        });
      });

      const totalCount = stockList.length;
      if (totalCount === 0) { setLoading(false); return; }

      const allAssetIds = stockList.flatMap(s => s.assetIds);
      setPendingStockIds(allAssetIds);

      for (const stock of stockList) {
        setRefreshingStockIds(prev => [...prev, ...stock.assetIds]);
        setPendingStockIds(prev => prev.filter(id => !stock.assetIds.includes(id)));

        const countryParam = stock.type === 'US_STOCK' ? 'US' : 'KR';
        try {
          const res = await fetch(`/api/stock?code=${encodeURIComponent(stock.code)}&country=${countryParam}`);
          if (res.ok) {
            const data = await res.json();

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

      setPortfolios(prev => prev.map(p => {
        if (p.sortConfig) {
          return {
            ...p,
            assets: getSortedAssets(p.assets, p.sortConfig, exchangeRate)
          };
        }
        return p;
      }));

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

  // [교육용 주석] 백업 내보내기 시 일정(schedules)도 함께 묶어서 버전 3.0으로 포맷을 확장합니다.
  const handleExport = () => {
    const exportData = {
      version: '3.0',
      portfolios,
      schedules,
      timestamp: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `portfolio_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  // [교육용 주석] 백업 가져오기 시 이전 버전 2.0(포트폴리오만 존재)과 신규 버전 3.0을 모두 유연하게 불러오도록 호환성을 제공합니다.
  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);

        if (json.version === '3.0' && Array.isArray(json.portfolios)) {
          setPortfolios(json.portfolios);
          if (json.schedules && Array.isArray(json.schedules)) {
            setSchedules(json.schedules);
          } else {
            setSchedules([]);
          }
          if (json.portfolios.length > 0) setCurrentPortfolioId(json.portfolios[0].id);
          alert('데이터를 성공적으로 불러왔습니다. (포트폴리오 & 일정 복원 완료)');
        } else if (json.version === '2.0' && Array.isArray(json.portfolios)) {
          // 기존 구버전 파일(포트폴리오만 저장됨) 불러오기 시 하위 호환 처리
          setPortfolios(json.portfolios);
          setSchedules([]); // 일정 목록은 빈 값으로 초기화
          if (json.portfolios.length > 0) setCurrentPortfolioId(json.portfolios[0].id);
          alert('버전 2.0 데이터를 불러왔습니다. (포트폴리오는 복원되었으며 일정은 초기 상태로 세팅되었습니다.)');
        } else {
          throw new Error('지원하지 않는 파일 형식입니다. (V2 또는 V3 포맷의 백업 JSON 파일이 필요합니다.)');
        }
      } catch (error: any) {
        alert('오류 발생: ' + error.message);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  // [교육용 주석] 데이터 초기화 시 포트폴리오뿐만 아니라 일정도 함께 지워지도록 기능을 갱신합니다.
  const handleResetData = () => {
    if (confirm('모든 데이터(포트폴리오 및 등록된 일정)가 삭제됩니다. 초기화하시겠습니까?')) {
      const initPortfolio = { id: 'init-' + Date.now(), name: '나의 포트폴리오', assets: [{ id: 'cash-' + Date.now(), type: 'CASH' as const, name: '현금 (KRW)', code: 'CASH', quantity: 0, avgPrice: 1, currentPrice: 1, currency: 'KRW' as const }] };
      setPortfolios([initPortfolio]);
      setSchedules([]); // 일정도 모두 지워 빈 배열로 만듭니다.
      setCurrentPortfolioId(initPortfolio.id);
      alert('초기화되었습니다.');
    }
  };

  if (!isMounted) return null;

  return (
    <main style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto', position: 'relative' }}>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .clickable-stock-name:hover strong { color: #c4b5fd; }
      `}</style>

      {/* [교육용 주석] 
          설정 메뉴를 헤더에서 분리하여 position: fixed로 화면 우측 상단에 항상 고정 배치합니다.
          스크롤을 해도 화면에 떠 있어 언제든 메뉴에 접근할 수 있습니다. */}
      <div className="settings-menu-container">
        <button
          className="glass-button"
          style={{
            padding: '10px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: '1px solid var(--glass-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '42px',
            height: '42px'
          }}
          onClick={() => setShowSettingsMenu(!showSettingsMenu)}
          aria-label="설정 메뉴"
        >
          <Menu size={20} color="white" strokeWidth={2} />
        </button>

        {showSettingsMenu && (
          <>
            {/* 뒷배경 클릭 시 닫히도록 투명 오버레이 배치 */}
            <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onClick={() => setShowSettingsMenu(false)} />
            <div className={`settings-dropdown ${showSettingsMenu ? 'show' : ''}`} style={{ zIndex: 1000 }}>
              <button className="settings-menu-item" onClick={() => { setShowSettingsMenu(false); handleExport(); }}>
                ⬇️ 데이터 내보내기
              </button>
              <button className="settings-menu-item" onClick={() => { setShowSettingsMenu(false); if (confirm('기존 데이터가 덮어쓰기 됩니다.')) fileInputRef.current?.click(); }}>
                ⬆️ 데이터 불러오기
              </button>
              <button className="settings-menu-item danger" onClick={() => { setShowSettingsMenu(false); handleResetData(); }}>
                🗑️ 초기화
              </button>
            </div>
          </>
        )}
        <input type="file" accept=".json" ref={fileInputRef} onChange={handleImportFileChange} style={{ display: 'none' }} />
      </div>

      <header style={{ marginBottom: '48px' }}>
        <h1 className="gradient-text" style={{ fontSize: '2.5rem', textAlign: 'left', marginBottom: '10px', marginTop: 0 }}>자산 포트폴리오</h1>
        <p className="text-secondary" style={{ textAlign: 'left', margin: 0 }}>주식부터 금현물까지, 실시간 자산 현황을 한눈에 관리하세요.</p>
      </header>

      <div className="dashboard-grid" style={{ marginBottom: '32px' }}>
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
          <div className="pie-chart-legend" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 10px', maxWidth: '100%', margin: '0 auto' }}>
            {totals.totalPieData.map((entry, index) => {
              const totalValue = totals.totalPieData.reduce((sum, e) => sum + e.value, 0);
              const percent = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
              return (
                <div key={`legend-${index}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.7rem', background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: getCategoryColor(entry.name, index), flexShrink: 0 }}></span>
                    <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70px' }} title={entry.name}>{entry.name}</span>
                  </div>
                  <strong style={{ color: 'var(--text-secondary)', marginLeft: '4px' }}>{percent.toFixed(1)}%</strong>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div style={{ position: 'sticky', top: '0', zIndex: 100, backdropFilter: 'blur(10px)', marginBottom: '32px', paddingTop: '20px' }}>
        {/* [교육용 주석] 탭 버튼 간의 좌우 갭(gap)을 6px에서 4px로 좁혀 좁은 공간에서도 가독성을 극대화하도록 정렬했습니다. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 4px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
          {/* 
              [교육용 주석] 
              1. 탭 버튼의 글자 크기를 1rem(16px)에서 0.9rem(14.4px)으로 축소하여 콤팩트하고 스마트한 느낌을 주었습니다.
              2. 이에 맞춰 lucide-react의 아이콘 크기도 size={16}에서 size={14}로 동반 축소하여 시각적 밸런스를 맞췄습니다.
              3. 탭 버튼의 좌우 패딩을 6px에서 4px로, 아이콘과 텍스트 사이의 갭을 4px에서 3px로 좁게 세밀하게 가다듬었습니다.
          */}
          <button
            onClick={() => setActiveMainTab('MANAGE')}
            style={{
              background: 'none',
              border: 'none',
              color: activeMainTab === 'MANAGE' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 4px',
              transition: 'all 0.3s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <Landmark size={14} strokeWidth={2.5} />
            계좌관리
            {activeMainTab === 'MANAGE' && (
              <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: 'var(--accent-blue)' }} />
            )}
          </button>
          <button
            onClick={() => setActiveMainTab('ASSET')}
            style={{
              background: 'none',
              border: 'none',
              color: activeMainTab === 'ASSET' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 4px',
              transition: 'all 0.3s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <DollarSign size={14} strokeWidth={2.5} />
            자산현황
            {activeMainTab === 'ASSET' && (
              <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: 'var(--accent-blue)' }} />
            )}
          </button>
          <button
            onClick={() => setActiveMainTab('INDEX')}
            style={{
              background: 'none',
              border: 'none',
              color: activeMainTab === 'INDEX' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 4px',
              transition: 'all 0.3s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <TrendingUp size={14} strokeWidth={2.5} />
            지수현황
            {activeMainTab === 'INDEX' && (
              <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: 'var(--accent-blue)' }} />
            )}
          </button>
          {/* [교육용 주석] 상단 메인 내비게이션 탭 영역에 "주요일정" 버튼을 연동합니다. */}
          <button
            onClick={() => setActiveMainTab('SCHEDULE')}
            style={{
              background: 'none',
              border: 'none',
              color: activeMainTab === 'SCHEDULE' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 4px',
              transition: 'all 0.3s',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px'
            }}
          >
            <Calendar size={14} strokeWidth={2.5} />
            주요일정
            {activeMainTab === 'SCHEDULE' && (
              <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: 'var(--accent-blue)' }} />
            )}
          </button>
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
              onSortAssets={handleSortAssets}
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
        <IndexStatusSection
          externalExchangeRate={exchangeRate}
          onRefreshExchangeRate={fetchExchangeRate}
        />
      )}

      {/* [교육용 주석] 활성화된 탭이 'SCHEDULE' 일 때 스케줄 섹션 컴포넌트를 렌더링합니다. */}
      {activeMainTab === 'SCHEDULE' && (
        <ScheduleSection
          portfolios={portfolios}
          schedules={schedules}
          addSchedule={addSchedule}
          editSchedule={editSchedule}
          deleteSchedule={deleteSchedule}
          deleteSchedulesByStock={deleteSchedulesByStock}
          mergeAISchedules={mergeAISchedules}
        />
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
