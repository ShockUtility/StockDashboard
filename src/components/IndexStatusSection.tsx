'use client';

import { useState, useEffect } from 'react';

interface IndicatorData {
  symbol: string;
  name: string;
  currentPrice?: number;
  changeAmount?: number;
  changePercent?: number;
  error?: string;
}

const getEmoji = (symbol: string) => {
  if (symbol.startsWith('KS') || symbol.startsWith('KQ')) return '🇰🇷';
  if (symbol.startsWith('US') || symbol.startsWith('IX') || symbol.startsWith('DJ')) return '🇺🇸';
  if (symbol === 'USD/KRW') return '💵';
  if (symbol === 'JPY/KRW') return '💴';
  if (symbol === 'EUR/KRW') return '💶';
  if (symbol === 'CNY/KRW') return '🇨🇳';
  if (symbol === 'GC=F') return '🏅';
  if (symbol === 'CL=F') return '🛢️';
  if (symbol === 'SI=F') return '🥈';
  if (symbol === 'HG=F') return '🥉';
  if (symbol === 'BTC-USD') return '₿';
  if (symbol === 'ETH-USD') return '⟠';
  return '📈';
};

// 초기 진입 시 보여줄 항목들의 틀
const initialData: IndicatorData[] = [
  // 주요 지수
  { symbol: "KS11", name: "코스피" },
  { symbol: "KQ11", name: "코스닥" },
  { symbol: "US500", name: "S&P 500" },
  { symbol: "IXIC", name: "나스닥" },
  { symbol: "DJI", name: "다우존스" },
  { symbol: "CL=F", name: "WTI" },
  { symbol: "BZ=F", name: "브렌트유" },
  { symbol: "GC=F", name: "국제 금값" },
  { symbol: "SI=F", name: "국제 은값" },
  { symbol: "HG=F", name: "국제 구리값" },
  { symbol: "BTC-USD", name: "비트코인" },
  { symbol: "ETH-USD", name: "이더리움" },
  
  // 환율
  { symbol: "USD/KRW", name: "원/달러 환율" },
  { symbol: "EUR/KRW", name: "유로 (EUR/KRW)" },
  { symbol: "JPY/KRW", name: "원/엔화 환율" },
  { symbol: "CNY/KRW", name: "위안화 (CNY/KRW)" }
];

