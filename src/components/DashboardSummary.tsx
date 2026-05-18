import { formatMoney } from '../utils/format';

interface DashboardSummaryProps {
  totalInvestmentKRW: number;
  totalCurrentValueKRW: number;
  totalReturnAmountKRW: number;
  totalReturnPercent: number;
  totalKRWAssets: number;
  totalUSDAssets: number;
  exchangeRate: number;
  loading: boolean;
  refreshIndex: number;
  totalStockCount: number;
  onRefreshPrices: () => void;
  onShowExchangeModal: () => void;
}

export const DashboardSummary = ({
  totalInvestmentKRW,
  totalCurrentValueKRW,
  totalReturnAmountKRW,
  totalReturnPercent,
  totalKRWAssets,
  totalUSDAssets,
  exchangeRate,
  loading,
  refreshIndex,
  totalStockCount,
  onRefreshPrices,
  onShowExchangeModal
}: DashboardSummaryProps) => {
  return (
    <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      <div className="flex-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            💎 전체 자산 요약
          </h2>
          <p className="text-secondary" style={{ marginTop: '4px', fontSize: '0.9rem' }}>실시간 시세와 환율이 반영된 총 자산 현황입니다.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
          <div
            onClick={onShowExchangeModal}
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
          <button className="glass-button" style={{ width: 'auto', padding: '8px 20px', fontSize: '0.875rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={onRefreshPrices} disabled={loading}>
            <svg 
              width="16" height="16" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }}
            >
              <path d="M23 4v6h-6"></path>
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
            </svg>
            {loading ? `업데이트 중... (${refreshIndex} / ${totalStockCount})` : '시세 새로고침'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>

      {/* [교육용 주석] 화면이 좁아질 때 카드가 자동으로 다음 줄로 내려가도록 repeat(auto-fit, minmax(220px, 1fr))을 적용했습니다. */}
      <div className="summary-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#3b82f6' }}>
              💰
            </div>
            <span className="text-secondary" style={{ fontSize: '0.9rem', fontWeight: 500 }}>총 투자 원금</span>
          </div>
          {/* [교육용 주석] whiteSpace: 'nowrap'을 추가하여 절대 줄바꿈이 되지 않도록 했습니다. */}
          <strong style={{ fontSize: '1.4rem', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>{formatMoney(totalInvestmentKRW, 'KRW')}</strong>
        </div>

        <div style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(59, 130, 246, 0.2)', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#8b5cf6' }}>
              📈
            </div>
            <span className="text-secondary" style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a78bfa' }}>총 평가 금액</span>
          </div>
          {/* [교육용 주석] whiteSpace: 'nowrap'을 추가하여 절대 줄바꿈이 되지 않도록 했습니다. */}
          <strong style={{ fontSize: '1.7rem', letterSpacing: '-1px', color: '#fff', whiteSpace: 'nowrap' }}>{formatMoney(totalCurrentValueKRW, 'KRW')}</strong>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#10b981' }}>
              🎯
            </div>
            <span className="text-secondary" style={{ fontSize: '0.9rem', fontWeight: 500 }}>총 투자 수익</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {/* [교육용 주석] 폰트 크기를 1.2rem으로 더 줄이고, 자간을 -1px로 좁혔으며, 줄바꿈을 금지했습니다. */}
            <strong className={totalReturnAmountKRW >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '1.2rem', letterSpacing: '-1px', whiteSpace: 'nowrap' }}>
              {totalReturnAmountKRW >= 0 ? '+' : ''}{formatMoney(totalReturnAmountKRW, 'KRW')}
            </strong>
            <span className={totalReturnPercent >= 0 ? 'text-success' : 'text-danger'} style={{ fontSize: '0.95rem', fontWeight: 600, marginTop: '4px' }}>
              {totalReturnPercent >= 0 ? '▲' : '▼'} {totalReturnPercent.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      <div className="cash-details" style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginTop: '8px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
        <div style={{ flex: 1 }}>
          <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>보유 현금 (KRW)</div>
          <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatMoney(totalKRWAssets, 'KRW')}</strong>
        </div>
        <div style={{ flex: 1, borderLeft: '1px solid var(--glass-border)', paddingLeft: '16px' }}>
          <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>보유 현금 (USD)</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatMoney(totalUSDAssets, 'USD')}</strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap' }}>≈ {formatMoney(totalUSDAssets * exchangeRate, 'KRW')}</span>
          </div>
        </div>
        <div style={{ flex: 1, borderLeft: '1px solid var(--glass-border)', paddingLeft: '16px' }}>
          <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#f59e0b', fontWeight: 600 }}>총 보유 현금</div>
          <strong style={{ fontSize: '1.2rem', color: '#f59e0b', whiteSpace: 'nowrap' }}>{formatMoney(totalKRWAssets + (totalUSDAssets * exchangeRate), 'KRW')}</strong>
        </div>
      </div>
    </section>
  );
};
