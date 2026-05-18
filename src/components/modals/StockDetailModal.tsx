/* eslint-disable */
import { useState, useEffect } from 'react';
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ComposedChart, Bar, ReferenceLine } from 'recharts';
import { StockDetailModalProps } from '../../types/portfolio';
import { formatMoney, formatDateLabel } from '../../utils/format';

export const StockDetailModal = ({ isOpen, onClose, asset, formatMoney }: StockDetailModalProps) => {
  // 탭 상태 추가: 'chart'(차트), 'info'(정보), 'news'(뉴스) 중 하나를 가집니다.
  const [activeTab, setActiveTab] = useState<'chart' | 'info' | 'news'>('chart');
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

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '95%', maxWidth: '800px', padding: '32px' }}>
        <button className="modal-close" onClick={onClose}>×</button>

        {/* 헤더 영역: 종목명, 티커, 현재가 등 */}
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

        {/* 탭 네비게이션: 차트, 정보, 뉴스 탭을 선택할 수 있는 바입니다. */}
        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
          <button
            onClick={() => setActiveTab('chart')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'chart' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 8px'
            }}
          >
            차트
            {activeTab === 'chart' && (
              <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: 'var(--accent-blue)' }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('info')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'info' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 8px'
            }}
          >
            정보
            {activeTab === 'info' && (
              <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: 'var(--accent-blue)' }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('news')}
            style={{
              background: 'none',
              border: 'none',
              color: activeTab === 'news' ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              position: 'relative',
              padding: '4px 8px'
            }}
          >
            뉴스
            {activeTab === 'news' && (
              <div style={{ position: 'absolute', bottom: '-9px', left: 0, right: 0, height: '2px', background: 'var(--accent-blue)' }} />
            )}
          </button>
        </div>

        {/* 탭 내용 영역 */}
        {activeTab === 'chart' && (
          <>
            {/* 기존 항목들 (대시보드 그리드)이 차트 탭 안으로 들어왔습니다. */}
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

            {/* 차트 컨트롤 영역 */}
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

            {/* 차트 영역 */}
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
          </>
        )}

        {/* 정보 탭: 나중에 구현할 계획으로 공간만 확보합니다. */}
        {activeTab === 'info' && (
          <div style={{ width: '100%', height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '24px', padding: '24px', border: '1px solid var(--glass-border)' }}>
            <div className="text-secondary" style={{ fontSize: '1rem' }}>
              ℹ️ 정보 탭은 나중에 구현될 예정입니다. (공간 확보)
            </div>
          </div>
        )}

        {/* 뉴스 탭: 나중에 구현할 계획으로 공간만 확보합니다. */}
        {activeTab === 'news' && (
          <div style={{ width: '100%', height: '350px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '24px', padding: '24px', border: '1px solid var(--glass-border)' }}>
            <div className="text-secondary" style={{ fontSize: '1rem' }}>
              📰 뉴스 탭은 나중에 구현될 예정입니다. (공간 확보)
            </div>
          </div>
        )}

        {/* 닫기 버튼 */}
        <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
          <button className="glass-button" style={{ width: 'auto', padding: '12px 40px' }} onClick={onClose}>닫기</button>
        </div>
      </div>
    </div>
  );
};

// 캔들스틱 차트 모양을 그리는 컴포넌트입니다.
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

// 기준선 라벨을 그리는 컴포넌트입니다.
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

// 커스텀 캔들 툴팁 컴포넌트입니다.
const CustomCandleTooltip = ({ active, payload, label, formatMoney, currency, formatDateLabel }: any) => {
  if (active && payload && payload.length) {
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
