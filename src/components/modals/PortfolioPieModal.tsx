/* eslint-disable */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieModalProps } from '../../types/portfolio';
import { COLORS } from '../../utils/format';

export const PieModal = ({ isOpen, onClose, title, data, formatMoney, currency = 'KRW' }: PieModalProps) => {
  if (!isOpen) return null;

  const sortedData = [...data].sort((a, b) => b.value - a.value);
  const total = sortedData.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '550px', height: '650px', display: 'flex', flexDirection: 'column' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 style={{ marginBottom: '16px', textAlign: 'center', fontSize: '1.5rem', flexShrink: 0 }}>
          📊 {title}
        </h3>
        <div style={{ width: '100%', height: '300px', flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie data={sortedData} cx="50%" cy="50%" innerRadius={80} outerRadius={130} paddingAngle={5} dataKey="value" stroke="none">
                {sortedData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
              </Pie>
              {/* [교육용 주석] 툴팁 표시 시, 하드코딩되었던 'KRW' 단위를 제거하고 부모로부터 전달된 currency(USD 또는 KRW) 변수를 사용하여 화폐 기호를 알맞게 표시합니다. */}
              <Tooltip formatter={(value: any) => formatMoney(Number(value), currency)} contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', marginTop: '16px', paddingRight: '8px' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {sortedData.map((entry, index) => {
              const percent = total > 0 ? (entry.value / total) * 100 : 0;
              return (
                <li key={`item-${index}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0px', fontSize: '0.8rem', padding: '2px 4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length], display: 'inline-block', flexShrink: 0 }}></span>
                    <span style={{ color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }} title={entry.name}>{entry.name}</span>
                  </div>
                  {/* [교육용 주석] 하단 리스트 영역에도 'KRW' 대신 dynamic한 currency를 포맷 함수에 대입해 미국 주식은 달러($), 한국 주식은 원화(₩)로 나타나게 합니다. */}
                  <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{percent.toFixed(1)}% ({formatMoney(entry.value, currency)})</strong>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};
