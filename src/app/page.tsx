'use client';

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, Area } from 'recharts';

// 파이 차트 색상 팔레트: 각 자산의 비중을 시각적으로 구분하기 위해 사용합니다.
const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#84cc16'];

// 주식 및 자산 아이템의 데이터 구조 정의
interface StockItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  changePercent?: number;
  currency: 'KRW' | 'USD' | 'GOLD';
}

// 정렬을 위한 타입 정의
type SortKey = 'name' | 'quantity' | 'avgPrice' | 'currentPrice' | 'investment' | 'current' | 'returnAmount' | 'returnPercent';
type SortDirection = 'asc' | 'desc';

interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export default function Home() {
  // --- 상태 관리 (State Management) ---
  const [portfolio, setPortfolio] = useState<StockItem[]>([]); // 내 전체 포트폴리오 리스트
  const [cashKRW, setCashKRW] = useState<number>(0); // 한국 주식 계좌 현금
  const [cashUSD, setCashUSD] = useState<number>(0); // 미국 주식 계좌 현금
  const [cashGOLD, setCashGOLD] = useState<number>(0); // 금현물 관련 현금 (필요 시 사용)
  const [editingCashKRW, setEditingCashKRW] = useState(false);
  const [editingCashUSD, setEditingCashUSD] = useState(false);
  const [editingCashGOLD, setEditingCashGOLD] = useState(false);
  const [loading, setLoading] = useState(false); // 데이터 로딩 상태

  // 섹션 접기/펼치기 상태
  const [collapsedSections, setCollapsedSections] = useState<{[key: string]: boolean}>({
    KRW: false,
    USD: false,
    GOLD: false
  });

  // 실시간 환율 상태 (기본값 1400원)
  const [exchangeRate, setExchangeRate] = useState<number>(1400);
  const [exchangeHistory, setExchangeHistory] = useState<{date: string, rate: number}[]>([]); // [신규] 실제 환율 히스토리 데이터

  // 파이 차트 모달 노출 여부
  const [showPieKRW, setShowPieKRW] = useState(false);
  const [showPieUSD, setShowPieUSD] = useState(false);
  const [showPieGOLD, setShowPieGOLD] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false); // [신규] 환율 차트 모달 상태

  // 항목 추가 모달 상태
  const [showAddModal, setShowAddModal] = useState(false); // 추가 팝업 노출 여부
  const [addModalType, setAddModalType] = useState<'KR' | 'US'>('KR'); // 추가할 주식의 국가 유형

  // 주식 인라인 편집 상태 (표에서 직접 수정할 때 사용)
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editStockData, setEditStockData] = useState<{name: string, quantity: string, avgPrice: string, currentPrice: string}>({name: '', quantity: '', avgPrice: '', currentPrice: ''});

  // 정렬 상태 (기본값: 평가총액 기준 내림차순)
  const [sortConfigKRW, setSortConfigKRW] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });
  const [sortConfigUSD, setSortConfigUSD] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });
  const [sortConfigGOLD, setSortConfigGOLD] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });

  // 폼 입력 상태
  const [code, setCode] = useState(''); // 종목 코드
  const [avgPrice, setAvgPrice] = useState(''); // 매수 단가
  const [quantity, setQuantity] = useState(''); // 수량
  const [errorMsg, setErrorMsg] = useState(''); // 에러 메시지

  // --- 데이터 통신 및 효과 (Effects) ---

  // 외부 API를 통해 최신 환율 정보를 가져옵니다.
  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('/api/exchange-rate');
      const data = await res.json();
      if (res.ok && data.rate) {
        setExchangeRate(data.rate);
        if (data.history) {
          setExchangeHistory(data.history);
        }
        localStorage.setItem('stock_exchange_rate', data.rate.toString());
      }
    } catch (err) {
      console.error("환율 업데이트 실패:", err);
    }
  };

  // 1. 컴포넌트가 처음 나타날 때 실행: 로컬 스토리지에서 데이터를 복구합니다.
  useEffect(() => {
    const savedRate = localStorage.getItem('stock_exchange_rate');
    if (savedRate) {
      setExchangeRate(parseFloat(savedRate));
    }
    fetchExchangeRate();

    const saved = localStorage.getItem('stock_portfolio');
    let initialPortfolio: StockItem[] = [];
    if (saved) {
      initialPortfolio = JSON.parse(saved);
    }

    // 금 99.99_1kg 기본 항목이 없으면 추가해 줍니다. (샘플용)
    const hasDefaultGold = initialPortfolio.some(item => item.name === '금 99.99_1kg' && item.currency === 'GOLD');
    if (!hasDefaultGold) {
      initialPortfolio.push({
        id: 'default-gold-' + Date.now(),
        code: 'MANUAL',
        name: '금 99.99_1kg',
        quantity: 0,
        avgPrice: 0,
        currentPrice: 0,
        currency: 'GOLD'
      });
    }
    setPortfolio(initialPortfolio);

    const savedCash = localStorage.getItem('stock_cash');
    if (savedCash) {
      const parsed = JSON.parse(savedCash);
      setCashKRW(parsed.KRW || 0);
      setCashUSD(parsed.USD || 0);
      setCashGOLD(parsed.GOLD || 0);
    }
    
    const savedCollapsed = localStorage.getItem('stock_collapsed');
    if (savedCollapsed) {
      setCollapsedSections(JSON.parse(savedCollapsed));
    }
  }, []);

  // 2. 포트폴리오나 현금이 바뀔 때마다 로컬 스토리지에 자동 저장합니다.
  useEffect(() => {
    localStorage.setItem('stock_portfolio', JSON.stringify(portfolio));
  }, [portfolio]);

  useEffect(() => {
    localStorage.setItem('stock_cash', JSON.stringify({ KRW: cashKRW, USD: cashUSD, GOLD: cashGOLD }));
  }, [cashKRW, cashUSD, cashGOLD]);

  useEffect(() => {
    localStorage.setItem('stock_collapsed', JSON.stringify(collapsedSections));
  }, [collapsedSections]);

  // 섹션 접기/펼치기 토글
  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // --- 비즈니스 로직 (Handlers) ---

  // 주식 항목 추가 함수
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!code || !avgPrice || !quantity) {
      setErrorMsg('모든 필드를 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      // 서버 API를 호출하여 종목 정보를 가져옵니다.
      const res = await fetch(`/api/stock?code=${encodeURIComponent(code)}&country=${addModalType}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '항목 정보를 불러오지 못했습니다.');

      const newItem: StockItem = {
        id: Date.now().toString(),
        code: data.code,
        name: data.name,
        currentPrice: data.currentPrice,
        changePercent: data.changePercent,
        currency: data.currency as 'KRW' | 'USD',
        avgPrice: parseFloat(avgPrice),
        quantity: parseFloat(quantity),
      };

      setPortfolio((prev) => [...prev, newItem]);
      
      // 입력 폼 및 모달 초기화
      setCode(''); setAvgPrice(''); setQuantity('');
      setShowAddModal(false); 
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 항목 삭제
  const handleDelete = (id: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      setPortfolio(portfolio.filter(item => item.id !== id));
    }
  };

  // 전체 시세 업데이트
  const handleRefreshPrices = async () => {
    setLoading(true);
    try {
      await fetchExchangeRate();
      const updatedPortfolio = await Promise.all(
        portfolio.map(async (item) => {
          if (item.currency === 'GOLD') return item;
          const countryParam = item.currency === 'USD' ? 'US' : 'KR';
          const res = await fetch(`/api/stock?code=${encodeURIComponent(item.code)}&country=${countryParam}`);
          if (res.ok) {
            const data = await res.json();
            return { ...item, currentPrice: data.currentPrice, changePercent: data.changePercent };
          }
          return item;
        })
      );
      setPortfolio(updatedPortfolio);
    } catch (error) {
      console.error("업데이트 실패:", error);
    } finally {
      setLoading(false);
    }
  };

  // 인라인 편집 시작
  const startEditStock = (item: StockItem) => {
    setEditingStockId(item.id);
    setEditStockData({
      name: item.name,
      quantity: String(item.quantity),
      avgPrice: String(item.avgPrice),
      currentPrice: String(item.currentPrice)
    });
  };

  // 인라인 편집 저장
  const saveEditStock = (id: string) => {
    setPortfolio(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          name: editStockData.name || item.name,
          quantity: parseFloat(editStockData.quantity) || 0,
          avgPrice: parseFloat(editStockData.avgPrice) || 0,
          currentPrice: parseFloat(editStockData.currentPrice) || item.currentPrice
        };
      }
      return item;
    }));
    setEditingStockId(null);
  };

  // --- 자산 계산 로직 ---
  let totalStockInvestmentKRW = 0;
  let totalStockCurrentValueKRW = 0;
  portfolio.forEach(item => {
    const rate = item.currency === 'USD' ? exchangeRate : 1;
    totalStockInvestmentKRW += (item.avgPrice * item.quantity) * rate;
    totalStockCurrentValueKRW += (item.currentPrice * item.quantity) * rate;
  });

  const totalCashKRW = cashKRW + (cashUSD * exchangeRate) + cashGOLD;
  const totalInvestmentKRW = totalStockInvestmentKRW + totalCashKRW;
  const totalCurrentValueKRW = totalStockCurrentValueKRW + totalCashKRW;
  const totalReturnAmountKRW = totalCurrentValueKRW - totalInvestmentKRW;
  const totalReturnPercent = totalInvestmentKRW > 0 ? (totalReturnAmountKRW / totalInvestmentKRW) * 100 : 0;

  // 전체 자산 비중 데이터 구성 (상시 노출용)
  const totalPieData: { name: string, value: number }[] = [];
  const krwStocks = portfolio.filter(item => item.currency === 'KRW').reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
  const usdStocks = portfolio.filter(item => item.currency === 'USD').reduce((sum, item) => sum + (item.currentPrice * item.quantity * exchangeRate), 0);
  const goldStocks = portfolio.filter(item => item.currency === 'GOLD').reduce((sum, item) => sum + (item.currentPrice * item.quantity), 0);
  const cashTotal = totalCashKRW;

  if (krwStocks > 0) totalPieData.push({ name: '🇰🇷 한국 주식', value: krwStocks });
  if (usdStocks > 0) totalPieData.push({ name: '🇺🇸 미국 주식', value: usdStocks });
  if (goldStocks > 0) totalPieData.push({ name: '🏅 금현물', value: goldStocks });
  if (cashTotal > 0) totalPieData.push({ name: '💵 현금', value: cashTotal });
  totalPieData.sort((a, b) => b.value - a.value);

  // 금액 포맷팅 함수
  const formatMoney = (amount: number, currency: string) => {
    const displayCurrency = currency === 'GOLD' ? 'KRW' : currency;
    return new Intl.NumberFormat(displayCurrency === 'USD' ? 'en-US' : 'ko-KR', {
      style: 'currency',
      currency: displayCurrency
    }).format(amount);
  };

  // --- 컴포넌트: 비중 파이 차트 모달 (개별 섹션용) ---
  const PieModal = ({ isOpen, onClose, currency, cash }: { isOpen: boolean, onClose: () => void, currency: 'KRW' | 'USD' | 'GOLD', cash: number }) => {
    if (!isOpen) return null;
    const data = portfolio
      .filter(item => item.currency === currency)
      .map(item => ({ name: item.name, value: item.currentPrice * item.quantity }));
    if (cash > 0) data.push({ name: '💵 예수금 (현금)', value: cash });
    data.sort((a, b) => b.value - a.value);
    const total = data.reduce((sum, entry) => sum + entry.value, 0);

    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '550px', height: '650px', display: 'flex', flexDirection: 'column' }}>
          <button className="modal-close" onClick={onClose}>×</button>
          <h3 style={{ marginBottom: '16px', textAlign: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
            {currency === 'KRW' ? '🇰🇷 한국 주식 비중' : currency === 'USD' ? '🇺🇸 미국 주식 비중' : '🏅 금현물 비중'}
          </h3>
          <div style={{ width: '100%', height: '300px', flexShrink: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={5} dataKey="value" stroke="none">
                  {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatMoney(value, currency)} contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', marginTop: '16px', paddingRight: '8px' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {data.map((entry, index) => {
                const percent = total > 0 ? (entry.value / total) * 100 : 0;
                return (
                  <li key={`item-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0px', fontSize: '0.8rem', padding: '2px 4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length], display: 'inline-block', flexShrink: 0 }}></span>
                      <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }} title={entry.name}>{entry.name}</span>
                    </div>
                    <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{percent.toFixed(1)}%</strong>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // --- 컴포넌트: 환율 변동 차트 모달 ---
  const ExchangeRateModal = () => {
    if (!showExchangeModal) return null;

    // 데이터가 없을 경우를 대비한 방어 로직
    if (exchangeHistory.length === 0) {
      return (
        <div className="modal-overlay" onClick={() => setShowExchangeModal(false)}>
          <div className="modal-content" style={{ maxWidth: '600px', padding: '32px', textAlign: 'center' }}>
            <button className="modal-close" onClick={() => setShowExchangeModal(false)}>×</button>
            <p>환율 데이터를 불러오는 중입니다...</p>
          </div>
        </div>
      );
    }

    // 실제 히스토리 데이터를 차트 형식에 맞게 변환
    const chartData = exchangeHistory.map((item, index) => ({
      ...item,
      displayDate: index === exchangeHistory.length - 1 ? '오늘' : item.date,
      fullDate: item.date
    }));

    const minRate = Math.min(...chartData.map(d => d.rate)) - 5;
    const maxRate = Math.max(...chartData.map(d => d.rate)) + 5;

    return (
      <div className="modal-overlay" onClick={() => setShowExchangeModal(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', padding: '32px' }}>
          <button className="modal-close" onClick={() => setShowExchangeModal(false)}>×</button>
          <h3 style={{ marginBottom: '8px', fontSize: '1.5rem', textAlign: 'center' }}>🇺🇸 원/달러 환율 추이 (실제 데이터)</h3>
          <p className="text-secondary" style={{ textAlign: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>야후 파이낸스 기준 최근 30일간의 실제 환율 흐름입니다.</p>
          
          <div style={{ width: '100%', height: '300px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <defs>
                  <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="displayDate" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} 
                  interval={4} 
                  dy={10} 
                />
                <YAxis hide domain={[minRate, maxRate]} />
                <Tooltip 
                  labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '0.85rem' }}
                  contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                  labelFormatter={(label, payload) => {
                    if (label === '오늘') return `오늘 (${payload[0]?.payload.fullDate})`;
                    return label;
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === '환율영역') return [null, null];
                    return [`${value.toLocaleString()} 원`, '환율'];
                  }}
                />
                <Area type="monotone" dataKey="rate" name="환율영역" stroke="none" fillOpacity={1} fill="url(#colorRate)" />
                <Line 
                  type="monotone" 
                  dataKey="rate" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#0f172a' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: 'rgba(59, 130, 246, 0.1)', padding: '12px 24px', borderRadius: '16px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <span className="text-secondary" style={{ fontSize: '0.85rem' }}>현재 실시간 환율: </span>
              <strong style={{ fontSize: '1.2rem', color: '#3b82f6' }}>{exchangeRate.toLocaleString()} KRW</strong>
            </div>
          </div>
        </div>
      </div>
    );
  };
  const AddStockModal = () => {
    if (!showAddModal) return null;

    return (
      <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px', padding: '32px' }}>
          <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
          <h3 style={{ marginBottom: '24px', fontSize: '1.5rem', textAlign: 'center' }}>
            {addModalType === 'KR' ? '🇰🇷 한국 주식 추가' : '🇺🇸 미국 주식 추가'}
          </h3>
          
          <form onSubmit={handleAddStock} className="flex-col" style={{ gap: '20px', width: '100%' }}>
            {/* 종목 코드 입력란 */}
            <div className="input-group" style={{ marginBottom: 0, width: '100%' }}>
              <label className="input-label">종목 코드 (예: 005930, AAPL)</label>
              <input 
                type="text" 
                className="glass-input" 
                placeholder={addModalType === 'KR' ? "예: 005930" : "예: AAPL"} 
                value={code} 
                onChange={(e) => setCode(e.target.value)} 
                style={{ width: '100%', boxSizing: 'border-box' }}
                autoFocus
              />
            </div>
            
            {/* 매수 단가 및 보유 수량 (한 줄에 배치) */}
            <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
              <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="input-label">매수 단가 ({addModalType === 'KR' ? '원' : '달러'})</label>
                <input 
                  type="number" 
                  step="any" 
                  className="glass-input" 
                  placeholder="0" 
                  value={avgPrice} 
                  onChange={(e) => setAvgPrice(e.target.value)} 
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
              <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
                <label className="input-label">보유 수량</label>
                <input 
                  type="number" 
                  step="any" 
                  className="glass-input" 
                  placeholder="0" 
                  value={quantity} 
                  onChange={(e) => setQuantity(e.target.value)} 
                  style={{ width: '100%', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {errorMsg && <p className="text-danger" style={{ fontSize: '0.875rem', textAlign: 'center', margin: 0 }}>{errorMsg}</p>}
            
            {/* 버튼 영역 */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '10px', width: '100%' }}>
              <button 
                type="button" 
                className="glass-button" 
                style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }} 
                onClick={() => setShowAddModal(false)}
              >
                취소
              </button>
              <button 
                type="submit" 
                className="glass-button" 
                style={{ flex: 2 }} 
                disabled={loading}
              >
                {loading ? '검색 중...' : '추가하기'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // --- 테이블 렌더링 함수 ---
  const renderStockTable = (
    currency: 'KRW' | 'USD' | 'GOLD', 
    title: string, 
    cash: number, 
    setCash: (val: number) => void, 
    isEditing: boolean, 
    setIsEditing: (val: boolean) => void,
    sortConfig: SortConfig | null,
    setSortConfig: (val: SortConfig | null) => void
  ) => {
    const isCollapsed = collapsedSections[currency === 'KRW' ? 'KRW' : currency === 'USD' ? 'USD' : 'GOLD'];
    const filteredPortfolio = portfolio.filter(item => item.currency === currency);
    let sectionStockValue = 0;
    let sectionStockInvestment = 0;
    filteredPortfolio.forEach(item => {
      sectionStockValue += (item.currentPrice * item.quantity);
      sectionStockInvestment += (item.avgPrice * item.quantity);
    });
    const sectionTotalValue = sectionStockValue + cash;

    const sortedPortfolio = [...filteredPortfolio].sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      let aVal: any = 0; let bVal: any = 0;
      const aInvest = a.avgPrice * a.quantity; const bInvest = b.avgPrice * b.quantity;
      const aCurrent = a.currentPrice * a.quantity; const bCurrent = b.currentPrice * b.quantity;
      switch(key) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'quantity': aVal = a.quantity; bVal = b.quantity; break;
        case 'avgPrice': aVal = a.avgPrice; bVal = b.avgPrice; break;
        case 'currentPrice': aVal = a.currentPrice; bVal = b.currentPrice; break;
        case 'investment': aVal = aInvest; bVal = bInvest; break;
        case 'current': aVal = aCurrent; bVal = bCurrent; break;
        case 'returnAmount': aVal = aCurrent - aInvest; bVal = bCurrent - bInvest; break;
        case 'returnPercent': aVal = (aCurrent - aInvest) / (aInvest || 1); bVal = (bCurrent - bInvest) / (bInvest || 1); break;
      }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    const handleSort = (key: SortKey) => {
      let direction: SortDirection = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
      if (!sortConfig || sortConfig.key !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '4px', fontSize: '0.7em' }}>↕</span>;
      return <span style={{ marginLeft: '4px', fontSize: '0.8em', color: 'var(--text-primary)' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    // 추가 버튼 핸들러
    const handleOpenAddModal = () => {
      setAddModalType(currency === 'KRW' ? 'KR' : 'US');
      setErrorMsg('');
      setShowAddModal(true);
    };

    return (
      <section className="glass-panel" style={{ marginTop: '32px' }}>
        <div className="flex-between" style={{ marginBottom: isCollapsed ? '0' : '24px' }}>
          <div 
            onClick={() => toggleSection(currency === 'KRW' ? 'KRW' : currency === 'USD' ? 'USD' : 'GOLD')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none' }}
          >
            <span style={{ fontSize: '1.2rem', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s' }}>▼</span>
            <h2 style={{ margin: 0 }}>{title}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
              <span className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 500 }}>평가 총액:</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{formatMoney(sectionTotalValue, currency)}</strong>
            </div>
            
            {/* 파이 차트 버튼 */}
            <button 
              className="glass-button" 
              style={{ width: '48px', height: '48px', padding: 0, borderRadius: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center' }} 
              onClick={() => currency === 'KRW' ? setShowPieKRW(true) : currency === 'USD' ? setShowPieUSD(true) : setShowPieGOLD(true)}
              title="비중 확인"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
            </button>

            {/* [수정] 추가 버튼: "+" 아이콘만 표시하고 초록색 계열로 변경 */}
            {(currency === 'KRW' || currency === 'USD') && (
              <button 
                className="glass-button" 
                style={{ 
                  width: '48px', 
                  height: '48px', 
                  padding: 0, 
                  borderRadius: '12px', 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  background: 'rgba(16, 185, 129, 0.4)', // 더 진한 초록색 배경
                  border: '1px solid rgba(16, 185, 129, 0.5)', // 더 선명한 테두리
                  color: '#fff' // 배경이 진해졌으므로 아이콘색을 흰색으로 변경하여 대비 강화
                }} 
                onClick={handleOpenAddModal}
                title="항목 추가"
              >
                <span style={{ fontSize: '1.8rem', fontWeight: '300', lineHeight: 1 }}>+</span>
              </button>
            )}
          </div>
        </div>
        
        {!isCollapsed && (
          <div className="glass-table-container">
            {sortedPortfolio.length === 0 && cash === 0 ? (
              <p className="text-secondary" style={{ textAlign: 'center', padding: '40px 0' }}>등록된 항목이 없습니다.</p>
            ) : (
              <table className="glass-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer', width: '250px' }} onClick={() => handleSort('name')}>항목명 <SortIcon columnKey="name" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('quantity')}>보유 수량 <SortIcon columnKey="quantity" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('avgPrice')}>매수 단가 <SortIcon columnKey="avgPrice" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('currentPrice')}>현재가 <SortIcon columnKey="currentPrice" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('investment')}>총 매수금액 <SortIcon columnKey="investment" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('current')}>평가총액 <SortIcon columnKey="current" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('returnAmount')}>수익금 <SortIcon columnKey="returnAmount" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('returnPercent')}>수익률 <SortIcon columnKey="returnPercent" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('current')}>비중 <SortIcon columnKey="current" /></th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPortfolio.map(item => {
                    const investment = item.avgPrice * item.quantity; const current = item.currentPrice * item.quantity;
                    const returnAmount = current - investment; const returnPercent = investment > 0 ? (returnAmount / investment) * 100 : 0;
                    const weightPercent = sectionTotalValue > 0 ? (current / sectionTotalValue) * 100 : 0;
                    return (
                      <tr key={item.id}>
                        <td>
                          {editingStockId === item.id ? (
                            <input 
                              type="text" 
                              className="glass-input" 
                              style={{ padding: '4px 8px', width: '150px', background: 'rgba(0,0,0,0.5)', fontWeight: 'bold' }}
                              value={editStockData.name}
                              onChange={(e) => setEditStockData({...editStockData, name: e.target.value})}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEditStock(item.id); if (e.key === 'Escape') setEditingStockId(null); }}
                              autoFocus
                            />
                          ) : (
                            <>
                              <strong 
                                onClick={() => startEditStock(item)}
                                style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px', cursor: 'pointer' }} 
                                title="클릭하여 이름 수정"
                              >
                                {item.name}
                              </strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.code}</div>
                            </>
                          )}
                        </td>
                        <td>{editingStockId === item.id ? <input type="number" step="any" className="glass-input" style={{ padding: '4px 8px', width: '80px', background: 'rgba(0,0,0,0.5)' }} value={editStockData.quantity} onChange={(e) => setEditStockData({...editStockData, quantity: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') saveEditStock(item.id); if (e.key === 'Escape') setEditingStockId(null); }} /> : <span onClick={() => startEditStock(item)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>{item.quantity.toLocaleString()}</span>}</td>
                        <td>{editingStockId === item.id ? <input type="number" step="any" className="glass-input" style={{ padding: '4px 8px', width: '100px', background: 'rgba(0,0,0,0.5)' }} value={editStockData.avgPrice} onChange={(e) => setEditStockData({...editStockData, avgPrice: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') saveEditStock(item.id); if (e.key === 'Escape') setEditingStockId(null); }} /> : <span onClick={() => startEditStock(item)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>{formatMoney(item.avgPrice, item.currency)}</span>}</td>
                        <td>{editingStockId === item.id && item.currency === 'GOLD' ? <input type="number" step="any" className="glass-input" style={{ padding: '4px 8px', width: '100px', background: 'rgba(0,0,0,0.5)' }} value={editStockData.currentPrice} onChange={(e) => setEditStockData({...editStockData, currentPrice: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') saveEditStock(item.id); if (e.key === 'Escape') setEditingStockId(null); }} /> : <div onClick={() => item.currency === 'GOLD' && startEditStock(item)} style={{ cursor: item.currency === 'GOLD' ? 'pointer' : 'default' }}><div>{formatMoney(item.currentPrice, item.currency)}</div>{item.currency !== 'GOLD' && <div className={(item.changePercent || 0) >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '0.75rem', marginTop: '4px' }}>{(item.changePercent || 0) >= 0 ? '+' : ''}{(item.changePercent || 0).toFixed(2)}%</div>}</div>}</td>
                        <td>{formatMoney(investment, item.currency)}</td>
                        <td>{formatMoney(current, item.currency)}</td>
                        <td className={returnAmount >= 0 ? 'text-success' : 'text-danger'}>{returnAmount >= 0 ? '+' : ''}{formatMoney(returnAmount, item.currency)}</td>
                        <td className={returnPercent >= 0 ? 'text-success' : 'text-danger'}>{returnPercent >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%</td>
                        <td>{weightPercent.toFixed(1)}%</td>
                        <td style={{ textAlign: 'center' }}>
                          <button 
                            onClick={() => handleDelete(item.id)} 
                            disabled={item.currency === 'GOLD'} 
                            style={{ 
                              background: item.currency === 'GOLD' ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.35)', // 더 진한 빨간색 배경
                              color: item.currency === 'GOLD' ? 'rgba(255,255,255,0.1)' : '#fff', // 배경이 진해졌으므로 흰색으로 변경
                              border: '1px solid ' + (item.currency === 'GOLD' ? 'rgba(255,255,255,0.05)' : 'rgba(239, 68, 68, 0.4)'),
                              padding: '0', 
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px', 
                              cursor: item.currency === 'GOLD' ? 'not-allowed' : 'pointer', 
                              opacity: item.currency === 'GOLD' ? 0.3 : 1,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.2s'
                            }} 
                            title={item.currency === 'GOLD' ? "금현물은 삭제할 수 없습니다" : "항목 삭제"}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18"></path>
                              <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                              <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <td><strong>💵 예수금 (현금)</strong><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CASH</div></td><td>-</td><td>-</td><td>-</td><td>{formatMoney(cash, currency)}</td><td>{isEditing ? <input type="number" className="glass-input" style={{ padding: '6px 10px', width: '130px', background: 'rgba(0,0,0,0.5)', textAlign: 'right' }} value={cash === 0 ? '' : cash} onChange={(e) => setCash(parseFloat(e.target.value) || 0)} onBlur={() => setIsEditing(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)} autoFocus placeholder="0" /> : <span onClick={() => setIsEditing(true)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>{formatMoney(cash, currency)}</span>}</td><td>-</td><td>-</td><td>{sectionTotalValue > 0 ? ((cash / sectionTotalValue) * 100).toFixed(1) : '0.0'}%</td><td></td>
                  </tr>
                </tbody>
                <tfoot style={{ background: 'rgba(255,255,255,0.05)', fontWeight: 'bold' }}>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right' }}>총 합계</td>
                    <td>{formatMoney(sectionStockInvestment + cash, currency)}</td>
                    <td>{formatMoney(sectionTotalValue, currency)}</td>
                    <td className={sectionStockValue - sectionStockInvestment >= 0 ? 'text-success' : 'text-danger'}>{sectionStockValue - sectionStockInvestment >= 0 ? '+' : ''}{formatMoney(sectionStockValue - sectionStockInvestment, currency)}</td>
                    <td className={sectionStockValue - sectionStockInvestment >= 0 ? 'text-success' : 'text-danger'}>{(sectionStockInvestment + cash) > 0 ? (sectionStockValue - sectionStockInvestment >= 0 ? '+' : '') + ((sectionStockValue - sectionStockInvestment) / (sectionStockInvestment + cash) * 100).toFixed(2) + '%' : '0.00%'}</td>
                    <td>100.0%</td><td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </section>
    );
  };

  return (
    <main style={{ padding: '40px 20px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 헤더 섹션 */}
      <header style={{ textAlign: 'center', marginBottom: '48px' }}>
        <h1 className="gradient-text" style={{ fontSize: '2.5rem' }}>내 자산 포트폴리오 Vibe</h1>
        <p className="text-secondary">주식부터 금현물까지, 실시간 자산 현황을 한눈에 관리하세요.</p>
      </header>

      {/* 요약 대시보드 - 좌우 패널 분리 레이아웃 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 450px', gap: '24px', marginBottom: '32px', alignItems: 'stretch' }}>
        
        {/* 왼쪽 패널: 전체 자산 수치 요약 - 프리미엄 디자인 적용 */}
        <section className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* 상단 헤더 영역 */}
          <div className="flex-between" style={{ alignItems: 'flex-start' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '1.8rem' }}>💎</span> 전체 자산 요약
              </h2>
              <p className="text-secondary" style={{ marginTop: '4px', fontSize: '0.9rem' }}>실시간 시세와 환율이 반영된 총 자산 현황입니다.</p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
              <div 
                onClick={() => setShowExchangeModal(true)}
                style={{ 
                  fontSize: '0.875rem', 
                  color: 'var(--text-secondary)', 
                  background: 'rgba(255,255,255,0.05)', 
                  padding: '6px 16px', 
                  borderRadius: '20px', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                className="hover-bright"
                title="환율 변동 차트 보기"
              >
                <span style={{ color: '#3b82f6' }}>●</span> 환율: 1 USD = {exchangeRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} KRW
              </div>
              <button className="glass-button" style={{ width: 'auto', padding: '8px 20px', fontSize: '0.875rem', borderRadius: '12px' }} onClick={handleRefreshPrices} disabled={loading}>
                {loading ? '업데이트 중...' : '🔄 시세 새로고침'}
              </button>
            </div>
          </div>
          
          {/* 중앙 핵심 지표 영역 (카드 스타일) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            
            {/* 총 투자 원금 카드 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#3b82f6' }}>
                  💰
                </div>
                <span className="text-secondary" style={{ fontSize: '0.9rem', fontWeight: 500 }}>총 투자 원금</span>
              </div>
              <strong style={{ fontSize: '1.6rem', letterSpacing: '-0.5px' }}>{formatMoney(totalInvestmentKRW, 'KRW')}</strong>
            </div>

            {/* 총 평가 금액 카드 (강조) */}
            <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(59, 130, 246, 0.2)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#8b5cf6' }}>
                  📈
                </div>
                <span className="text-secondary" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a78bfa' }}>총 평가 금액</span>
              </div>
              <strong style={{ fontSize: '2rem', color: '#fff', letterSpacing: '-1px' }}>{formatMoney(totalCurrentValueKRW, 'KRW')}</strong>
            </div>

            {/* 수익금 / 수익률 카드 */}
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: totalReturnAmountKRW >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  {totalReturnAmountKRW >= 0 ? '🔥' : '❄️'}
                </div>
                <span className="text-secondary" style={{ fontSize: '0.9rem', fontWeight: 500 }}>총 수익 현황</span>
              </div>
              <div className="flex-col" style={{ gap: '4px' }}>
                <strong className={totalReturnAmountKRW >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '1.6rem' }}>
                  {totalReturnAmountKRW >= 0 ? '+' : ''}{formatMoney(totalReturnAmountKRW, 'KRW')}
                </strong>
                <div className={totalReturnPercent >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {totalReturnPercent >= 0 ? '▲' : '▼'} {totalReturnPercent.toFixed(2)}%
                </div>
              </div>
            </div>
          </div>

          {/* 하단 상세 현황 (현금 및 통화별) */}
          <div style={{ paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '1.5rem' }}>🇰🇷</div>
              <div>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '2px' }}>원화 자산 (현금 포함)</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatMoney(portfolio.filter(i=>i.currency==='KRW').reduce((s,i)=>s+(i.currentPrice*i.quantity),0) + cashKRW + cashGOLD, 'KRW')}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '1.5rem' }}>🇺🇸</div>
              <div>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '2px' }}>외화 자산 (USD 환산)</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatMoney(portfolio.filter(i=>i.currency==='USD').reduce((s,i)=>s+(i.currentPrice*i.quantity),0) + cashUSD, 'USD')}</span>
                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>(≈ {formatMoney((portfolio.filter(i=>i.currency==='USD').reduce((s,i)=>s+(i.currentPrice*i.quantity),0) + cashUSD) * exchangeRate, 'KRW')})</span>
                </div>
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,215,0,0.05)', padding: '8px 20px', borderRadius: '16px', border: '1px solid rgba(255,215,0,0.1)' }}>
              <div style={{ fontSize: '1.5rem' }}>💵</div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '2px' }}>총 보유 현금 합계</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f59e0b' }}>{formatMoney(totalCashKRW, 'KRW')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* 오른쪽 패널: 자산 배분 현황 (파이 차트) */}
        <section className="glass-panel" style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ margin: '0 0 24px 0', fontSize: '1.25rem', textAlign: 'center', width: '100%' }}>자산 배분 현황</h2>
          <div style={{ width: '100%', height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={totalPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={5} dataKey="value" stroke="none">
                  {totalPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(value: number) => formatMoney(value, 'KRW')} contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ width: '100%', marginTop: '24px' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {totalPieData.map((entry, index) => {
                const totalValue = totalPieData.reduce((sum, item) => sum + item.value, 0);
                const percent = totalValue > 0 ? (entry.value / totalValue) * 100 : 0;
                return (
                  <li key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}>
                    <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></span>
                    <span className="text-secondary" style={{ whiteSpace: 'nowrap' }}>{entry.name}</span>
                    <strong style={{ marginLeft: 'auto' }}>{percent.toFixed(1)}%</strong>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>

      </div>

      {/* 각 자산별 테이블 섹션 */}
      {renderStockTable('USD', '🇺🇸 미국 주식 포트폴리오 (USD)', cashUSD, setCashUSD, editingCashUSD, setEditingCashUSD, sortConfigUSD, setSortConfigUSD)}
      {renderStockTable('KRW', '🇰🇷 한국 주식 포트폴리오 (KRW)', cashKRW, setCashKRW, editingCashKRW, setEditingCashKRW, sortConfigKRW, setSortConfigKRW)}
      {renderStockTable('GOLD', '🏅 금현물 포트폴리오 (수동 관리)', cashGOLD, setCashGOLD, editingCashGOLD, setEditingCashGOLD, sortConfigGOLD, setSortConfigGOLD)}

      {/* 각종 모달들 */}
      <PieModal isOpen={showPieKRW} onClose={() => setShowPieKRW(false)} currency="KRW" cash={cashKRW} />
      <PieModal isOpen={showPieUSD} onClose={() => setShowPieUSD(false)} currency="USD" cash={cashUSD} />
      <PieModal isOpen={showPieGOLD} onClose={() => setShowPieGOLD(false)} currency="GOLD" cash={cashGOLD} />
      
      <ExchangeRateModal />
      
      {/* 항목 추가 모달 */}
      <AddStockModal />
    </main>
  );
}
