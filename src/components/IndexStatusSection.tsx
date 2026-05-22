'use client';

import { useState, useEffect } from 'react';
// Recharts 라이브러리에서 필요한 컴포넌트들을 가져옵니다.
import { LineChart, Line, YAxis, ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from 'recharts';
import { RefreshCw } from 'lucide-react';

interface SparklinePoint {
  date: string;
  value: number;
}

interface IndicatorData {
  symbol: string;
  name: string;
  currentPrice?: number;
  changeAmount?: number;
  changePercent?: number;
  error?: string;
  sparklineData?: SparklinePoint[]; // 날짜와 값이 포함된 데이터 타입
}

// 상위 컴포넌트(page.tsx)로부터 환율 데이터와 갱신 함수를 받기 위한 인터페이스입니다.
interface IndexStatusSectionProps {
  externalExchangeRate?: number; // 전체자산요약에서 사용하는 달러 환율
  onRefreshExchangeRate?: () => void; // 달러 환율을 갱신하는 함수
}

// 심볼에 맞는 이모지(국기 또는 아이콘)를 반환하는 함수입니다.
const getEmoji = (symbol: string) => {
  if (symbol.startsWith('KS') || symbol.startsWith('KQ')) return '🇰🇷';
  if (symbol.startsWith('US') || symbol.startsWith('IX') || symbol.startsWith('DJ')) return '🇺🇸';
  if (symbol === 'USD/KRW') return '💵';
  if (symbol === 'JPY/KRW') return '🇯🇵';
  if (symbol === 'EUR/KRW') return '🇪🇺';
  if (symbol === 'CNY/KRW') return '🇨🇳';
  if (symbol === 'GC=F') return '🏅';
  if (symbol === 'CL=F') return '🛢️';
  if (symbol === 'SI=F') return '🥈';
  if (symbol === 'HG=F') return '🥉';
  if (symbol === 'BTC-USD') return '₿';
  if (symbol === 'ETH-USD') return '⟠';
  return '📈';
};

// 지수 상세 정보를 보여주는 팝업 모달 컴포넌트입니다.
interface IndicatorDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: IndicatorData;
}