export const IndexStatusSection = () => {
  const [data, setData] = useState<IndicatorData[]>(initialData);
  const [loading, setLoading] = useState(true);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [error, setError] = useState('');

  // 접고 펴기 상태 추가
  const [indicesCollapsed, setIndicesCollapsed] = useState(false);
  const [ratesCollapsed, setRatesCollapsed] = useState(false);

  // 데이터 가져오기 함수 (타입별)
  const fetchSectionData = async (type: 'indices' | 'rates' | 'all', ignoreCache = false) => {
    if (type === 'indices') setIndicesLoading(true);
    if (type === 'rates') setRatesLoading(true);
    if (type === 'all') setLoading(true);
    
    setError('');
    try {
      const url = type === 'all' ? '/api/indicators' : `/api/indicators?type=${type}`;
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        
        setData(prev => {
          let newData: IndicatorData[];
          if (type === 'all') {
            newData = json;
          } else {
            // 기존 데이터와 병합 (해당 타입의 데이터만 교체)
            newData = [...prev];
            json.forEach((newItem: IndicatorData) => {
              const idx = newData.findIndex(item => item.symbol === newItem.symbol);
              if (idx >= 0) {
                newData[idx] = newItem;
              } else {
                newData.push(newItem);
              }
            });
          }
          
          // 로컬 스토리지에 캐시 저장 (5분 유효)
          if (typeof window !== 'undefined') {
            localStorage.setItem('indexStatusData', JSON.stringify(newData));
            localStorage.setItem('indexStatusTimestamp', Date.now().toString());
          }
          
          return newData;
        });
      } else {
        setError('데이터를 불러오는데 실패했습니다.');
      }
    } catch (err) {
      setError('서버와 통신 중 오류가 발생했습니다.');
    } finally {
      if (type === 'indices') setIndicesLoading(false);
      if (type === 'rates') setRatesLoading(false);
      if (type === 'all') setLoading(false);
    }
  };

  useEffect(() => {
    // 마운트 시 캐시 확인
    if (typeof window !== 'undefined') {
      const cachedData = localStorage.getItem('indexStatusData');
      const cachedTime = localStorage.getItem('indexStatusTimestamp');
      
      if (cachedData && cachedTime) {
        const elapsed = Date.now() - parseInt(cachedTime, 10);
        const fiveMinutes = 5 * 60 * 1000;
        
        // 5분이 지나지 않았으면 캐시 데이터 사용
        if (elapsed < fiveMinutes) {
          setData(JSON.parse(cachedData));
          setLoading(false);
          return;
        }
      }
    }
    
    // 캐시가 없거나 5분이 지났으면 새로 가져옴
    fetchSectionData('all');
  }, []);

  // 환율 항목 정의 (필터링용)
  const exchangeSymbols = ['USD/KRW', 'JPY/KRW', 'EUR/KRW', 'CNY/KRW'];
  
  // 데이터 분류
  const mainIndices = data.filter(item => !exchangeSymbols.includes(item.symbol));
  const exchangeRates = data.filter(item => exchangeSymbols.includes(item.symbol));

  const renderGrid = (items: IndicatorData[], isSectionLoading: boolean) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
      {items.map((item) => {
        const isUp = (item.changeAmount || 0) >= 0;
        const colorClass = isUp ? 'text-success' : 'text-danger';

        return (
          <div key={item.symbol} className="glass-panel hover-bright" style={{ padding: '16px', borderRadius: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexDirection: 'column', gap: '10px', opacity: isSectionLoading ? 0.7 : 1, transition: 'opacity 0.2s' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>{getEmoji(item.symbol)}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{item.symbol}</span>
            </div>
            
            {item.error ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 'auto' }}>에러: {item.error}</div>
            ) : (
              item.currentPrice === undefined ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: 'auto' }}>
                  <div style={{ width: '100px', height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div>
                  <div style={{ width: '60px', height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div>
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff' }}>
                    {item.symbol.includes('KRW') || item.symbol === 'GC=F' || item.symbol === 'CL=F' || item.symbol === 'SI=F' || item.symbol === 'HG=F'
                      ? item.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : item.currentPrice.toLocaleString()}
                  </div>
                  
                  <div className={colorClass} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                    <span>{isUp ? '▲' : '▼'} {Math.abs(item.changeAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    <span>({isUp ? '+' : ''}{(item.changePercent || 0).toFixed(2)}%)</span>
                  </div>
                </>
              )
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '60px', marginTop: '32px' }}>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>

      {error && (
        <div className="glass-panel" style={{ padding: '20px', color: 'var(--text-danger)', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* 주요 지수 및 자산 섹션 */}
      <section className="glass-panel">
        <div className="flex-between" style={{ marginBottom: indicesCollapsed ? '0' : '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              onClick={() => setIndicesCollapsed(!indicesCollapsed)}
              style={{ fontSize: '1.2rem', transform: indicesCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              ▼
            </span>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              📊 주요 지수 및 자산
            </h3>
          </div>
          <button 
            className="glass-button" 
            style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff' }}
            onClick={() => fetchSectionData('indices', true)}
            disabled={indicesLoading || loading}
            title="새로고침"
          >
            <svg 
              width="16" height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ animation: (indicesLoading || loading) ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
        {!indicesCollapsed && renderGrid(mainIndices, indicesLoading || (loading && data[0].currentPrice === undefined))}
      </section>

      {/* 실시간 환율 섹션 */}
      <section className="glass-panel">
        <div className="flex-between" style={{ marginBottom: ratesCollapsed ? '0' : '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              onClick={() => setRatesCollapsed(!ratesCollapsed)}
              style={{ fontSize: '1.2rem', transform: ratesCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.3s', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              ▼
            </span>
            <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
              💱 실시간 환율
            </h3>
          </div>
          <button 
            className="glass-button" 
            style={{ width: '32px', height: '32px', padding: 0, borderRadius: '8px', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#fff' }}
            onClick={() => fetchSectionData('rates', true)}
            disabled={ratesLoading || loading}
            title="새로고침"
          >
            <svg 
              width="16" height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ animation: (ratesLoading || loading) ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
          </button>
        </div>
        {!ratesCollapsed && renderGrid(exchangeRates, ratesLoading || (loading && data[0].currentPrice === undefined))}
      </section>
    </div>
  );
};
