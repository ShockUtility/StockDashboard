/* eslint-disable react-hooks/exhaustive-deps, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { useState, useEffect, useRef } from 'react';
import { AddStockModalProps } from '../../types/portfolio';

/**
 * [교육용 주석]
 * 주식 대시보드의 계좌관리 화면에서 포트폴리오에 자산(미국 주식, 한국 주식, 기타 자산, 예수금)을
 * 새로 등록하기 위해 사용되는 유려한 UI 디자인의 모달 컴포넌트입니다.
 * 
 * 기존의 몇 가지 치명적인 상태 흐름(State Flow) 문제를 수정하여,
 * 한 번 등록한 이후 재검색하거나 수정 타이핑 시 검색 드롭다운이 안 뜨는 고질적 에러를 완벽하게 해결했습니다.
 */
export const AddStockModal = ({ 
  isOpen, 
  onClose, 
  type, 
  setType, 
  code, 
  setCode, 
  actualCode, 
  setActualCode, 
  avgPrice, 
  setAvgPrice, 
  quantity, 
  setQuantity, 
  loading, 
  errorMsg, 
  setErrorMsg, 
  currency, 
  setCurrency, 
  onSubmit 
}: AddStockModalProps) => {
  // 검색 결과와 드롭다운 표출 여부, 검색 진행 상태를 나타내는 로컬 상태 값들입니다.
  const [searchResults, setSearchResults] = useState<{ code: string, name: string, market: string }[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  
  // [교육용 주석] 
  // 드롭다운의 바깥 빈 영역을 클릭했을 때 창을 예쁘게 닫아주기 위해 HTML 참조(Ref) 객체를 생성합니다.
  const dropdownRef = useRef<HTMLDivElement>(null);

  // [교육용 주석]
  // 모달이 완전히 닫힐 때(isOpen이 false로 바뀔 때) 내부 검색 결과 리스트 및
  // 드롭다운 상태를 깔끔하게 원복(초기화)시켜 메모리 유수를 예방하는 효과적인 Effect입니다.
  useEffect(() => {
    if (!isOpen) {
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [isOpen]);

  // [교육용 주석]
  // 드롭다운 바깥 영역을 클릭했을 때 안전하게 드롭다운이 사라지도록 전역 이벤트 핸들러를 등록합니다.
  // 마우스 클릭 시, dropdownRef 영역 내부가 아닌 바깥 영역이라면 드롭다운 표출을 false로 덮어씁니다.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    // 전역 도큐먼트에 마우스 다운 이벤트를 청취하도록 바인딩합니다.
    document.addEventListener('mousedown', handleClickOutside);
    // 컴포넌트가 사라지거나(unmount) 재실행 시 리스너를 말끔히 반납하여 리소스 낭비를 막는 cleanup입니다.
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // [교육용 주석]
  // 사용자가 종목명을 입력할 때 디바운스(Debounce) 기법을 사용해
  // 타자를 칠 때마다 즉시 서버에 쿼리를 쏘지 않고, 타이핑이 300ms 동안 멈췄을 때만 1회 검색 API를 쏘는 지능형 훅입니다.
  // 불필요한 'showDropdown' 의존성을 제거하여 API가 이중 호출되는 고질적 무한 루프 버그를 해결했습니다.
  useEffect(() => {
    // 1. 예수금이나 기타 자산은 검색 대상이 아니므로 즉시 리턴하고 드롭다운을 닫습니다.
    if (!code || code.length < 1 || type === 'CASH' || type === 'CUSTOM') {
      setSearchResults([]);
      setShowDropdown(false);
      if (type !== 'CASH' && type !== 'CUSTOM') setActualCode('');
      return;
    }

    // 2. [핵심 버그 수정] 이미 종목을 클릭하여 actualCode가 세팅된 완결 상태라면 추가 검색 API 호출을 보존 차단합니다.
    // 만약 사용자가 타이핑을 새로 시작하면 onChange에서 actualCode를 비워주므로 안전하게 재검색이 진행됩니다.
    if (actualCode !== '') {
      return;
    }

    // 300ms 후에 API 호출을 진행하는 디바운스 타이머 설정
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search-stock?q=${encodeURIComponent(code)}&country=${type === 'US_STOCK' ? 'US' : 'KR'}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          // 검색 결과가 존재하는 경우에만 유연하게 드롭다운 리스트를 노출합니다.
          if (data && data.length > 0) {
            setShowDropdown(true);
          } else {
            setShowDropdown(false);
          }
        }
      } catch (err) {
        console.error('종목 자동완성 API 조회 중 시스템 에러 발생:', err);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    // 사용자가 300ms 내로 타자를 계속 치고 있다면 기존의 타이머를 지워(cleanup) 네트워크 호출을 방어합니다.
    return () => clearTimeout(timer);
  }, [code, type, actualCode, setActualCode]);

  // [교육용 주석]
  // 검색 결과 리스트에서 원하는 종목을 마우스로 살포시 클릭했을 때 실행되는 최종 결정 함수입니다.
  // 입력창에는 예쁜 한글 종목명(예: 삼성전자)을 보여주고, 백엔드 전송용 실제 주식코드(예: 005930)를 보관합니다.
  const handleSelectStock = (item: { code: string, name: string }) => {
    setCode(item.name);
    setActualCode(item.code);
    setShowDropdown(false); // 선택이 끝났으니 목록을 감춥니다.
  };

  // [교육용 주석]
  // 미국 주식 / 한국 주식 / 기타 자산 / 예수금 간 탭 전환이 일어날 때 내부의 모든 입력값을
  // 일관성 있게 비워주고 기본 통화(USD/KRW) 규격을 자동으로 초기 맵핑해주는 스마트 탭 제어기입니다.
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

        {/* 자산 분류 선택용 슬라이드 탭 버튼 영역 */}
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
          {/* 예수금(CASH) 선택 시 통화(KRW/USD)를 연동해주는 영역 */}
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

          {/* 종목 입력 상자 및 자동완성 드롭다운을 통합 관리하는 relative 래퍼입니다. */}
          {/* 외부 클릭 감지를 위해 Ref를 맵핑합니다. */}
          <div className="input-group" ref={dropdownRef} style={{ marginBottom: 0, width: '100%', position: 'relative' }}>
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
                // [교육용 주석 & 주요 버그 해결]
                // 사용자가 입력 필드의 값을 타이핑하여 일부라도 수정하면,
                // 이전 선택 결과물(actualCode)을 즉시 깨끗하게 비워주어
                // 훅 내부의 API 요청 차단 구문에 걸려 드롭다운이 안 뜨는 현상을 근절합니다.
                if (type !== 'CUSTOM' && type !== 'CASH') {
                  setActualCode('');
                  setShowDropdown(true);
                }
              }}
              style={{ width: '100%', boxSizing: 'border-box' }}
              autoFocus
              autoComplete="off"
            />
            
            {/* 검색 결과가 매칭되어 리스트가 있고, 표출이 true일 때 절대좌표(Absolute) 드롭다운을 띄웁니다. */}
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
                    style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    className="search-item"
                  >
                    <span style={{ fontWeight: 'bold' }}>{item.name}</span>
                    <span className="text-secondary" style={{ fontSize: '0.8rem' }}>{item.code}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 수량 정보 입력단 */}
          {type !== 'CASH' && (
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">보유 수량</label>
              <input type="number" step="any" className="glass-input" value={quantity} onChange={(e) => setQuantity(e.target.value)} style={{ width: '100%' }} required />
            </div>
          )}

          {/* 평균 단가 혹은 원금액 입력단 */}
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
              
              {/* 기타 자산(CUSTOM) 탭일 때는 통화를 즉석 변경하게 구성합니다. */}
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