const IndicatorDetailModal = ({ isOpen, onClose, item }: IndicatorDetailModalProps) => {
  if (!isOpen) return null;

  // 차트에 사용할 데이터 가공 (30일치)
  const chartData = item.sparklineData 
    ? item.sparklineData.map((d) => {
        const dateParts = d.date.split('-');
        let displayDate = d.date;
        
        if (dateParts.length === 3) {
          const month = parseInt(dateParts[1], 10);
          const day = parseInt(dateParts[2], 10);
          displayDate = `${month}월 ${day}일`;
        }
        
        return {
          value: d.value,
          displayDate: displayDate,
          fullDate: d.date
        };
      })
    : [];

  const minVal = chartData.length > 0 ? Math.min(...chartData.map(d => d.value)) : 0;
  const maxVal = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 100;
  
  const domainMin = minVal - (maxVal - minVal) * 0.1;
  const domainMax = maxVal + (maxVal - minVal) * 0.1;

  const isUp = (item.changeAmount || 0) >= 0;
  const strokeColor = isUp ? 'var(--success-red)' : 'var(--danger-blue)';
  const gradientColor = isUp ? '#ef4444' : '#3b82f6'; 

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '600px', padding: '32px' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 style={{ marginBottom: '8px', fontSize: '1.5rem', textAlign: 'center', color: 'var(--text-primary)' }}>
          {getEmoji(item.symbol)} {item.name} ({item.symbol})
        </h3>
        <p className="text-secondary" style={{ textAlign: 'center', marginBottom: '32px', fontSize: '0.9rem' }}>
          최근 30일간의 추이입니다.
        </p>

        <div style={{ width: '100%', height: '300px', background: 'rgba(255,255,255,0.02)', borderRadius: '20px', padding: '20px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorIndicator" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={gradientColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={gradientColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayDate"
                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                tickLine={false}
                tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }}
                interval={Math.floor(chartData.length / 5)}
              />
              <YAxis hide domain={[domainMin, domainMax]} />
              <Tooltip
                labelStyle={{ color: '#94a3b8', marginBottom: '4px', fontSize: '0.85rem' }}
                contentStyle={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' }}
                formatter={(value: any, name: any) => {
                  if (name === '가격영역') return [null, null];
                  return [`${value.toLocaleString()}`, '가격'];
                }}
              />
              <Area type="monotone" dataKey="value" name="가격영역" stroke="none" fillOpacity={1} fill="url(#colorIndicator)" />
              <Line
                type="monotone"
                dataKey="value"
                name="가격"
                stroke={strokeColor}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 6, strokeWidth: 0, fill: strokeColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', padding: '12px 24px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', textAlign: 'center' }}>
            <div className="text-secondary" style={{ fontSize: '0.85rem', marginBottom: '4px' }}>현재가</div>
            <strong style={{ fontSize: '1.5rem', color: strokeColor }}>
              {item.symbol.includes('KRW') || item.symbol === 'GC=F' || item.symbol === 'CL=F' || item.symbol === 'SI=F' || item.symbol === 'HG=F'
                ? item.currentPrice?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : item.currentPrice?.toLocaleString()}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
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

export const IndexStatusSection = ({ externalExchangeRate, onRefreshExchangeRate }: IndexStatusSectionProps) => {
  const [data, setData] = useState<IndicatorData[]>(initialData);
  const [loading, setLoading] = useState(true);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [error, setError] = useState('');

  // 접고 펴기 상태 추가
  const [indicesCollapsed, setIndicesCollapsed] = useState(false);
  const [ratesCollapsed, setRatesCollapsed] = useState(false);

  // 모달 관련 상태 추가
  const [selectedItem, setSelectedItem] = useState<IndicatorData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

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
        const strokeColor = isUp ? 'var(--success-red)' : 'var(--danger-blue)';

        const chartData = item.sparklineData || [];

        // 달러 환율(USD/KRW)인 경우, 외부에서 전달받은 환율이 있다면 그것을 우선 사용합니다.
        let displayPrice = item.currentPrice;
        if (item.symbol === 'USD/KRW' && externalExchangeRate) {
          displayPrice = externalExchangeRate;
        }

        return (
          <div 
            key={item.symbol} 
            className="glass-panel hover-bright" 
            style={{ 
              padding: '16px', 
              borderRadius: '12px', 
              background: 'rgba(255,255,255,0.02)', 
              border: '1px solid rgba(255,255,255,0.05)', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px', 
              opacity: isSectionLoading ? 0.7 : 1, 
              transition: 'opacity 0.2s', 
              minHeight: '130px',
              cursor: 'pointer'
            }}
            onClick={() => {
              // 모달을 띄울 때도 동기화된 가격을 반영하여 보여줍니다.
              const itemWithSyncPrice = { ...item, currentPrice: displayPrice };
              setSelectedItem(itemWithSyncPrice);
              setIsModalOpen(true);
            }}
          >
            {/* 상단: 이름 및 심볼 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.1rem' }}>{getEmoji(item.symbol)}</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>{item.symbol}</span>
            </div>
            
            {item.error ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: 'auto' }}>에러: {item.error}</div>
            ) : (
              displayPrice === undefined ? (
                /* 로딩 상태일 때의 스켈레톤 UI */
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ width: '100px', height: '20px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div>
                    <div style={{ width: '60px', height: '14px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div>
                  </div>
                  <div style={{ width: '100px', height: '40px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', animation: 'pulse 1.5s infinite' }}></div>
                </div>
              ) : (
                /* 하단 컨텐츠 영역: 좌측(가격 정보), 우측(차트) */
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' }}>
                  {/* 좌측: 가격 및 변동률 */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 700, color: '#fff' }}>
                      {item.symbol.includes('KRW') || item.symbol === 'GC=F' || item.symbol === 'CL=F' || item.symbol === 'SI=F' || item.symbol === 'HG=F'
                        ? displayPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : displayPrice.toLocaleString()}
                    </div>
                    
                    <div className={colorClass} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', fontWeight: 600 }}>
                      <span>{isUp ? '▲' : '▼'} {Math.abs(item.changeAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                      <span>({isUp ? '+' : ''}{(item.changePercent || 0).toFixed(2)}%)</span>
                    </div>
                  </div>

                  {/* 우측: 30일간의 간략한 차트 (스파크라인) */}
                  {chartData.length > 0 && (
                    <div style={{ width: '120px', height: '50px', pointerEvents: 'none' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                          <YAxis domain={['auto', 'auto']} hide={true} />
                          <Line 
                            type="monotone" 
                            dataKey="value" 
                            stroke={strokeColor} 
                            strokeWidth={2} 
                            dot={false} 
                            isAnimationActive={true} 
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
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
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 0.3; }
          100% { opacity: 0.6; }
        }
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
            <RefreshCw size={16} strokeWidth={2.5} style={{ animation: (indicesLoading || loading) ? 'spin 1s linear infinite' : 'none' }} />
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
            onClick={() => {
              fetchSectionData('rates', true);
              // 환율 섹션을 새로고침할 때 상단 요약의 환율도 함께 갱신합니다.
              if (onRefreshExchangeRate) {
                onRefreshExchangeRate();
              }
            }}
            disabled={ratesLoading || loading}
            title="새로고침"
          >
            <RefreshCw size={16} strokeWidth={2.5} style={{ animation: (ratesLoading || loading) ? 'spin 1s linear infinite' : 'none' }} />
          </button>
        </div>
        {!ratesCollapsed && renderGrid(exchangeRates, ratesLoading || (loading && data[0].currentPrice === undefined))}
      </section>

      {/* 팝업 모달 렌더링 */}
      {selectedItem && (
        <IndicatorDetailModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          item={selectedItem} 
        />
      )}
    </div>
  );
}
