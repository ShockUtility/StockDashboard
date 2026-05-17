/* eslint-disable */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { PieModalProps } from '../../types/portfolio';
import { COLORS } from '../../utils/format';

export const PieModal = ({ isOpen, onClose, title, data, formatMoney }: PieModalProps) => {
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
              <Tooltip formatter={(value: any) => formatMoney(Number(value), 'KRW')} contentStyle={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }} />
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
