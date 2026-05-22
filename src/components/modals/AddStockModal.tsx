/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useEffect } from 'react';
import { AddStockModalProps } from '../../types/portfolio';

export const AddStockModal = ({ isOpen, onClose, type, setType, code, setCode, actualCode, setActualCode, avgPrice, setAvgPrice, quantity, setQuantity, loading, errorMsg, setErrorMsg, currency, setCurrency, onSubmit }: AddStockModalProps) => {
  const [searchResults, setSearchResults] = useState<{ code: string, name: string, market: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!code || code.length < 1 || type === 'CASH' || type === 'CUSTOM') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
  }, [code, type, actualCode, showDropdown, setActualCode]);

  const handleSelectStock = (item: { code: string, name: string }) => {
    setCode(item.name);
    setActualCode(item.code);
    setShowDropdown(false);
  };

  const handleTypeChange = (newType: typeof type) => {
    setType(newType);
    setCode('');
    setActualCode(newType === 'CASH' ? 'KRW' : newType === 'CUSTOM' ? 'MANUAL' : '');
    setAvgPrice('');
    setQuantity(newType === 'CASH' ? '1' : '');
    setErrorMsg('');
    setCurrency(newType === 'US_STOCK' ? 'USD' : 'KRW');
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ width: '95%', maxWidth: '480px', padding: '32px', overflow: 'visible' }}>
        <button className="modal-close" onClick={onClose}>×</button>
        <h3 style={{ marginBottom: '24px', fontSize: '1.5rem', textAlign: 'center' }}>자산 추가</h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '4px',
          marginBottom: '24px',
          background: 'rgba(0,0,0,0.2)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid rgba(255,255,255,0.05)'
        }}>
          <button
            type="button"
            onClick={() => handleTypeChange('US_STOCK')}
            style={{
              padding: '10px 0', borderRadius: '8px', border: 'none',
              background: type === 'US_STOCK' ? 'rgba(139, 92, 246, 0.3)' : 'transparent',
              color: type === 'US_STOCK' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: type === 'US_STOCK' ? 600 : 400,
              transition: 'all 0.2s'
            }}
          >
            🇺🇸 미국
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('KR_STOCK')}
            style={{
              padding: '10px 0', borderRadius: '8px', border: 'none',
              background: type === 'KR_STOCK' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
              color: type === 'KR_STOCK' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: type === 'KR_STOCK' ? 600 : 400,
              transition: 'all 0.2s'
            }}
          >
            🇰🇷 한국
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('CUSTOM')}
            style={{
              padding: '10px 0', borderRadius: '8px', border: 'none',
              background: type === 'CUSTOM' ? 'rgba(245, 158, 11, 0.3)' : 'transparent',
              color: type === 'CUSTOM' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: type === 'CUSTOM' ? 600 : 400,
              transition: 'all 0.2s'
            }}
          >
            🏅 기타
          </button>
          <button
            type="button"
            onClick={() => handleTypeChange('CASH')}
            style={{
              padding: '10px 0', borderRadius: '8px', border: 'none',
              background: type === 'CASH' ? 'rgba(16, 185, 129, 0.3)' : 'transparent',
              color: type === 'CASH' ? '#fff' : 'var(--text-secondary)',
              cursor: 'pointer', fontSize: '0.8rem', fontWeight: type === 'CASH' ? 600 : 400,
              transition: 'all 0.2s'
            }}
          >
            💵 예수금
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex-col" style={{ gap: '20px', width: '100%' }}>
          {type === 'CASH' && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">통화 선택</label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setCurrency('KRW')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                    background: currency === 'KRW' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                    color: '#fff', cursor: 'pointer'
                  }}
                >
                  🇰🇷 KRW
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)',
                    background: currency === 'USD' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
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
              {type === 'CASH' ? '이름' : '종목 코드 또는 이름'}
            </label>
            <input
              type="text"
              className="glass-input"
              placeholder={type === 'KR_STOCK' ? "예: 005930 또는 삼성전자" : type === 'US_STOCK' ? "예: AAPL 또는 Apple" : type === 'CASH' ? "예: 예수금, 현금, 달러 등" : "예: 금현물, 코인 등"}
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

          {type !== 'CASH' && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">보유 수량</label>
              <input type="number" step="any" className="glass-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: '100%' }} required />
            </div>
          )}

          <div className="input-group" style={{ marginBottom: 0 }}>
            <label className="input-label">{type === 'CASH' ? '금액' : '평균 단가'}</label>
            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="number"
                step="any"
                className="glass-input"
                value={avgPrice}
                onChange={(e) => setAvgPrice(e.target.value)}
                style={{ flex: 1 }}
                required
              />
              {type === 'CUSTOM' && (
                <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <button
                    type="button"
                    onClick={() => setCurrency('KRW')}
                    style={{
                      padding: '0 8px', borderRadius: '8px', border: 'none',
                      background: currency === 'KRW' ? 'var(--accent-blue)' : 'transparent',
                      color: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🇰🇷 KRW
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrency('USD')}
                    style={{
                      padding: '0 8px', borderRadius: '8px', border: 'none',
                      background: currency === 'USD' ? 'var(--accent-blue)' : 'transparent',
                      color: '#fff', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}
                  >
                    🇺🇸 USD
                  </button>
                </div>
              )}
            </div>
          </div>

          {errorMsg && <p className="text-danger" style={{ fontSize: '0.85rem', textAlign: 'center' }}>{errorMsg}</p>}

          <button type="submit" className="glass-button" disabled={loading} style={{ background: 'var(--accent-blue)', marginTop: '10px' }}>
            {loading ? '처리 중...' : '추가하기'}
          </button>
        </form>
      </div>
    </div>
  );
};
