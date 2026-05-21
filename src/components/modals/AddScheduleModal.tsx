'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CalendarEvent, ScheduleType } from '../../types/schedule';

interface AddScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<CalendarEvent, 'id'>) => void;
  onDelete?: (id: string) => void;
  initialEvent: CalendarEvent | null; // 수정 모드일 때 기입되는 초기 일정 데이터
}

/**
 * [교육용 주석]
 * 주요일정을 수동으로 생성하거나 편집/삭제하는 글래스모피즘 디자인의 모달 컴포넌트입니다.
 * 종목 검색 API(/api/search-stock)를 활용하여 사용자가 입력하는 종목의 코드와 이름을 자동완성 검색해 줍니다.
 */
export function AddScheduleModal({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  initialEvent
}: AddScheduleModalProps) {
  // 1. 입력 폼의 상태 정의
  const [date, setDate] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ScheduleType>('EARNINGS');
  const [description, setDescription] = useState('');

  // 2. 주식 종목 연동 관련 상태 정의
  const [linkStock, setLinkStock] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [country, setCountry] = useState<'KR' | 'US'>('KR');
  const [searchResults, setSearchResults] = useState<{ code: string; name: string; market: string }[]>([]);
  const [selectedStock, setSelectedStock] = useState<{ code: string; name: string } | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 3. 수정 모드(initialEvent가 있는 경우)와 등록 모드일 때 상태 초기화
  useEffect(() => {
    if (isOpen) {
      if (initialEvent) {
        setDate(initialEvent.date);
        setTitle(initialEvent.title);
        setType(initialEvent.type);
        setDescription(initialEvent.description || '');
        if (initialEvent.stockCode) {
          setLinkStock(true);
          setSelectedStock({
            code: initialEvent.stockCode,
            name: initialEvent.stockName || initialEvent.stockCode
          });
          setSearchQuery(initialEvent.stockName || initialEvent.stockCode);
        } else {
          setLinkStock(false);
          setSelectedStock(null);
          setSearchQuery('');
        }
      } else {
        // 등록 모드 초기화 (날짜는 기본적으로 오늘 날짜 지정)
        const today = new Date().toISOString().split('T')[0];
        setDate(today);
        setTitle('');
        setType('EARNINGS');
        setDescription('');
        setLinkStock(false);
        setSelectedStock(null);
        setSearchQuery('');
      }
      setSearchResults([]);
      setShowDropdown(false);
    }
  }, [isOpen, initialEvent]);

  // 4. 종목 자동완성 검색 API 호출 로직
  useEffect(() => {
    if (!searchQuery || selectedStock?.name === searchQuery) {
      setSearchResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search-stock?q=${encodeURIComponent(searchQuery)}&country=${country}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data);
          setShowDropdown(true);
        }
      } catch (err) {
        console.error('종목 검색 오류:', err);
      }
    }, 300); // 디바운싱 적용 (타이핑 후 0.3초 대기)

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, country, selectedStock]);

  // 5. 모달 바깥을 클릭했을 때 자동완성 드롭다운 닫기
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!isOpen) return null;

  // 6. 폼 전송 이벤트 처리
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !title) {
      alert('날짜와 제목을 입력해주세요.');
      return;
    }

    onSubmit({
      date,
      title,
      type,
      description: description || undefined,
      stockCode: linkStock && selectedStock ? selectedStock.code : undefined,
      stockName: linkStock && selectedStock ? selectedStock.name : undefined
    });
    onClose();
  };

  // 7. 검색 결과에서 종목을 선택했을 때 처리
  const handleSelectStock = (stock: { code: string; name: string }) => {
    setSelectedStock(stock);
    setSearchQuery(stock.name);
    setShowDropdown(false);

    // [교육용 주석] 사용자가 종목을 선택하면, 제목을 자동으로 형식에 맞춰 채워 편의성을 높입니다.
    const suffixMap: Record<ScheduleType, string> = {
      EARNINGS: ' 실적 발표',
      IPO: ' 신규 상장(IPO)',
      DIVIDEND: ' 배당락일/배당지급일',
      CONFERENCE: ' 컨퍼런스/학회',
      OTHER: ' 일정'
    };
    setTitle(`${stock.name}${suffixMap[type]}`);
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', opacity: 1 }}>
      <div className="modal-content" style={{ transform: 'scale(1)', maxWidth: '520px' }}>
        <button className="modal-close" onClick={onClose} aria-label="닫기">
          ✕
        </button>

        <h3 style={{ fontSize: '1.5rem', marginBottom: '24px', textAlign: 'left', fontWeight: 'bold' }}>
          {initialEvent ? '📅 일정 수정' : '📅 일정 추가'}
        </h3>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          {/* 일정 날짜 입력 */}
          <div className="input-group">
            <label className="input-label">날짜</label>
            <input
              type="date"
              className="glass-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          {/* 일정 분류 선택 */}
          <div className="input-group">
            <label className="input-label">일정 분류</label>
            <select
              className="glass-input"
              value={type}
              onChange={(e) => setType(e.target.value as ScheduleType)}
              style={{ width: '100%', background: '#1e293b' }}
            >
              <option value="EARNINGS">📉 실적 발표</option>
              <option value="IPO">🚀 신규 상장 (IPO)</option>
              <option value="DIVIDEND">💵 배당일</option>
              <option value="CONFERENCE">🗣️ 학회 / 콘퍼런스</option>
              <option value="OTHER">📌 기타 주요 일정</option>
            </select>
          </div>

          {/* 주식 종목 연동 체크박스 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '4px 0' }}>
            <input
              type="checkbox"
              id="linkStockCheck"
              checked={linkStock}
              onChange={(e) => {
                setLinkStock(e.target.checked);
                if (!e.target.checked) {
                  setSelectedStock(null);
                  setSearchQuery('');
                }
              }}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <label htmlFor="linkStockCheck" style={{ fontSize: '0.9rem', color: 'var(--text-primary)', cursor: 'pointer' }}>
              특정 주식 종목 연동하기
            </label>
          </div>

          {/* 종목 자동완성 검색창 (체크 시 활성화) */}
          {linkStock && (
            <div className="input-group" style={{ position: 'relative' }} ref={dropdownRef}>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                <button
                  type="button"
                  className="glass-button"
                  onClick={() => { setCountry('KR'); setSelectedStock(null); setSearchQuery(''); }}
                  style={{
                    padding: '6px 12px', fontSize: '0.8rem', width: 'auto',
                    background: country === 'KR' ? 'var(--accent-blue)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  🇰🇷 한국 주식
                </button>
                <button
                  type="button"
                  className="glass-button"
                  onClick={() => { setCountry('US'); setSelectedStock(null); setSearchQuery(''); }}
                  style={{
                    padding: '6px 12px', fontSize: '0.8rem', width: 'auto',
                    background: country === 'US' ? 'var(--accent-purple)' : 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  🇺🇸 미국 주식
                </button>
              </div>

              <input
                type="text"
                className="glass-input"
                placeholder={country === 'KR' ? '종목명 또는 초성 입력 (예: 삼성)' : '티커 또는 종목명 입력 (예: AAPL)'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%' }}
              />

              {/* 검색 드롭다운 결과 */}
              {showDropdown && searchResults.length > 0 && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, right: 0,
                  background: '#0f172a', border: '1px solid var(--glass-border)',
                  borderRadius: '8px', zIndex: 100, maxHeight: '200px', overflowY: 'auto',
                  marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)'
                }}>
                  {searchResults.map((stock) => (
                    <div
                      key={stock.code}
                      onClick={() => handleSelectStock(stock)}
                      style={{
                        padding: '10px 16px', cursor: 'pointer', fontSize: '0.9rem',
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{stock.name}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{stock.code} ({stock.market})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 일정 제목 입력 */}
          <div className="input-group">
            <label className="input-label">일정 제목</label>
            <input
              type="text"
              className="glass-input"
              placeholder="예: 삼성전자 실적 발표"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ width: '100%' }}
            />
          </div>

          {/* 일정 상세 설명 입력 */}
          <div className="input-group">
            <label className="input-label">상세 내용 (선택)</label>
            <textarea
              className="glass-input"
              placeholder="세부적인 내용이나 예상치를 적어보세요."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'none' }}
            />
          </div>

          {/* 버튼 컨트롤 영역 */}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            {initialEvent && onDelete && (
              <button
                type="button"
                className="glass-button"
                onClick={() => {
                  if (confirm('이 일정을 삭제하시겠습니까?')) {
                    onDelete(initialEvent.id);
                    onClose();
                  }
                }}
                style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ff5555', border: '1px solid rgba(239, 68, 68, 0.4)', flex: 1 }}
              >
                🗑️ 삭제
              </button>
            )}
            <button
              type="submit"
              className="glass-button"
              style={{ flex: 2 }}
            >
              💾 저장하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
