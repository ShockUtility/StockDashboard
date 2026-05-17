export const IndexStatusSection = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', paddingBottom: '60px', marginTop: '32px' }}>
      <section className="glass-panel" style={{ padding: '40px', textAlign: 'center', minHeight: '300px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '16px', fontWeight: 700 }}>📈 글로벌 지수 현황</h2>
        <p className="text-secondary" style={{ fontSize: '1rem', lineHeight: '1.6' }}>
          지수 데이터 연동 준비 중입니다.<br />
          향후 S&P 500, 나스닥, 다우존스, 코스피, 원/달러 환율 추이 등을 이곳에서 한눈에 모니터링할 수 있도록 업데이트될 예정입니다.
        </p>
      </section>
    </div>
  );
};
