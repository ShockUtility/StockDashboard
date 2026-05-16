'use client';

import { useState, useEffect, useRef } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend, LineChart, Line, XAxis, YAxis, Area, AreaChart, ReferenceLine, ComposedChart, Bar } from 'recharts';

// 파이 차트 색상 팔레트: 각 자산의 비중을 시각적으로 구분하기 위해 사용합니다.
const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#6366f1', '#14b8a6', '#84cc16'];

// 날짜 포맷터 함수 (예: 5월 13일 (수))
const formatDateLabel = (dateStr: string) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${dayNames[date.getDay()]})`;
};

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

// --- 모달 컴포넌트용 Props 인터페이스 정의 ---
interface PieModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency: 'KRW' | 'USD' | 'GOLD';
  cash: number;
  portfolio: StockItem[];
  formatMoney: (val: number, cur: string) => string;
}

interface ExchangeRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  exchangeHistory: {date: string, rate: number}[];
  exchangeRate: number;
}

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'KR' | 'US';
  code: string;
  setCode: (val: string) => void;
  actualCode: string;
  setActualCode: (val: string) => void;
  avgPrice: string;
  setAvgPrice: (val: string) => void;
  quantity: string;
  setQuantity: (val: string) => void;
  loading: boolean;
  errorMsg: string;
  onSubmit: (e: React.FormEvent) => void;
}

interface StockDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  stock: StockItem | null;
  formatMoney: (val: number, cur: string) => string;
}

export default function Home() {
  // --- 상태 관리 (State Management) ---
  const [isMounted, setIsMounted] = useState(false); // [신규] 클라이언트 사이드 마운트 확인용
  const [portfolio, setPortfolio] = useState<StockItem[]>([]); // 내 전체 포트폴리오 리스트
  const [cashKRW, setCashKRW] = useState<number>(0); // 한국 주식 계좌 현금
  const [cashUSD, setCashUSD] = useState<number>(0); // 미국 주식 계좌 현금
  const [cashGOLD, setCashGOLD] = useState<number>(0); // 금현물 관련 현금 (필요 시 사용)
  const [editingCashKRW, setEditingCashKRW] = useState(false);
  const [editingCashUSD, setEditingCashUSD] = useState(false);
  const [editingCashGOLD, setEditingCashGOLD] = useState(false);
  const [loading, setLoading] = useState(false); // 데이터 로딩 상태
  const [refreshProgress, setRefreshProgress] = useState<number>(0); // 전체 업데이트 진행률
  const [refreshIndex, setRefreshIndex] = useState<number>(0); // 현재 업데이트 완료된 종목 건수
  const [refreshingStockIds, setRefreshingStockIds] = useState<string[]>([]); // 현재 업데이트 중인 종목 ID 목록 (병렬 대응)
  const [pendingStockIds, setPendingStockIds] = useState<string[]>([]); // 대기 중인 종목 ID 목록

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
  
  // 개별 종목 상세 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);

  // 주식 인라인 편집 상태 (표에서 직접 수정할 때 사용)
  const [editingStockId, setEditingStockId] = useState<string | null>(null);
  const [editStockData, setEditStockData] = useState<{name: string, quantity: string, avgPrice: string, currentPrice: string}>({name: '', quantity: '', avgPrice: '', currentPrice: ''});

  // 정렬 상태 (기본값: 평가총액 기준 내림차순)
  const [sortConfigKRW, setSortConfigKRW] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });
  const [sortConfigUSD, setSortConfigUSD] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });
  const [sortConfigGOLD, setSortConfigGOLD] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });

  // 폼 입력 상태
  const [code, setCode] = useState(''); // 종목 코드 또는 이름 (표시용)
  const [actualCode, setActualCode] = useState(''); // 실제 종목 코드 (전송용)
  const [avgPrice, setAvgPrice] = useState(''); // 매수 단가
  const [quantity, setQuantity] = useState(''); // 수량
  const [errorMsg, setErrorMsg] = useState(''); // 에러 메시지
  const fileInputRef = useRef<HTMLInputElement>(null); // 파일 입력 참조

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
    setIsMounted(true); // 마운트 완료 표시
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

    // 전송할 실제 코드를 결정합니다. (자동완성 선택값이 있으면 그것을, 없으면 입력된 값을 사용)
    const finalCode = actualCode || code.trim();

    // 종목 코드가 영문자, 숫자, 마침표(.)로만 이루어졌는지 확인 (직접 입력 시에만 체크)
    if (!actualCode && !/^[A-Za-z0-9.]+$/.test(finalCode)) {
      setErrorMsg('정확한 종목 코드를 입력하거나 검색 목록에서 선택해 주세요.');
      return;
    }

    setLoading(true);
    try {
      // 서버 API를 호출하여 종목 정보를 가져옵니다.
      const res = await fetch(`/api/stock?code=${encodeURIComponent(finalCode)}&country=${addModalType}&withName=true`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '항목 정보를 불러오지 못했습니다.');

      // 포트폴리오 타입과 실제 종목 시장 일치 여부 검사
      if (addModalType === 'US' && data.market === 'KRX') {
        throw new Error('미국 포트폴리오에는 한국 종목을 추가할 수 없습니다.');
      }
      if (addModalType === 'KR' && (data.market === 'NASDAQ' || data.market === 'NYSE' || data.market === 'AMEX')) {
        throw new Error('한국 포트폴리오에는 미국 종목을 추가할 수 없습니다.');
      }

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

  // 정렬 헬퍼 함수
  const getSortedPortfolio = (items: StockItem[], sortConfig: SortConfig | null) => {
    return [...items].sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;
      let aVal: any = 0; let bVal: any = 0;
      const aInvest = a.avgPrice * a.quantity; const bInvest = b.avgPrice * b.quantity;
      const aCurrent = a.currentPrice * a.quantity; const bCurrent = b.currentPrice * b.quantity;
      switch(key) {
        case 'name': aVal = a.name; bVal = b.name; break;
        case 'quantity': aVal = a.quantity; bVal = b.quantity; break;
        case 'avgPrice': aVal = a.avgPrice; bVal = b.avgPrice; break;
        case 'currentPrice': 
          aVal = a.changePercent ?? 0; 
          bVal = b.changePercent ?? 0; 
          break;
        case 'investment': aVal = aInvest; bVal = bInvest; break;
        case 'current': aVal = aCurrent; bVal = bCurrent; break;
        case 'returnAmount': aVal = aCurrent - aInvest; bVal = bCurrent - bInvest; break;
        case 'returnPercent': aVal = (aCurrent - aInvest) / (aInvest || 1); bVal = (bCurrent - bInvest) / (bInvest || 1); break;
      }
      if (aVal < bVal) return direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // 전체 시세 업데이트 (한국/미국 그룹별 병렬 순차 조회)
  const handleRefreshPrices = async () => {
    setLoading(true);
    setRefreshProgress(0);
    setRefreshIndex(0);
    
    try {
      await fetchExchangeRate();
      
      // 1. 미국 주식과 한국 주식을 분리하여 정렬
      const usItems = getSortedPortfolio(portfolio.filter(item => item.currency === 'USD'), sortConfigUSD);
      const krItems = getSortedPortfolio(portfolio.filter(item => item.currency === 'KRW'), sortConfigKRW);
      
      const totalCount = usItems.length + krItems.length;
      if (totalCount === 0) {
        setLoading(false);
        return;
      }
      
      // 초기 대기열 설정 (합쳐서 관리)
      setPendingStockIds([...usItems, ...krItems].map(item => item.id));

      // 각 그룹별로 순차 업데이트를 수행하는 내부 함수
      const updateGroup = async (groupItems: StockItem[]) => {
        for (const item of groupItems) {
          // 현재 처리 중인 종목 추가 및 대기열 제거
          setRefreshingStockIds(prev => [...prev, item.id]);
          setPendingStockIds(prev => prev.filter(id => id !== item.id));
          
          const countryParam = item.currency === 'USD' ? 'US' : 'KR';
          
          try {
            const res = await fetch(`/api/stock?code=${encodeURIComponent(item.code)}&country=${countryParam}`);
            if (res.ok) {
              const data = await res.json();
              // 포트폴리오 상태 즉시 갱신
              setPortfolio(prevPortfolio => prevPortfolio.map(pItem => {
                if (pItem.id === item.id) {
                  return { ...pItem, currentPrice: data.currentPrice, changePercent: data.changePercent };
                }
                return pItem;
              }));
            }
          } catch (err) {
            console.error(`[${item.code}] 업데이트 실패:`, err);
          } finally {
            // 완료 후 현재 처리 목록에서 제거 및 완료 건수 증가
            setRefreshingStockIds(prev => prev.filter(id => id !== item.id));
            setRefreshIndex(prev => {
              const nextCount = prev + 1;
              setRefreshProgress(Math.round((nextCount / totalCount) * 100));
              return nextCount;
            });
          }
        }
      };

      // 2. 한국 그룹과 미국 그룹을 동시에(병렬로) 시작
      // 각 그룹 내부에서는 순차적으로 진행됨
      await Promise.all([
        updateGroup(usItems),
        updateGroup(krItems)
      ]);
      
    } catch (error) {
      console.error("업데이트 실패:", error);
      alert('시세 새로고침 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
      setRefreshingStockIds([]);
      setPendingStockIds([]);
      setRefreshProgress(0);
      setRefreshIndex(0);
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

  // 상세 모달 열기
  const handleShowDetail = (item: StockItem) => {
    setSelectedStock(item);
    setShowDetailModal(true);
  };

  // --- 데이터 내보내기/불러오기 로직 ---
  const handleExport = () => {
    const exportData = {
      portfolio,
      cash: { KRW: cashKRW, USD: cashUSD, GOLD: cashGOLD }
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `portfolio_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchorNode); // Firefox 대응
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    if (confirm('기존 데이터가 모두 삭제되고 업로드한 파일의 데이터로 덮어쓰기 됩니다. 계속하시겠습니까?')) {
      fileInputRef.current?.click();
    }
  };

  const handleImportFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.portfolio) {
          setPortfolio(json.portfolio);
        }
        if (json.cash) {
          setCashKRW(json.cash.KRW || 0);
          setCashUSD(json.cash.USD || 0);
          setCashGOLD(json.cash.GOLD || 0);
        }
        alert('포트폴리오 데이터를 성공적으로 불러왔습니다.');
      } catch (error) {
        alert('올바르지 않은 파일 형식입니다.');
        console.error("파일 파싱 에러:", error);
      } finally {
        // Reset file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('모든 포트폴리오 데이터와 예수금이 초기화됩니다. 정말 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)')) {
      // 금현물 기본 항목 복구
      setPortfolio([{
        id: 'default-gold-' + Date.now(),
        code: 'MANUAL',
        name: '금 99.99_1kg',
        quantity: 0,
        avgPrice: 0,
        currentPrice: 0,
        currency: 'GOLD'
      }]);
      // 한국/미국/금현물 예수금 초기화(기본값 0)
      setCashKRW(0);
      setCashUSD(0);
      setCashGOLD(0);
      alert('데이터가 모두 초기화되었습니다.');
    }
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


  // --- 특정 자산 섹션(테이블) 렌더링 함수 ---

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

    const sortedPortfolio = getSortedPortfolio(filteredPortfolio, sortConfig);

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
        <div className="flex-between portfolio-header" style={{ marginBottom: isCollapsed ? '0' : '24px' }}>
          <div 
            onClick={() => toggleSection(currency === 'KRW' ? 'KRW' : currency === 'USD' ? 'USD' : 'GOLD')}
            style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', userSelect: 'none', maxWidth: '100%' }}
          >
            <span style={{ fontSize: '1.2rem', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s', flexShrink: 0 }}>▼</span>
            <h2 style={{ margin: 0 }}>{title}</h2>
          </div>
          <div className="header-stats" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="stat-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(0,0,0,0.3)', padding: '12px 20px', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
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
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('returnAmount')}>수익금 (수익률) <SortIcon columnKey="returnAmount" /></th>
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
                              {item.currency === 'GOLD' ? (
                                <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px', color: 'var(--text-primary)' }}>
                                  {item.name}
                                </strong>
                              ) : (
                                <strong 
                                  onClick={() => handleShowDetail(item)}
                                  style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px', cursor: 'pointer', color: '#a78bfa', textDecoration: 'underline', textUnderlineOffset: '4px' }} 
                                  title="클릭하여 상세 차트 보기"
                                >
                                  {item.name}
                                </strong>
                              )}
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{item.code}</div>
                            </>
                          )}
                        </td>
                        <td>{editingStockId === item.id ? <input type="number" step="any" className="glass-input" style={{ padding: '4px 8px', width: '80px', background: 'rgba(0,0,0,0.5)' }} value={editStockData.quantity} onChange={(e) => setEditStockData({...editStockData, quantity: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') saveEditStock(item.id); if (e.key === 'Escape') setEditingStockId(null); }} /> : <span onClick={() => startEditStock(item)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>{item.quantity.toLocaleString()}</span>}</td>
                        <td>{editingStockId === item.id ? <input type="number" step="any" className="glass-input" style={{ padding: '4px 8px', width: '100px', background: 'rgba(0,0,0,0.5)' }} value={editStockData.avgPrice} onChange={(e) => setEditStockData({...editStockData, avgPrice: e.target.value})} onKeyDown={(e) => { if (e.key === 'Enter') saveEditStock(item.id); if (e.key === 'Escape') setEditingStockId(null); }} /> : <span onClick={() => startEditStock(item)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>{formatMoney(item.avgPrice, item.currency)}</span>}</td>
                                                <td>
                          {editingStockId === item.id && item.currency === 'GOLD' ? (
                            <input 
                              type="number" 
                              step="any" 
                              className="glass-input" 
                              style={{ padding: '4px 8px', width: '100px', background: 'rgba(0,0,0,0.5)' }} 
                              value={editStockData.currentPrice} 
                              onChange={(e) => setEditStockData({...editStockData, currentPrice: e.target.value})} 
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEditStock(item.id); if (e.key === 'Escape') setEditingStockId(null); }} 
                            />
                          ) : (
                            <div 
                              onClick={() => item.currency === 'GOLD' && startEditStock(item)} 
                              style={{ cursor: item.currency === 'GOLD' ? 'pointer' : 'default', opacity: pendingStockIds.includes(item.id) ? 0.5 : 1 }}
                            >
                              {/* [수정] 텍스트 제거 및 흰색 프로그레스 바 표시 */}
                              {refreshingStockIds.includes(item.id) ? (
                                <div style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden', position: 'relative' }}>
                                    <div style={{ 
                                      position: 'absolute', 
                                      width: '40%', 
                                      height: '100%', 
                                      background: '#fff', 
                                      borderRadius: '2px',
                                      animation: 'loading-slide 1s infinite ease-in-out'
                                    }}></div>
                                  </div>
                                </div>
                              ) : pendingStockIds.includes(item.id) ? (
                                <div style={{ height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px' }}></div>
                                </div>
                              ) : (
                                <>
                                  <div className={item.currency !== 'GOLD' ? ((item.changePercent || 0) >= 0 ? 'text-success' : 'text-danger') : ''}>
                                    {formatMoney(item.currentPrice, item.currency)}
                                  </div>
                                  {item.currency !== 'GOLD' && (
                                    <div className={(item.changePercent || 0) >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '0.75rem', marginTop: '4px' }}>
                                      {(item.changePercent || 0) >= 0 ? '+' : ''}{(item.changePercent || 0).toFixed(2)}%
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </td>
                        <td>{formatMoney(investment, item.currency)}</td>
                        <td>{formatMoney(current, item.currency)}</td>
                        <td className={returnAmount >= 0 ? 'text-success' : 'text-danger'}>
                          <div style={{ fontWeight: 600 }}>{returnAmount >= 0 ? '+' : ''}{formatMoney(returnAmount, item.currency)}</div>
                          <div style={{ fontSize: '0.75rem', marginTop: '2px', opacity: 0.8 }}>({returnPercent >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%)</div>
                        </td>
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
                  <tr>
                    <td><strong>💵 예수금 (현금)</strong><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>CASH</div></td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>-</td>
                    <td>{isEditing ? <input type="number" className="glass-input" style={{ padding: '6px 10px', width: '130px', background: 'rgba(0,0,0,0.5)', textAlign: 'right' }} value={cash === 0 ? '' : cash} onChange={(e) => setCash(parseFloat(e.target.value) || 0)} onBlur={() => setIsEditing(false)} onKeyDown={(e) => e.key === 'Enter' && setIsEditing(false)} autoFocus placeholder="0" /> : <span onClick={() => setIsEditing(true)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>{formatMoney(cash, currency)}</span>}</td>
                    <td>-</td>
                    <td>{sectionTotalValue > 0 ? ((cash / sectionTotalValue) * 100).toFixed(1) : '0.0'}%</td>
                    <td></td>
                  </tr>
                </tbody>
                <tfoot style={{ fontWeight: 'bold' }}>
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'right' }}>총 합계</td>
                    <td>{formatMoney(sectionStockInvestment, currency)}</td>
                    <td>{formatMoney(sectionTotalValue, currency)}</td>
                    <td className={sectionStockValue - sectionStockInvestment >= 0 ? 'text-success' : 'text-danger'}>
                      <div style={{ fontWeight: 'bold' }}>{sectionStockValue - sectionStockInvestment >= 0 ? '+' : ''}{formatMoney(sectionStockValue - sectionStockInvestment, currency)}</div>
                      <div style={{ fontSize: '0.85rem', marginTop: '2px', opacity: 0.9 }}>
                        {sectionStockInvestment > 0 ? (sectionStockValue - sectionStockInvestment >= 0 ? '+' : '') + ((sectionStockValue - sectionStockInvestment) / sectionStockInvestment * 100).toFixed(2) + '%' : '0.00%'}
                      </div>
                    </td>
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
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes loading-slide {
          0% { left: -40%; }
          100% { left: 100%; }
        }
      `}</style>
      {/* 헤더 섹션 */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '48px' }}>
        <div>
          <h1 className="gradient-text" style={{ fontSize: '2.5rem', textAlign: 'left', marginBottom: '10px', marginTop: 0 }}>내 자산 포트폴리오 Vibe</h1>
          <p className="text-secondary" style={{ textAlign: 'left', margin: 0 }}>주식부터 금현물까지, 실시간 자산 현황을 한눈에 관리하세요.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="glass-button" style={{ padding: '8px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.2)' }} onClick={handleExport}>
            ⬇️ 데이터 내보내기
          </button>
          <button className="glass-button" style={{ padding: '8px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.2)' }} onClick={handleImportClick}>
            ⬆️ 데이터 불러오기
          </button>
          <button className="glass-button" style={{ padding: '8px 14px', fontSize: '0.85rem', whiteSpace: 'nowrap', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.2)' }} onClick={handleResetData}>
            🗑️ 데이터 초기화
          </button>
          <input 
            type="file" 
            accept=".json" 
            ref={fileInputRef} 
            onChange={handleImportFileChange} 
            style={{ display: 'none' }} 
          />
        </div>
      </header>

      {/* 요약 대시보드 - 좌우 패널 분리 레이아웃 (반응형 클래스 적용) */}
      <div className="dashboard-grid">
        
        {/* 왼쪽 패널: 전체 자산 수치 요약 - 프리미엄 디자인 적용 */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
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
                {loading ? `업데이트 중... (${refreshIndex} / ${portfolio.filter(p => p.currency !== 'GOLD').length})` : '🔄 시세 새로고침'}
              </button>
            </div>
          </div>
          
          {/* 중앙 핵심 지표 영역 (카드 스타일 - 반응형 적용) */}
          <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            
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
                <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: totalReturnAmountKRW >= 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
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

          {/* 하단 상세 현황 (현금 및 통화별 - 반응형 적용) */}
          <div className="cash-details" style={{ paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '40px' }}>
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
            <div className="cash-total-card" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,215,0,0.05)', padding: '8px 20px', borderRadius: '16px', border: '1px solid rgba(255,215,0,0.1)' }}>
              <div style={{ fontSize: '1.5rem' }}>💵</div>
              <div style={{ textAlign: 'right' }}>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '2px' }}>총 보유 현금 합계</div>
                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f59e0b' }}>{formatMoney(totalCashKRW, 'KRW')}</div>
              </div>
            </div>
          </div>
        </section>

        {/* 오른쪽 패널: 자산 배분 현황 (파이 차트) */}
        <section className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '1.25rem', textAlign: 'center', width: '100%' }}>자산 배분 현황</h2>
          <div className="pie-chart-container" style={{ width: '100%', height: '320px' }}>
            {isMounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <Pie data={totalPieData} cx="50%" cy="50%" innerRadius={70} outerRadius={115} paddingAngle={5} dataKey="value" stroke="none">
                    {totalPieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatMoney(Number(value), 'KRW')} contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '12px', color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div style={{ width: '100%', marginTop: '10px' }}>
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

      {/* 각종 모달들 (독립된 컴포넌트로 호출) */}
      <PieModal 
        isOpen={showPieKRW} 
        onClose={() => setShowPieKRW(false)} 
        currency="KRW" 
        cash={cashKRW} 
        portfolio={portfolio}
        formatMoney={formatMoney}
      />
      <PieModal 
        isOpen={showPieUSD} 
        onClose={() => setShowPieUSD(false)} 
        currency="USD" 
        cash={cashUSD} 
        portfolio={portfolio}
        formatMoney={formatMoney}
      />
      <PieModal 
        isOpen={showPieGOLD} 
        onClose={() => setShowPieGOLD(false)} 
        currency="GOLD" 
        cash={cashGOLD} 
        portfolio={portfolio}
        formatMoney={formatMoney}
      />
      
      <ExchangeRateModal 
        isOpen={showExchangeModal}
        onClose={() => setShowExchangeModal(false)}
        exchangeHistory={exchangeHistory}
        exchangeRate={exchangeRate}
      />
      
      {/* 항목 추가 모달 */}
      <AddStockModal 
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        type={addModalType}
        code={code}
        setCode={setCode}
        avgPrice={avgPrice}
        setAvgPrice={setAvgPrice}
        quantity={quantity}
        setQuantity={setQuantity}
        loading={loading}
        errorMsg={errorMsg}
        onSubmit={handleAddStock}
        actualCode={actualCode}
        setActualCode={setActualCode}
      />

      {/* 개별 종목 상세 모달 */}
      <StockDetailModal 
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        stock={selectedStock}
        formatMoney={formatMoney}
      />
    </main>
  );
}

// --- 독립된 모달 컴포넌트 정의 (재렌더링 효율성을 위해 Home 외부에 정의) ---

const PieModal = ({ isOpen, onClose, currency, cash, portfolio, formatMoney }: PieModalProps) => {
  if (!isOpen) return null;

  const data = portfolio
    .filter(item => item.currency === currency)
    .map(item => ({ name: item.name, value: item.currentPrice * item.quantity }));
  if (cash > 0) data.push({ name: '💵 예수금 (현금)', value: cash });
  data.sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '550px', height: '650px', display: 'flex', flexDirection: 'column' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 style={{ marginBottom: '16px', textAlign: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
          {currency === 'KRW' ? '🇰🇷 한국 주식 비중' : currency === 'USD' ? '🇺🇸 미국 주식 비중' : '🏅 금현물 비중'}
        </h3>
        <div style={{ width: '100%', height: '300px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={5} dataKey="value" stroke="none">
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any) => formatMoney(Number(value), currency)} contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
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

const ExchangeRateModal = ({ isOpen, onClose, exchangeHistory, exchangeRate }: ExchangeRateModalProps) => {
  if (!isOpen) return null;

  if (exchangeHistory.length === 0) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" style={{ maxWidth: '600px', padding: '32px', textAlign: 'center' }}>
          <button className="modal-close" onClick={onClose}>×</button>
          <p>환율 데이터를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  const chartData = exchangeHistory.map((item, index) => ({
    ...item,
    displayDate: index === exchangeHistory.length - 1 ? '오늘' : item.date,
    fullDate: item.date
  }));

  const minRate = Math.min(...chartData.map(d => d.rate)) - 5;
  const maxRate = Math.max(...chartData.map(d => d.rate)) + 5;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '600px', padding: '32px' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 style={{ marginBottom: '8px', fontSize: '1.5rem', textAlign: 'center' }}>🇺🇸 원/달러 환율 추이 (실제 데이터)</h3>
        <p className="text-secondary" style={{ textAlign: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>최근 30일간의 원/달러 환율 추이입니다.</p>
        
        <div style={{ width: '100%', height: '300px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="displayDate" 
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false} 
                tick={{fill: 'rgba(255,255,255,0.5)', fontSize: 10}} 
                tickFormatter={(value, index) => {
                  const dateStr = value === '오늘' ? chartData[index]?.fullDate : value;
                  return formatDateLabel(dateStr);
                }}
                interval={6} 
                dy={10} 
              />
              <YAxis hide domain={[minRate, maxRate]} />
              <Tooltip 
                labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '0.85rem' }}
                contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                labelFormatter={(label: any, payload: any) => {
                  const dateStr = label === '오늘' ? payload[0]?.payload.fullDate : label;
                  return formatDateLabel(dateStr);
                }}
                formatter={(value: any, name: any) => {
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
            </AreaChart>
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

const AddStockModal = ({ isOpen, onClose, type, code, setCode, actualCode, setActualCode, avgPrice, setAvgPrice, quantity, setQuantity, loading, errorMsg, onSubmit }: AddStockModalProps) => {
  const [searchResults, setSearchResults] = useState<{code: string, name: string, market: string}[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [isOpen]);

  useEffect(() => {
    // 입력창이 비어있으면 초기화
    if (!code || code.length < 1) {
      setSearchResults([]);
      setShowDropdown(false);
      setActualCode(''); // 선택된 코드도 초기화
      return;
    }
    
    // 이미 목록에서 선택된 상태(이름이 입력창에 있고 실제 코드가 저장됨)라면 검색을 스킵
    if (showDropdown === false && actualCode !== '' && code.length > 0) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search-stock?q=${encodeURIComponent(code)}&country=${type}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [code, type]);

  const handleSelectStock = (item: {code: string, name: string}) => {
    setCode(item.name); // 화면에는 이름 표시
    setActualCode(item.code); // 실제 전송용 코드 저장
    setShowDropdown(false);
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '95%', maxWidth: '450px', padding: '32px', overflow: 'visible' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 style={{ marginBottom: '24px', fontSize: '1.5rem', textAlign: 'center' }}>
          {type === 'KR' ? '🇰🇷 한국 주식 추가' : '🇺🇸 미국 주식 추가'}
        </h3>
        
        <form onSubmit={onSubmit} className="flex-col" style={{ gap: '20px', width: '100%' }}>
          <div className="input-group" style={{ marginBottom: 0, width: '100%', position: 'relative' }}>
            <label className="input-label">종목 코드 또는 이름 (예: 005930, 애플)</label>
            <input 
              type="text" 
              className="glass-input" 
              placeholder={type === 'KR' ? "예: 005930 또는 삼성전자" : "예: AAPL 또는 Apple"} 
              value={code} 
              onChange={(e) => {
                setCode(e.target.value);
                setShowDropdown(true);
              }} 
              style={{ width: '100%', boxSizing: 'border-box' }}
              autoFocus
              autoComplete="off"
            />
            {showDropdown && code && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: 'rgba(20, 20, 30, 0.95)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                marginTop: '4px',
                maxHeight: '200px',
                overflowY: 'auto',
                zIndex: 9999,
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}>
                {isSearching ? (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>검색 중...</div>
                ) : searchResults.length > 0 ? (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {searchResults.map(item => (
                      <li 
                        key={item.code}
                        onClick={() => handleSelectStock(item)}
                        style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      >
                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{item.name}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '0.75rem', padding: '2px 6px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', color: 'var(--text-secondary)' }}>{item.market}</span>
                          <span style={{ fontSize: '0.85rem', color: '#a78bfa' }}>{item.code}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>검색 결과가 없습니다.</div>
                )}
              </div>
            )}
          </div>
          
          <div style={{ display: 'flex', gap: '16px', width: '100%' }}>
            <div className="input-group" style={{ flex: 1, marginBottom: 0 }}>
              <label className="input-label">매수 단가 ({type === 'KR' ? '원' : '달러'})</label>
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
          
          <div style={{ display: 'flex', gap: '12px', marginTop: '10px', width: '100%' }}>
            <button 
              type="button" 
              className="glass-button" 
              style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }} 
              onClick={onClose}
            >
              취소
            </button>
            <button 
              type="submit" 
              className="glass-button" 
              style={{ flex: 2 }} 
              disabled={loading}
            >
              {loading ? '추가 중...' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CandlestickShape = (props: any) => {
  const { x, y, width, height, payload } = props;
  const { open, close, high, low } = payload;
  const isUp = close >= open; // 한국식 (동일할경우 빨강)
  const color = isUp ? '#ef4444' : '#3b82f6';
  
  const totalValue = high - low || 1; 
  const pixelPerValue = height / totalValue;
  
  const highY = y;
  const lowY = y + height;
  const openY = y + (high - open) * pixelPerValue;
  const closeY = y + (high - close) * pixelPerValue;
  
  const bodyTop = Math.min(openY, closeY);
  const bodyBottom = Math.max(openY, closeY);
  let bodyHeight = bodyBottom - bodyTop;
  if (bodyHeight < 1) bodyHeight = 1; 
  
  const halfWidth = width / 2;
  const centerX = x + halfWidth;
  
  return (
    <g>
      <line x1={centerX} y1={highY} x2={centerX} y2={bodyTop} stroke={color} strokeWidth={1.5} />
      <line x1={centerX} y1={bodyBottom} x2={centerX} y2={lowY} stroke={color} strokeWidth={1.5} />
      <rect x={x} y={bodyTop} width={width} height={bodyHeight} fill={color} />
    </g>
  );
};

const ReferenceLabel = (props: any) => {
  const { viewBox, value, fill } = props;
  const { x, y } = viewBox;
  return (
    <g>
      <rect 
        x={x + 10} 
        y={y - 20} 
        width={String(value).length * 7 + 10} 
        height={16} 
        fill="rgba(15, 23, 42, 0.9)" 
        rx={4} 
      />
      <text x={x + 15} y={y - 8} fill={fill} fontSize={11} fontWeight={700}>
        {value}
      </text>
    </g>
  );
};

const CustomCandleTooltip = ({ active, payload, label, formatMoney, currency, formatDateLabel }: any) => {
  if (active && payload && payload.length) {
    // payload[0].payload에 해당 시점의 모든 데이터가 들어있습니다.
    const data = payload[0].payload;
    const { open, high, low, close, ma10, ma20 } = data;
    const isUp = close >= open;
    const color = isUp ? '#ef4444' : '#3b82f6';
    
    return (
      <div style={{ 
        background: 'rgba(15, 23, 42, 0.95)', 
        border: '1px solid rgba(255,255,255,0.1)', 
        borderRadius: '12px', 
        padding: '12px',
        boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)',
        pointerEvents: 'none'
      }}>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '8px', fontSize: '0.75rem', fontWeight: 600 }}>
          {formatDateLabel(String(label))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', color: '#fff', fontSize: '0.875rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
            <span>시가</span> <strong>{formatMoney(open, currency)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
            <span>고가</span> <strong>{formatMoney(high, currency)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
            <span>저가</span> <strong>{formatMoney(low, currency)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', color, fontWeight: 'bold', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '4px', marginTop: '2px' }}>
            <span>종가</span> <span>{formatMoney(close, currency)}</span>
          </div>
          {(ma10 || ma20) && (
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '6px', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {ma10 && <div style={{ color: '#10b981', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span>10일선</span> <span>{formatMoney(ma10, currency)}</span>
              </div>}
              {ma20 && <div style={{ color: '#8b5cf6', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <span>20일선</span> <span>{formatMoney(ma20, currency)}</span>
              </div>}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

const StockDetailModal = ({ isOpen, onClose, stock, formatMoney }: StockDetailModalProps) => {
  const [history, setHistory] = useState<{date: string, open: number, high: number, low: number, close: number, candleData: number[]}[]>([]);
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && stock) {
      const fetchHistory = async () => {
        setLoading(true);
        setError('');
        try {
          const res = await fetch(`/api/stock-history?code=${encodeURIComponent(stock.code)}&country=${stock.currency === 'USD' ? 'US' : 'KR'}`);
          const data = await res.json();
          if (res.ok && data.history) {
            // 1. 전체 데이터(약 60~65 거래일)에 대해 이동평균선을 먼저 계산합니다.
            const fullHistory = data.history.map((h: any, index: number, array: any[]) => {
              const getMA = (period: number) => {
                if (index < period - 1) return null;
                const subset = array.slice(index - period + 1, index + 1);
                const sum = subset.reduce((acc: number, curr: any) => acc + curr.close, 0);
                return sum / period;
              };
              return {
                ...h,
                ma10: getMA(10),
                ma20: getMA(20),
                candleData: [h.low, h.high]
              };
            });
            
            // 2. 이동평균선이 모두 확보된 최근 30일치 데이터만 필터링하여 상태에 저장합니다.
            // (120일치를 가져왔으므로 마지막 30일 구간은 10일/20일선이 모두 계산되어 있습니다.)
            setHistory(fullHistory.slice(-30));
          } else {
            setError(data.error || '데이터를 가져오지 못했습니다.');
          }
        } catch (err) {
          setError('네트워크 오류가 발생했습니다.');
        } finally {
          setLoading(false);
        }
      };
      fetchHistory();
    }
  }, [isOpen, stock]);

  if (!isOpen || !stock) return null;

  // 수익률 계산
  const investment = stock.avgPrice * stock.quantity;
  const current = stock.currentPrice * stock.quantity;
  const returnAmount = current - investment;
  const returnPercent = investment > 0 ? (returnAmount / investment) * 100 : 0;

  // 차트 최소/최대값 계산 (여백 포함 + 매수단가 포함)
  const prices = history.map(h => h.close);
  // [수정] 상하 여백을 더 타이트하게 조정 (1% 여유)
  const allValues = prices.length > 0 ? prices : [stock.avgPrice];
  const minPrice = Math.min(...allValues) * 0.99; 
  const maxPrice = Math.max(...allValues) * 1.01; 
  
  const getCandleColor = (item: any) => {
    if (!item) return '#fff';
    return item.close >= item.open ? '#ef4444' : '#3b82f6';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '95%', maxWidth: '800px', padding: '32px' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '1.5rem' }}>{stock.currency === 'KRW' ? '🇰🇷' : stock.currency === 'USD' ? '🇺🇸' : '🏅'}</span>
              <h3 style={{ margin: 0, fontSize: '1.8rem' }}>{stock.name}</h3>
            </div>
            <p className="text-secondary" style={{ margin: 0 }}>{stock.code} • {stock.currency}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            {/* [수정] 상세 모달의 현재가에도 변동률에 따른 색상 클래스를 적용합니다. */}
            <div 
              className={stock.changePercent !== undefined && stock.changePercent >= 0 ? 'text-success' : 'text-danger'}
              style={{ fontSize: '1.8rem', fontWeight: 700 }}
            >
              {formatMoney(stock.currentPrice, stock.currency)}
            </div>
            <div className={stock.changePercent !== undefined && stock.changePercent >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '1rem', fontWeight: 600 }}>
              {stock.changePercent !== undefined ? `${stock.changePercent >= 0 ? '+' : ''}${stock.changePercent.toFixed(2)}%` : '-'}
            </div>
          </div>
        </div>

        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px', minHeight: 'auto' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>보유 수량</div>
            <div style={{ fontWeight: 600 }}>{stock.quantity.toLocaleString()}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>평균 단가</div>
            <div style={{ fontWeight: 600 }}>{formatMoney(stock.avgPrice, stock.currency)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>현재 수익</div>
            <div className={returnAmount >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 700 }}>
              {returnAmount >= 0 ? '+' : ''}{formatMoney(returnAmount, stock.currency)} ({returnPercent.toFixed(2)}%)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          {/* 좌측: 이평선 범례 (캔들 차트일 때만 표시) */}
          <div style={{ display: 'flex', gap: '12px' }}>
            {chartType === 'candle' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#10b981' }}>
                  <span style={{ width: '12px', height: '2px', background: '#10b981', display: 'inline-block' }}></span>
                  <span>10일선</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#8b5cf6' }}>
                  <span style={{ width: '12px', height: '2px', background: '#8b5cf6', display: 'inline-block' }}></span>
                  <span>20일선</span>
                </div>
              </>
            )}
          </div>

          {/* 우측: 차트 타입 선택 버튼 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              onClick={() => setChartType('line')} 
              style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: chartType === 'line' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
              라인 차트
            </button>
            <button 
              onClick={() => setChartType('candle')} 
              style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', border: 'none', cursor: 'pointer', background: chartType === 'candle' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
              캔들 차트
            </button>
          </div>
        </div>
        <div style={{ width: '100%', height: '350px', background: 'rgba(0,0,0,0.2)', borderRadius: '24px', padding: '24px', border: '1px solid var(--glass-border)', position: 'relative' }}>
          {loading ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="text-secondary">차트 데이터를 불러오는 중...</div>
            </div>
          ) : error ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div className="text-danger">{error}</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'line' ? (
                <AreaChart data={history} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} 
                    tickFormatter={(str) => str.split('-').slice(1).join('/')}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    orientation="right"
                    domain={[minPrice, maxPrice]} 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    tickFormatter={(val) => val.toLocaleString()}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip 
                    contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff' }}
                    labelStyle={{ color: 'var(--text-secondary)', marginBottom: '4px' }}
                    labelFormatter={(label: any) => formatDateLabel(String(label))}
                    formatter={(value: any) => [formatMoney(Number(value), stock.currency), '종가']}
                  />
                  {stock.avgPrice >= minPrice && stock.avgPrice <= maxPrice && (
                    <ReferenceLine 
                      y={stock.avgPrice} 
                      stroke="#f59e0b" 
                      strokeDasharray="5 5" 
                      label={<ReferenceLabel value={formatMoney(stock.avgPrice, stock.currency)} fill="#f59e0b" />} 
                    />
                  )}
                  <Area type="monotone" dataKey="close" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorPrice)" dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#ef4444' }} />
                </AreaChart>
              ) : (
                <ComposedChart data={history} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <XAxis 
                    dataKey="date" 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} 
                    tickFormatter={(str) => str.split('-').slice(1).join('/')}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    minTickGap={30}
                  />
                  <YAxis 
                    orientation="right"
                    domain={[minPrice, maxPrice]} 
                    tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                    tickFormatter={(val) => val.toLocaleString()}
                    axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                    tickLine={false}
                    width={50}
                  />
                  <Tooltip 
                    content={<CustomCandleTooltip formatMoney={formatMoney} currency={stock.currency} formatDateLabel={formatDateLabel} />}
                  />
                  {stock.avgPrice >= minPrice && stock.avgPrice <= maxPrice && (
                    <ReferenceLine 
                      y={stock.avgPrice} 
                      stroke="#f59e0b" 
                      strokeDasharray="5 5" 
                      label={<ReferenceLabel value={formatMoney(stock.avgPrice, stock.currency)} fill="#f59e0b" />} 
                    />
                  )}
                  <Line type="monotone" dataKey="ma10" stroke="#10b981" dot={false} strokeWidth={1.5} name="10일선" />
                  <Line type="monotone" dataKey="ma20" stroke="#8b5cf6" dot={false} strokeWidth={1.5} name="20일선" />
                  <Bar dataKey="candleData" shape={<CandlestickShape />} legendType="none" />
                </ComposedChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <button className="glass-button" style={{ width: 'auto', padding: '12px 40px' }} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
};
