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
interface Asset {
  id: string;
  type: 'KR_STOCK' | 'US_STOCK' | 'CUSTOM' | 'CASH';
  code: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  changePercent?: number;
  currency: 'KRW' | 'USD';
}

interface Portfolio {
  id: string;
  name: string;
  assets: Asset[];
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
  portfolio: Portfolio | null;
  formatMoney: (val: number, cur: string) => string;
  exchangeRate: number;
}

interface ExchangeRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  exchangeHistory: { date: string, rate: number }[];
  exchangeRate: number;
}

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'KR_STOCK' | 'US_STOCK' | 'CUSTOM' | 'CASH';
  setType: (val: 'KR_STOCK' | 'US_STOCK' | 'CUSTOM' | 'CASH') => void;
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
  asset: Asset | null;
  formatMoney: (val: number, cur: string) => string;
}

export default function Home() {
  // --- 상태 관리 (State Management) ---
  const [isMounted, setIsMounted] = useState(false); // [신규] 클라이언트 사이드 마운트 확인용
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]); // 다중 포트폴리오 리스트
  const [currentPortfolioId, setCurrentPortfolioId] = useState<string>(''); // 현재 선택된 포트폴리오 ID

  const [loading, setLoading] = useState(false); // 데이터 로딩 상태
  const [refreshProgress, setRefreshProgress] = useState<number>(0); // 전체 업데이트 진행률
  const [refreshIndex, setRefreshIndex] = useState<number>(0); // 현재 업데이트 완료된 종목 건수
  const [refreshingStockIds, setRefreshingStockIds] = useState<string[]>([]); // 현재 업데이트 중인 종목 ID 목록
  const [pendingStockIds, setPendingStockIds] = useState<string[]>([]); // 대기 중인 종목 ID 목록

  // 섹션 접기/펼치기 상태 (포트폴리오 ID 기준)
  const [collapsedPortfolios, setCollapsedPortfolios] = useState<{ [key: string]: boolean }>({});

  // 실시간 환율 상태 (기본값 1400원)
  const [exchangeRate, setExchangeRate] = useState<number>(1400);
  const [exchangeHistory, setExchangeHistory] = useState<{ date: string, rate: number }[]>([]); // 실제 환율 히스토리 데이터

  // 모달 노출 여부
  const [showPieModal, setShowPieModal] = useState(false);
  const [showExchangeModal, setShowExchangeModal] = useState(false);

  // 항목 추가 모달 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalType, setAddModalType] = useState<Asset['type']>('KR_STOCK');

  // 개별 종목 상세 모달 상태
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);

  // 자산 인라인 편집 상태
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editAssetData, setEditAssetData] = useState<{ name: string, quantity: string, avgPrice: string, currentPrice: string }>({ name: '', quantity: '', avgPrice: '', currentPrice: '' });

  // 정렬 상태
  const [sortConfig, setSortConfig] = useState<SortConfig | null>({ key: 'current', direction: 'desc' });

  // 폼 입력 상태
  const [code, setCode] = useState('');
  const [actualCode, setActualCode] = useState('');
  const [avgPrice, setAvgPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 데이터 통신 및 효과 (Effects) ---

  const fetchExchangeRate = async () => {
    try {
      const res = await fetch('/api/exchange-rate');
      const data = await res.json();
      if (res.ok && data.rate) {
        setExchangeRate(data.rate);
        if (data.history) setExchangeHistory(data.history);
        localStorage.setItem('stock_exchange_rate', data.rate.toString());
      }
    } catch (err) {
      console.error("환율 업데이트 실패:", err);
    }
  };

  // 1. 초기 데이터 로드 및 마이그레이션
  useEffect(() => {
    setIsMounted(true);
    const savedRate = localStorage.getItem('stock_exchange_rate');
    if (savedRate) setExchangeRate(parseFloat(savedRate));
    fetchExchangeRate();

    const savedPortfolios = localStorage.getItem('stock_portfolios_v2');
    if (savedPortfolios) {
      const parsed = JSON.parse(savedPortfolios);
      setPortfolios(parsed);
      if (parsed.length > 0) setCurrentPortfolioId(parsed[0].id);
    } else {
      // 구버전 데이터 마이그레이션 체크
      const oldPortfolio = localStorage.getItem('stock_portfolio');
      const oldCash = localStorage.getItem('stock_cash');

      if (oldPortfolio || oldCash) {
        const migratedAssets: Asset[] = [];

        // 기존 포트폴리오 변환
        if (oldPortfolio) {
          const parsedOld = JSON.parse(oldPortfolio);
          parsedOld.forEach((item: any) => {
            let type: Asset['type'] = 'KR_STOCK';
            let currency: Asset['currency'] = 'KRW';

            if (item.currency === 'USD') {
              type = 'US_STOCK';
              currency = 'USD';
            } else if (item.currency === 'GOLD') {
              type = 'CUSTOM';
              currency = 'KRW';
            }

            migratedAssets.push({
              ...item,
              type,
              currency
            });
          });
        }

        // 기존 예수금 변환
        if (oldCash) {
          const parsedCash = JSON.parse(oldCash);
          if (parsedCash.KRW > 0) {
            migratedAssets.push({
              id: 'cash-krw-' + Date.now(),
              type: 'CASH',
              name: '현금 (KRW)',
              code: 'CASH',
              quantity: parsedCash.KRW,
              avgPrice: 1,
              currentPrice: 1,
              currency: 'KRW'
            });
          }
          if (parsedCash.USD > 0) {
            migratedAssets.push({
              id: 'cash-usd-' + Date.now(),
              type: 'CASH',
              name: '현금 (USD)',
              code: 'CASH',
              quantity: parsedCash.USD,
              avgPrice: 1,
              currentPrice: 1,
              currency: 'USD'
            });
          }
          if (parsedCash.GOLD > 0) {
            migratedAssets.push({
              id: 'cash-gold-' + Date.now(),
              type: 'CASH',
              name: '현금 (금계좌)',
              code: 'CASH',
              quantity: parsedCash.GOLD,
              avgPrice: 1,
              currentPrice: 1,
              currency: 'KRW'
            });
          }
        }

        const defaultPortfolio: Portfolio = {
          id: 'default-' + Date.now(),
          name: '기본 포트폴리오',
          assets: migratedAssets
        };

        setPortfolios([defaultPortfolio]);
        setCurrentPortfolioId(defaultPortfolio.id);

        // 마이그레이션 완료 후 구버전 데이터 삭제 (선택 사항이나 권장)
        // localStorage.removeItem('stock_portfolio');
        // localStorage.removeItem('stock_cash');
      } else {
        // 완전 초기 상태
        const initPortfolio: Portfolio = {
          id: 'init-' + Date.now(),
          name: '나의 포트폴리오',
          assets: []
        };
        setPortfolios([initPortfolio]);
        setCurrentPortfolioId(initPortfolio.id);
      }
    }
  }, []);

  // 2. 포트폴리오 변경 시 자동 저장
  useEffect(() => {
    if (portfolios.length > 0) {
      localStorage.setItem('stock_portfolios_v2', JSON.stringify(portfolios));
    }
  }, [portfolios]);



  // 섹션 접기/펼치기 토글
  const togglePortfolio = (id: string) => {
    setCollapsedPortfolios(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // --- 포트폴리오 관리 핸들러 ---

  // 새 포트폴리오 추가
  const handleAddPortfolio = () => {
    const newPortfolio: Portfolio = {
      id: 'pf-' + Date.now(),
      name: '새 포트폴리오',
      assets: [
        {
          id: 'cash-' + Date.now(),
          type: 'CASH',
          name: '현금 (KRW)',
          code: 'CASH',
          quantity: 0,
          avgPrice: 1,
          currentPrice: 1,
          currency: 'KRW'
        }
      ]
    };
    setPortfolios(prev => [...prev, newPortfolio]);
    setCurrentPortfolioId(newPortfolio.id);
  };

  // 포트폴리오 이름 변경
  const handleRenamePortfolio = (id: string, newName: string) => {
    setPortfolios(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  };

  // 포트폴리오 삭제
  const handleDeletePortfolio = (id: string) => {
    if (portfolios.length <= 1) {
      alert('최소 하나 이상의 포트폴리오는 유지해야 합니다.');
      return;
    }
    if (confirm('이 포트폴리오와 포함된 모든 자산이 삭제됩니다. 계속하시겠습니까?')) {
      const nextPortfolios = portfolios.filter(p => p.id !== id);
      setPortfolios(nextPortfolios);
      if (currentPortfolioId === id) {
        setCurrentPortfolioId(nextPortfolios[0].id);
      }
    }
  };

  // --- 자산 관리 핸들러 ---

  // 자산 항목 추가 함수
  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (addModalType !== 'CASH' && (!code || !avgPrice || !quantity)) {
      setErrorMsg('모든 필드를 입력해 주세요.');
      return;
    }

    if (addModalType === 'CASH' && !quantity) {
      setErrorMsg('금액을 입력해 주세요.');
      return;
    }

    setLoading(true);
    try {
      let newItem: Asset;

      if (addModalType === 'CASH') {
        newItem = {
          id: Date.now().toString(),
          type: 'CASH',
          name: code || (actualCode === 'USD' ? '현금 (USD)' : '현금 (KRW)'),
          code: 'CASH',
          quantity: parseFloat(quantity),
          avgPrice: 1,
          currentPrice: 1,
          currency: actualCode === 'USD' ? 'USD' : 'KRW',
        };
      } else if (addModalType === 'CUSTOM') {
        newItem = {
          id: Date.now().toString(),
          type: 'CUSTOM',
          name: code,
          code: 'MANUAL',
          quantity: parseFloat(quantity),
          avgPrice: parseFloat(avgPrice),
          currentPrice: parseFloat(avgPrice), // 초기 현재가는 매수가와 동일하게 설정
          currency: 'KRW',
        };
      } else {
        // 주식 (KR_STOCK, US_STOCK)
        const finalCode = actualCode || code.trim();
        const country = addModalType === 'KR_STOCK' ? 'KR' : 'US';

        const res = await fetch(`/api/stock?code=${encodeURIComponent(finalCode)}&country=${country}&withName=true`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || '항목 정보를 불러오지 못했습니다.');

        newItem = {
          id: Date.now().toString(),
          type: addModalType,
          code: data.code,
          name: data.name,
          currentPrice: data.currentPrice,
          changePercent: data.changePercent,
          currency: data.currency as 'KRW' | 'USD',
          avgPrice: parseFloat(avgPrice),
          quantity: parseFloat(quantity),
        };
      }

      setPortfolios(prev => prev.map(p =>
        p.id === currentPortfolioId
          ? { ...p, assets: [...p.assets, newItem] }
          : p
      ));

      // 입력 폼 및 모달 초기화
      setCode(''); setAvgPrice(''); setQuantity(''); setActualCode('');
      setShowAddModal(false);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 자산 삭제
  const handleDeleteAsset = (portfolioId: string, assetId: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      setPortfolios(prev => prev.map(p =>
        p.id === portfolioId
          ? { ...p, assets: p.assets.filter(a => a.id !== assetId) }
          : p
      ));
    }
  };

  // 정렬 헬퍼 함수
  const getSortedAssets = (assets: Asset[], config: SortConfig | null) => {
    return [...assets].sort((a, b) => {
      // 1. 타입별 정렬 우선순위 정의 (낮을수록 상단)
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

      // 2. 동일한 타입 내에서는 기존 정렬 로직 적용
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
  };

  // 전체 시세 업데이트
  const handleRefreshPrices = async () => {
    setLoading(true);
    setRefreshProgress(0);
    setRefreshIndex(0);

    try {
      await fetchExchangeRate();

      // 모든 포트폴리오의 모든 주식 자산 수집
      const allStockAssets: { pid: string, asset: Asset }[] = [];
      portfolios.forEach(p => {
        p.assets.forEach(a => {
          if (a.type === 'KR_STOCK' || a.type === 'US_STOCK') {
            allStockAssets.push({ pid: p.id, asset: a });
          }
        });
      });

      const totalCount = allStockAssets.length;
      if (totalCount === 0) {
        setLoading(false);
        return;
      }

      setPendingStockIds(allStockAssets.map(item => item.asset.id));

      // 순차 업데이트를 위해 그룹화 또는 순회
      for (const item of allStockAssets) {
        const { pid, asset } = item;
        setRefreshingStockIds(prev => [...prev, asset.id]);
        setPendingStockIds(prev => prev.filter(id => id !== asset.id));

        const countryParam = asset.type === 'US_STOCK' ? 'US' : 'KR';

        try {
          const res = await fetch(`/api/stock?code=${encodeURIComponent(asset.code)}&country=${countryParam}`);
          if (res.ok) {
            const data = await res.json();
            setPortfolios(prevPortfolios => prevPortfolios.map(p => {
              if (p.id === pid) {
                return {
                  ...p,
                  assets: p.assets.map(a =>
                    a.id === asset.id
                      ? { ...a, currentPrice: data.currentPrice, changePercent: data.changePercent }
                      : a
                  )
                };
              }
              return p;
            }));
          }
        } catch (err) {
          console.error(`[${asset.code}] 업데이트 실패:`, err);
        } finally {
          setRefreshingStockIds(prev => prev.filter(id => id !== asset.id));
          setRefreshIndex(prev => {
            const nextCount = prev + 1;
            setRefreshProgress(Math.round((nextCount / totalCount) * 100));
            return nextCount;
          });
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

  // 인라인 편집 시작
  const startEditAsset = (asset: Asset) => {
    setEditingAssetId(asset.id);
    setEditAssetData({
      name: asset.name,
      quantity: String(asset.quantity),
      avgPrice: String(asset.avgPrice),
      currentPrice: String(asset.currentPrice)
    });
  };

  // 인라인 편집 저장
  const saveEditAsset = (portfolioId: string, assetId: string) => {
    setPortfolios(prev => prev.map(p => {
      if (p.id === portfolioId) {
        return {
          ...p,
          assets: p.assets.map(a => {
            if (a.id === assetId) {
              return {
                ...a,
                name: editAssetData.name || a.name,
                quantity: parseFloat(editAssetData.quantity) || 0,
                avgPrice: parseFloat(editAssetData.avgPrice) || 0,
                currentPrice: parseFloat(editAssetData.currentPrice) || a.currentPrice
              };
            }
            return a;
          })
        };
      }
      return p;
    }));
    setEditingAssetId(null);
  };

  // 상세 모달 열기
  const handleShowDetail = (asset: Asset) => {
    setSelectedAsset(asset);
    setShowDetailModal(true);
  };

  // --- 데이터 내보내기/불러오기 로직 ---
  const handleExport = () => {
    const exportData = {
      version: '2.0',
      portfolios: portfolios,
      timestamp: new Date().toISOString()
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    const dateStr = new Date().toISOString().split('T')[0];
    downloadAnchorNode.setAttribute("download", `portfolio_v2_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchorNode);
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

        // V2 형식인 경우 (다중 포트폴리오)
        if (json.version === '2.0' && Array.isArray(json.portfolios)) {
          setPortfolios(json.portfolios);
          if (json.portfolios.length > 0) setCurrentPortfolioId(json.portfolios[0].id);
          alert('포트폴리오 데이터를 성공적으로 불러왔습니다.');
        }
        // 구버전(V1) 형식인 경우 마이그레이션 수행
        else if (json.portfolio || json.cash) {
          const migratedAssets: Asset[] = [];

          if (json.portfolio) {
            json.portfolio.forEach((item: any) => {
              let type: Asset['type'] = 'KR_STOCK';
              if (item.currency === 'USD') type = 'US_STOCK';
              else if (item.currency === 'GOLD') type = 'CUSTOM';

              migratedAssets.push({
                ...item,
                id: item.id || Date.now().toString() + Math.random(),
                type,
                currency: item.currency === 'GOLD' ? 'KRW' : item.currency
              });
            });
          }

          if (json.cash) {
            if (json.cash.KRW > 0) {
              migratedAssets.push({ id: 'cash-krw-' + Date.now(), type: 'CASH', name: '현금 (KRW)', code: 'CASH', quantity: json.cash.KRW, avgPrice: 1, currentPrice: 1, currency: 'KRW' });
            }
            if (json.cash.USD > 0) {
              migratedAssets.push({ id: 'cash-usd-' + Date.now(), type: 'CASH', name: '현금 (USD)', code: 'CASH', quantity: json.cash.USD, avgPrice: 1, currentPrice: 1, currency: 'USD' });
            }
          }

          const importedPortfolio: Portfolio = {
            id: 'imported-' + Date.now(),
            name: '불러온 포트폴리오',
            assets: migratedAssets
          };

          setPortfolios([importedPortfolio]);
          setCurrentPortfolioId(importedPortfolio.id);
          alert('구버전 데이터를 성공적으로 마이그레이션하여 불러왔습니다.');
        } else {
          throw new Error('지원하지 않는 파일 형식입니다.');
        }
      } catch (error: any) {
        alert('오류 발생: ' + error.message);
        console.error("파일 파싱 에러:", error);
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('모든 데이터(포트폴리오, 자산)가 삭제됩니다. 초기화하시겠습니까?')) {
      const initPortfolio: Portfolio = {
        id: 'init-' + Date.now(),
        name: '나의 포트폴리오',
        assets: [
          {
            id: 'cash-' + Date.now(),
            type: 'CASH',
            name: '현금 (KRW)',
            code: 'CASH',
            quantity: 0,
            avgPrice: 1,
            currentPrice: 1,
            currency: 'KRW'
          }
        ]
      };
      setPortfolios([initPortfolio]);
      setCurrentPortfolioId(initPortfolio.id);
      alert('데이터가 모두 초기화되었습니다.');
    }
  };

  // --- 자산 계산 로직 (모든 포트폴리오 합계) ---
  let totalStockInvestmentKRW = 0;
  let totalStockCurrentValueKRW = 0;
  let totalCashKRW = 0;

  // 전체 자산 비중 데이터 구성을 위한 맵
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
      } else {
        totalStockInvestmentKRW += investValue;
        totalStockCurrentValueKRW += currentValue;
        weightMap[asset.type] += currentValue;
      }
    });
  });

  const totalInvestmentKRW = totalStockInvestmentKRW; // [수정] 예수금은 투자 원금 합계에서 제외
  const totalCurrentValueKRW = totalStockCurrentValueKRW + totalCashKRW; // 전체 자산 가치 (주식 + 현금)
  const totalReturnAmountKRW = totalStockCurrentValueKRW - totalStockInvestmentKRW; // [수정] 수익금 계산 시 예수금 제외
  const totalReturnPercent = totalInvestmentKRW > 0 ? (totalReturnAmountKRW / totalInvestmentKRW) * 100 : 0;

  // 전체 자산 비중 데이터 구성 (상시 노출용)
  const totalPieData: { name: string, value: number }[] = [];
  if (weightMap['KR_STOCK'] > 0) totalPieData.push({ name: '🇰🇷 한국 주식', value: weightMap['KR_STOCK'] });
  if (weightMap['US_STOCK'] > 0) totalPieData.push({ name: '🇺🇸 미국 주식', value: weightMap['US_STOCK'] });
  if (weightMap['CUSTOM'] > 0) totalPieData.push({ name: '🏅 커스텀 자산', value: weightMap['CUSTOM'] });
  if (weightMap['CASH'] > 0) totalPieData.push({ name: '💵 현금', value: weightMap['CASH'] });
  totalPieData.sort((a, b) => b.value - a.value);

  // 금액 포맷팅 함수
  const formatMoney = (amount: number, currency: string) => {
    return new Intl.NumberFormat(currency === 'USD' ? 'en-US' : 'ko-KR', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };


  // --- 포트폴리오 렌더링 함수 ---
  const renderPortfolio = (portfolio: Portfolio) => {
    const isCollapsed = collapsedPortfolios[portfolio.id];

    // 포트폴리오별 합계 계산
    let pInvestKRW = 0; // 주식/커스텀 자산 투자 원금만 (예수금 제외)
    let pCurrentKRW = 0; // 전체 평가 금액 (주식 + 예수금)
    let pStockCurrentKRW = 0; // 주식/커스텀 자산 평가 금액만

    portfolio.assets.forEach(a => {
      const rate = a.currency === 'USD' ? exchangeRate : 1;
      const invest = (a.avgPrice * a.quantity) * rate;
      const current = (a.currentPrice * a.quantity) * rate;

      if (a.type === 'CASH') {
        pCurrentKRW += current;
      } else {
        pInvestKRW += invest;
        pCurrentKRW += current;
        pStockCurrentKRW += current;
      }
    });

    const pReturnAmount = pStockCurrentKRW - pInvestKRW; // 포트폴리오 수익금 (주식 기준)

    const sortedAssets = getSortedAssets(portfolio.assets, sortConfig);

    const handleSort = (key: SortKey) => {
      let direction: SortDirection = 'asc';
      if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
      setSortConfig({ key, direction });
    };

    const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
      if (!sortConfig || sortConfig.key !== columnKey) return <span style={{ opacity: 0.3, marginLeft: '4px', fontSize: '0.7em' }}>↕</span>;
      return <span style={{ marginLeft: '4px', fontSize: '0.8em', color: 'var(--text-primary)' }}>{sortConfig.direction === 'asc' ? '▲' : '▼'}</span>;
    };

    return (
      <section key={portfolio.id} className="glass-panel" style={{ marginTop: '32px' }}>
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
              placeholder="포트폴리오 이름"
            />
          </div>

          <div className="header-stats" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="stat-badge" style={{ display: 'flex', alignItems: 'center', gap: '12px', height: '40px', background: 'rgba(0,0,0,0.3)', padding: '0 20px', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
              <span className="text-secondary" style={{ fontSize: '0.875rem', fontWeight: 500 }}>총 평가액:</span>
              <strong style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>{formatMoney(pCurrentKRW, 'KRW')}</strong>
            </div>

            <button
              className="glass-button"
              style={{
                width: '40px', height: '40px', padding: 0, borderRadius: '10px',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#fff'
              }}
              onClick={() => {
                setCurrentPortfolioId(portfolio.id);
                setShowPieModal(true);
              }}
              title="비중 확인"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
            </button>


            <button
              className="glass-button"
              style={{
                width: '40px', height: '40px', padding: 0, borderRadius: '10px',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)',
                color: '#fff', fontWeight: 600
              }}
              onClick={() => {
                setCurrentPortfolioId(portfolio.id);
                setAddModalType('KR_STOCK');
                setErrorMsg('');
                setCode(''); setActualCode(''); setAvgPrice(''); setQuantity('');
                setShowAddModal(true);
              }}
              title="자산 추가"
            >
              <span style={{ fontSize: '1.5rem' }}>+</span>
            </button>

            <button
              className="delete-button"
              onClick={() => handleDeletePortfolio(portfolio.id)}
              style={{
                width: '40px', height: '40px', borderRadius: '10px',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#fff', cursor: 'pointer', transition: 'all 0.2s'
              }}
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
                    <th style={{ cursor: 'pointer', width: '250px' }} onClick={() => handleSort('name')}>자산명 <SortIcon columnKey="name" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('quantity')}>수량 <SortIcon columnKey="quantity" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('avgPrice')}>평균단가 <SortIcon columnKey="avgPrice" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('currentPrice')}>현재가 <SortIcon columnKey="currentPrice" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('investment')}>투자금액 (KRW) <SortIcon columnKey="investment" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('current')}>평가금액 (KRW) <SortIcon columnKey="current" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('returnAmount')}>수익 (수익률) <SortIcon columnKey="returnAmount" /></th>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('current')}>비중 <SortIcon columnKey="current" /></th>
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
                      <tr key={asset.id} style={{ opacity: asset.type === 'CASH' ? 0.9 : 1 }}>
                        <td>
                          {editingAssetId === asset.id ? (
                            <input
                              type="text"
                              className="glass-input"
                              style={{ padding: '4px 8px', width: '150px', background: 'rgba(0,0,0,0.5)', fontWeight: 'bold' }}
                              value={editAssetData.name}
                              onChange={(e) => setEditAssetData({ ...editAssetData, name: e.target.value })}
                              onKeyDown={(e) => { if (e.key === 'Enter') saveEditAsset(portfolio.id, asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                              autoFocus
                            />
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '1.2rem' }}>
                                {asset.type === 'KR_STOCK' ? '🇰🇷' : asset.type === 'US_STOCK' ? '🇺🇸' : asset.type === 'CASH' ? '💵' : '🏅'}
                              </span>
                              <div>
                                {asset.type === 'KR_STOCK' || asset.type === 'US_STOCK' ? (
                                  <strong
                                    onClick={() => handleShowDetail(asset)}
                                    style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px', cursor: 'pointer', color: '#a78bfa', textDecoration: 'underline' }}
                                  >
                                    {asset.name}
                                  </strong>
                                ) : (
                                  <strong style={{ color: 'var(--text-primary)' }}>{asset.name}</strong>
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
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEditAsset(portfolio.id, asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                              />
                            ) : (
                              <span onClick={() => startEditAsset(asset)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>
                                {asset.quantity.toLocaleString()}
                              </span>
                            )
                          )}
                        </td>
                        <td>
                          {asset.type === 'CASH' ? '-' : (
                            editingAssetId === asset.id ? (
                              <input
                                type="number"
                                step="any"
                                className="glass-input"
                                style={{ padding: '4px 8px', width: '100px', background: 'rgba(0,0,0,0.5)' }}
                                value={editAssetData.avgPrice}
                                onChange={(e) => setEditAssetData({ ...editAssetData, avgPrice: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEditAsset(portfolio.id, asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                              />
                            ) : (
                              <span onClick={() => startEditAsset(asset)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)' }}>
                                {formatMoney(asset.avgPrice, asset.currency)}
                              </span>
                            )
                          )}
                        </td>
                        <td>
                          {asset.type === 'CASH' ? '-' : (
                            editingAssetId === asset.id ? (
                              <input
                                type="number"
                                step="any"
                                className="glass-input"
                                style={{ padding: '4px 8px', width: '100px', background: 'rgba(0,0,0,0.5)' }}
                                value={editAssetData.currentPrice}
                                onChange={(e) => setEditAssetData({ ...editAssetData, currentPrice: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEditAsset(portfolio.id, asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                              />
                            ) : (
                              <div style={{ opacity: refreshingStockIds.includes(asset.id) ? 0.5 : 1 }}>
                                {refreshingStockIds.includes(asset.id) ? (
                                  <div className="shimmer" style={{ height: '20px', width: '60px' }}></div>
                                ) : (
                                  <>
                                    <div className={(asset.changePercent || 0) >= 0 ? 'text-success' : 'text-danger'} onClick={() => asset.type === 'CUSTOM' && startEditAsset(asset)} style={{ cursor: asset.type === 'CUSTOM' ? 'pointer' : 'default' }}>
                                      {formatMoney(asset.currentPrice, asset.currency)}
                                    </div>
                                    {asset.changePercent !== undefined && (
                                      <div className={(asset.changePercent || 0) >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '0.75rem' }}>
                                        {(asset.changePercent || 0) >= 0 ? '+' : ''}{(asset.changePercent || 0).toFixed(2)}%
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            )
                          )}
                        </td>
                        <td>{asset.type === 'CASH' ? '-' : formatMoney(investmentKRW, 'KRW')}</td>
                        <td>
                          {asset.type === 'CASH' ? (
                            editingAssetId === asset.id ? (
                              <input
                                type="number"
                                step="any"
                                className="glass-input"
                                style={{ padding: '4px 8px', width: '120px', background: 'rgba(0,0,0,0.5)' }}
                                value={editAssetData.quantity}
                                onChange={(e) => setEditAssetData({ ...editAssetData, quantity: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Enter') saveEditAsset(portfolio.id, asset.id); if (e.key === 'Escape') setEditingAssetId(null); }}
                                autoFocus
                              />
                            ) : (
                              <div onClick={() => startEditAsset(asset)} style={{ cursor: 'pointer', borderBottom: '1px dashed var(--text-secondary)', display: 'inline-block' }}>
                                <div style={{ fontWeight: 600 }}>{formatMoney(currentKRW, 'KRW')}</div>
                                {asset.currency !== 'KRW' && (
                                  <div style={{ fontSize: '0.7rem', opacity: 0.6 }}>({formatMoney(asset.quantity, asset.currency)})</div>
                                )}
                              </div>
                            )
                          ) : (
                            formatMoney(currentKRW, 'KRW')
                          )}
                        </td>
                        <td className={returnAmountKRW >= 0 ? 'text-success' : 'text-danger'}>
                          {asset.type === 'CASH' ? '-' : (
                            <>
                              <div style={{ fontWeight: 600 }}>{returnAmountKRW >= 0 ? '+' : ''}{formatMoney(returnAmountKRW, 'KRW')}</div>
                              <div style={{ fontSize: '0.75rem' }}>({returnPercent >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%)</div>
                            </>
                          )}
                        </td>
                        <td>{weightPercent.toFixed(1)}%</td>
                        <td style={{ textAlign: 'center' }}>
                          <button onClick={() => handleDeleteAsset(portfolio.id, asset.id)} className="delete-button" style={{ background: 'rgba(239, 68, 68, 0.35)', color: '#fff', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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
                {loading ? `업데이트 중... (${refreshIndex} / ${portfolios.reduce((sum, p) => sum + p.assets.filter(a => a.type === 'KR_STOCK' || a.type === 'US_STOCK').length, 0)})` : '🔄 시세 새로고침'}
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

          {/* 하단 상세 현황 (모든 포트폴리오 합계 기반) */}
          <div className="cash-details" style={{ paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: '40px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '1.5rem' }}>🇰🇷</div>
              <div>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '2px' }}>원화 자산 (현금 포함)</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                  {formatMoney(
                    portfolios.reduce((sum, p) => sum + p.assets.filter(a => a.currency === 'KRW').reduce((s, a) => s + (a.currentPrice * a.quantity), 0), 0),
                    'KRW'
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ fontSize: '1.5rem' }}>🇺🇸</div>
              <div>
                <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '2px' }}>외화 자산 (USD 환산)</div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {formatMoney(
                      portfolios.reduce((sum, p) => sum + p.assets.filter(a => a.currency === 'USD').reduce((s, a) => s + (a.currentPrice * a.quantity), 0), 0),
                      'USD'
                    )}
                  </span>
                  <span className="text-secondary" style={{ fontSize: '0.85rem' }}>
                    (≈ {formatMoney(
                      portfolios.reduce((sum, p) => sum + p.assets.filter(a => a.currency === 'USD').reduce((s, a) => s + (a.currentPrice * a.quantity * exchangeRate), 0), 0),
                      'KRW'
                    )})
                  </span>
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

      {/* 포트폴리오 목록 렌더링 */}
      {portfolios.map(p => renderPortfolio(p))}

      {/* 포트폴리오 추가 버튼 */}
      <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center' }}>
        <button
          className="glass-button"
          style={{ padding: '16px 32px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', background: 'rgba(59, 130, 246, 0.3)' }}
          onClick={handleAddPortfolio}
        >
          <span style={{ fontSize: '1.5rem' }}>+</span> 새 포트폴리오 추가
        </button>
      </div>

      {/* 각종 모달들 (독립된 컴포넌트로 호출) */}
      <PieModal
        isOpen={showPieModal}
        onClose={() => setShowPieModal(false)}
        portfolio={portfolios.find(p => p.id === currentPortfolioId) || null}
        formatMoney={formatMoney}
        exchangeRate={exchangeRate}
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
        setType={setAddModalType}
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
        asset={selectedAsset}
        formatMoney={formatMoney}
      />
    </main>
  );
}

// --- 독립된 모달 컴포넌트 정의 (재렌더링 효율성을 위해 Home 외부에 정의) ---
const PieModal = ({ isOpen, onClose, portfolio, formatMoney, exchangeRate }: PieModalProps) => {
  if (!isOpen || !portfolio) return null;

  const data = portfolio.assets.map(asset => {
    const rate = asset.currency === 'USD' ? exchangeRate : 1;
    return {
      name: asset.name,
      value: asset.currentPrice * asset.quantity * rate
    };
  });

  data.sort((a, b) => b.value - a.value);
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '550px', height: '650px', display: 'flex', flexDirection: 'column' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 style={{ marginBottom: '16px', textAlign: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
          📊 {portfolio.name} 비중 분석
        </h3>
        <div style={{ width: '100%', height: '300px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={data} cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={5} dataKey="value" stroke="none">
                {data.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(value: any) => formatMoney(Number(value), 'KRW')} contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
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
                  <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{percent.toFixed(1)}% ({formatMoney(entry.value, 'KRW')})</strong>
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
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayDate"
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
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

const AddStockModal = ({ isOpen, onClose, type, setType, code, setCode, actualCode, setActualCode, avgPrice, setAvgPrice, quantity, setQuantity, loading, errorMsg, onSubmit }: AddStockModalProps) => {
  const [searchResults, setSearchResults] = useState<{ code: string, name: string, market: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!code || code.length < 1 || type === 'CASH' || type === 'CUSTOM') {
      setSearchResults([]);
      setShowDropdown(false);
      if (type !== 'CASH' && type !== 'CUSTOM') setActualCode('');
      return;
    }

    if (showDropdown === false && actualCode !== '' && code.length > 0) return;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search-stock?q=${encodeURIComponent(code)}&country=${type === 'US_STOCK' ? 'US' : 'KR'}`);
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

  const handleSelectStock = (item: { code: string, name: string }) => {
    setCode(item.name);
    setActualCode(item.code);
    setShowDropdown(false);
  };

  const handleTypeChange = (newType: typeof type) => {
    setType(newType);
    setCode('');
    setActualCode(newType === 'CASH' ? 'KRW' : newType === 'CUSTOM' ? 'MANUAL' : '');
    setAvgPrice(newType === 'CASH' ? '1' : '');
    setQuantity('');
    setErrorMsg('');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '95%', maxWidth: '480px', padding: '32px', overflow: 'visible' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 style={{ marginBottom: '24px', fontSize: '1.5rem', textAlign: 'center' }}>자산 추가</h3>

        {/* 타입 선택 탭 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '24px' }}>
          <button
            type="button"
            onClick={() => handleTypeChange('KR_STOCK')}
            style={{
              padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: type === 'KR_STOCK' ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255,255,255,0.05)',
              color: type === 'KR_STOCK' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            🇰🇷 한국 주식
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('US_STOCK')}
            style={{
              padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: type === 'US_STOCK' ? 'rgba(139, 92, 246, 0.3)' : 'rgba(255,255,255,0.05)',
              color: type === 'US_STOCK' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            🇺🇸 미국 주식
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('CASH')}
            style={{
              padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: type === 'CASH' ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.05)',
              color: type === 'CASH' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            💵 예수금
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('CUSTOM')}
            style={{
              padding: '10px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.1)',
              background: type === 'CUSTOM' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(255,255,255,0.05)',
              color: type === 'CUSTOM' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.85rem'
            }}
          >
            🏅 커스텀 자산
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-col" style={{ gap: '20px', width: '100%' }}>
          {type === 'CASH' && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">통화 선택</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setActualCode('KRW')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                    background: actualCode === 'KRW' || actualCode === '' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                    color: '#fff', cursor: 'pointer'
                  }}
                >
                  🇰🇷 KRW
                </button>
                <button
                  type="button"
                  onClick={() => setActualCode('USD')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                    background: actualCode === 'USD' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                    color: '#fff', cursor: 'pointer'
                  }}
                >
                  🇺🇸 USD
                </button>
              </div>
            </div>
          )}

          <div className="input-group" style={{ marginBottom: 0, width: '100%', position: 'relative' }}>
            <label className="input-label">
              {type === 'CASH' ? '항목명 (예: 신한은행 계좌)' : '종목 코드 또는 이름'}
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder={type === 'KR_STOCK' ? "예: 005930 또는 삼성전자" : type === 'US_STOCK' ? "예: AAPL 또는 Apple" : type === 'CASH' ? "예: 일반계좌, 파킹통장 등" : "예: 금현물, 코인 등"}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (type !== 'CUSTOM' && type !== 'CASH') setShowDropdown(true);
              }}
              style={{ width: '100%', boxSizing: 'border-box' }}
              autoFocus
              autoComplete="off"
            />
            {showDropdown && searchResults.length > 0 && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0,
                background: 'rgba(20, 20, 30, 0.95)',
                borderRadius: '12px', marginTop: '8px', border: '1px solid rgba(255,255,255,0.1)',
                maxHeight: '200px', overflowY: 'auto', zIndex: 1000, boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}>
                {searchResults.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectStock(item)}
                    style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between' }}
                    className="search-item"
                  >
                    <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                    <span className="text-secondary" style={{ fontSize: '0.8rem' }}>{item.code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">{type === 'CASH' ? '금액' : '보유 수량'}</label>
            <input type="number" step="any" className="glass-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: '100%' }} required />
          </div>

          {type !== 'CASH' && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">평균 단가 (또는 현재가)</label>
              <input type="number" step="any" className="glass-input" value={avgPrice} onChange={(e) => setAvgPrice(e.target.value)} style={{ width: '100%' }} required />
            </div>
          )}

          {errorMsg && <p className="text-danger" style={{ fontSize: '0.85rem', textAlign: 'center' }}>{errorMsg}</p>}

          <button type="submit" className="glass-button" disabled={loading} style={{ background: 'var(--accent-blue)', marginTop: '10px' }}>
            {loading ? '처리 중...' : '추가하기'}
          </button>
        </form>
      </div>
    </div>
  );
};

const StockDetailModal = ({ isOpen, onClose, asset, formatMoney }: StockDetailModalProps) => {
  const [history, setHistory] = useState<{ date: string, open: number, high: number, low: number, close: number, candleData: number[] }[]>([]);
  const [chartType, setChartType] = useState<'line' | 'candle'>('candle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && asset && asset.code !== 'CASH' && asset.code !== 'MANUAL') {
      const fetchHistory = async () => {
        setLoading(true);
        setError('');
        try {
          const res = await fetch(`/api/stock-history?code=${encodeURIComponent(asset.code)}&country=${asset.currency === 'USD' ? 'US' : 'KR'}`);
          const data = await res.json();
          if (res.ok && data.history) {
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
  }, [isOpen, asset]);

  if (!isOpen || !asset) return null;

  const investment = asset.avgPrice * asset.quantity;
  const current = asset.currentPrice * asset.quantity;
  const returnAmount = current - investment;
  const returnPercent = investment > 0 ? (returnAmount / investment) * 100 : 0;

  const prices = history.map(h => h.close);
  const allValues = prices.length > 0 ? prices : [asset.avgPrice];
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
              <span style={{ fontSize: '1.5rem' }}>{asset.currency === 'KRW' ? '🇰🇷' : asset.currency === 'USD' ? '🇺🇸' : '🏅'}</span>
              <h3 style={{ margin: 0, fontSize: '1.8rem' }}>{asset.name}</h3>
            </div>
            <p className="text-secondary" style={{ margin: 0 }}>{asset.code} • {asset.currency}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              className={asset.changePercent !== undefined && asset.changePercent >= 0 ? 'text-success' : 'text-danger'}
              style={{ fontSize: '1.8rem', fontWeight: 700 }}
            >
              {formatMoney(asset.currentPrice, asset.currency)}
            </div>
            <div className={asset.changePercent !== undefined && asset.changePercent >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '1rem', fontWeight: 600 }}>
              {asset.changePercent !== undefined ? `${asset.changePercent >= 0 ? '+' : ''}${asset.changePercent.toFixed(2)}%` : '-'}
            </div>
          </div>
        </div>

        <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '32px', minHeight: 'auto' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>보유 수량</div>
            <div style={{ fontWeight: 600 }}>{asset.quantity.toLocaleString()}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>평균 단가</div>
            <div style={{ fontWeight: 600 }}>{formatMoney(asset.avgPrice, asset.currency)}</div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
            <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>현재 수익</div>
            <div className={returnAmount >= 0 ? 'text-success' : 'text-danger'} style={{ fontWeight: 700 }}>
              {returnAmount >= 0 ? '+' : ''}{formatMoney(returnAmount, asset.currency)} ({returnPercent.toFixed(2)}%)
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
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
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
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
                    formatter={(value: any) => [formatMoney(Number(value), asset.currency), '종가']}
                  />
                  {asset.avgPrice >= minPrice && asset.avgPrice <= maxPrice && (
                    <ReferenceLine
                      y={asset.avgPrice}
                      stroke="#f59e0b"
                      strokeDasharray="5 5"
                      label={<ReferenceLabel value={formatMoney(asset.avgPrice, asset.currency)} fill="#f59e0b" />}
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
                    content={<CustomCandleTooltip formatMoney={formatMoney} currency={asset.currency} formatDateLabel={formatDateLabel} />}
                  />
                  {asset.avgPrice >= minPrice && asset.avgPrice <= maxPrice && (
                    <ReferenceLine
                      y={asset.avgPrice}
                      stroke="#f59e0b"
                      strokeDasharray="5 5"
                      label={<ReferenceLabel value={formatMoney(asset.avgPrice, asset.currency)} fill="#f59e0b" />}
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
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '6px', paddingTop: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {ma10 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', color: '#10b981', fontSize: '0.75rem' }}>
                  <span>MA10</span> <strong>{formatMoney(ma10, currency)}</strong>
                </div>
              )}
              {ma20 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', color: '#8b5cf6', fontSize: '0.75rem' }}>
                  <span>MA20</span> <strong>{formatMoney(ma20, currency)}</strong>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
  return null;
};

