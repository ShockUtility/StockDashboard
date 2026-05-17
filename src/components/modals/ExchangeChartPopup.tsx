/* eslint-disable */
import { AreaChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ExchangeRateModalProps } from '../../types/portfolio';
import { formatDateLabel } from '../../utils/format';

export const ExchangeRateModal = ({ isOpen, onClose, exchangeHistory, exchangeRate }: ExchangeRateModalProps) => {
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
