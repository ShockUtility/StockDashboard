import { formatMoney } from '../utils/format';
import { RefreshCw } from 'lucide-react';

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
      {/* [교육용 주석] 
          '💎 전체 자산 요약' 타이틀을 좌측 상단에 배치하고, 
          환율 배지 + 시세 새로고침 버튼을 우측 상단에 배치합니다. 
          데스크톱에서는 "환율 : $1 = ₩X,XXX" 형태로 접두사를 추가하여 정보를 명확히 전달합니다. */}
      <div className="flex-between" style={{ alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
            💎 전체 자산
          </h2>
          <p className="text-secondary" style={{ marginTop: '4px', fontSize: '0.9rem' }}>실시간 시세와 환율이 반영된 총 자산 현황입니다.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <div
            onClick={onShowExchangeModal}
            style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              background: 'rgba(255,255,255,0.05)',
              padding: '6px 12px',
              borderRadius: '20px',
              border: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap'
            }}
            className="hover-bright"
            title="환율 변동 차트 보기"
          >
            <span style={{ color: '#3b82f6' }}>●</span>
            <span className="desktop-only">환율 : </span>
            {`$1 = ₩${Math.round(exchangeRate).toLocaleString()}`}
          </div>
          <button className="glass-button" style={{ width: 'auto', padding: '8px 12px', fontSize: '0.875rem', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }} onClick={onRefreshPrices} disabled={loading}>
            <RefreshCw size={16} strokeWidth={2.5} style={{ animation: loading ? 'spin 1s linear infinite' : 'none', flexShrink: 0 }} />
            <span className="desktop-only" style={{ marginLeft: '4px' }}>
              {loading ? `업데이트 중... (${refreshIndex} / ${totalStockCount})` : '시세 새로고침'}
            </span>
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

      <div className="cash-details" style={{ display: 'flex', gap: '16px', marginTop: '8px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
        {/* [교육용 주석] 
            모바일 화면(세로 정렬)일 때 달러 현금과 총보유현금의 좌측에 어색하게 세로 구분선(border-left)이 남아있지 않도록
            인라인으로 선언되어 있던 borderLeft와 paddingLeft 속성을 지웠습니다.
            대신 'cash-detail-col' 클래스를 부여하여 데스크톱 환경에서는 기존의 깔끔한 세로 구분선이 유지되고,
            모바일 화면에서는 미디어 쿼리에 의해 자동으로 보더가 깔끔하게 사라지도록 스타일 구조를 개편했습니다. */}
        <div className="cash-detail-col">
          <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>보유 현금 (KRW)</div>
          <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatMoney(totalKRWAssets, 'KRW')}</strong>
        </div>
        <div className="cash-detail-col">
          <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px' }}>보유 현금 (USD)</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <strong style={{ fontSize: '1.2rem', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{formatMoney(totalUSDAssets, 'USD')}</strong>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px', whiteSpace: 'nowrap' }}>≈ {formatMoney(totalUSDAssets * exchangeRate, 'KRW')}</span>
          </div>
        </div>
        <div className="cash-detail-col">
          <div className="text-secondary" style={{ fontSize: '0.8rem', marginBottom: '4px', color: '#f59e0b', fontWeight: 600 }}>총 보유 현금</div>
          <strong style={{ fontSize: '1.2rem', color: '#f59e0b', whiteSpace: 'nowrap' }}>{formatMoney(totalKRWAssets + (totalUSDAssets * exchangeRate), 'KRW')}</strong>
        </div>
      </div>
    </section>
  );
};
