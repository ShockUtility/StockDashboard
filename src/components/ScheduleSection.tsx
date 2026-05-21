'use client';

import React, { useState } from 'react';
import { CalendarEvent, ScheduleType } from '../types/schedule';
import { AddScheduleModal } from './modals/AddScheduleModal';

interface ScheduleSectionProps {
  portfolios: any[]; // 보유 종목 코드 추출용 포트폴리오 리스트
  schedules: CalendarEvent[];
  addSchedule: (event: Omit<CalendarEvent, 'id'>) => void;
  editSchedule: (id: string, event: Omit<CalendarEvent, 'id'>) => void;
  deleteSchedule: (id: string) => void;
  mergeAISchedules: (aiEvents: Omit<CalendarEvent, 'id'>[]) => void;
}

/**
 * [교육용 주석]
 * 주요일정 탭의 전체 레이아웃을 렌더링하는 메인 컴포넌트입니다.
 * 1. 왼쪽: 바닐라 React로 짠 커스텀 캘린더 격자. (등록된 일정을 도트(Dot) 배지로 요약 표시)
 * 2. 오른쪽: 선택한 날짜의 상세 일정 목록 및 추가/수정/삭제 관리 컨트롤.
 * 3. 상단: 보유 종목의 일정을 Yahoo Finance Python 모듈을 통해 원클릭으로 채워 넣는 "🪄 일정 업데이트" 기능 제공.
 * 
 * [수정 사항]
 * - 기존 "선택 종목 업데이트" 모달 및 관련 로직(handleAIUpdate, showSelectStockModal)을 사용자 요청에 따라 제거하였습니다.
 * - 기존 "전체 일정 업데이트" 버튼을 "일정 업데이트" 버튼으로 통합 및 명칭을 수정하였습니다.
 */
export function ScheduleSection({
  portfolios,
  schedules,
  addSchedule,
  editSchedule,
  deleteSchedule,
  mergeAISchedules
}: ScheduleSectionProps) {
  // 1. 현재 표시 중인 달력의 연도와 월 상태 관리 (월은 0부터 11까지)
  const today = new Date();
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  
  // 2. 사용자가 달력에서 선택한 날짜 상태 (포맷: YYYY-MM-DD)
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split('T')[0]
  );

  // 3. 모달 제어 상태
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);

  // 4. AI 일정 업데이트 로딩 상태
  const [aiLoading, setAiLoading] = useState(false);

  // --- 달력 렌더링을 위한 수학적 연산 ---
  // 선택된 달의 1일 요일 (0: 일요일, 1: 월요일, ...)
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();
  // 선택된 달의 마지막 날짜 (예: 30일, 31일)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // 요일 헤더 목록
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  // 월 전환 핸들러
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((prev) => prev - 1);
    } else {
      setCurrentMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((prev) => prev + 1);
    } else {
      setCurrentMonth((prev) => prev + 1);
    }
  };

  // --- 보유 종목 코드 추출 유틸 함수 ---
  // [교육용 주석]
  // - portfolios 데이터 구조를 탐색하여 보유 주식 종목 중 'CASH', 'MANUAL'을 제외한
  //   유효한 한국주식(KR_STOCK) 및 미국주식(US_STOCK) 종목 코드 및 한글 이름을 고유하게 추출합니다.
  const getUniqueStockCodes = () => {
    const uniqueStocks: { code: string; name: string }[] = [];
    const seenCodes = new Set<string>();

    portfolios.forEach((p) => {
      if (p.assets && Array.isArray(p.assets)) {
        p.assets.forEach((a: any) => {
          if (a.type === 'KR_STOCK' || a.type === 'US_STOCK') {
            if (a.code && a.code !== 'CASH' && a.code !== 'MANUAL') {
              const upperCode = a.code.toUpperCase();
              if (!seenCodes.has(upperCode)) {
                seenCodes.add(upperCode);
                uniqueStocks.push({
                  code: upperCode,
                  name: a.name || upperCode
                });
              }
            }
          }
        });
      }
    });
    return uniqueStocks;
  };

  // --- 일정 일괄 업데이트 로직 ---
  // [교육용 주석]
  // - 보유하고 있는 모든 주식 종목의 코드를 추출해 백엔드 API에 전달함으로써,
  //   한 번의 호출로 보유 중인 모든 종목의 금융 일정을 일괄 수집하여 병합 처리합니다.
  // - Python 스크립트 기반 고속 조회 방식으로 개편되어 1~2초 내에 완료됩니다.
  const handleAllStocksUpdate = async () => {
    const uniqueStocks = getUniqueStockCodes();
    
    if (uniqueStocks.length === 0) {
      alert('보유 중인 주식 종목이 없습니다. 계좌관리에서 주식을 먼저 등록해 주세요.');
      return;
    }

    setAiLoading(true);

    try {
      const stockCodes = uniqueStocks.map((s) => s.code);
      const stockNames = uniqueStocks.map((s) => s.name).join(', ');

      const res = await fetch('/api/ai-update-schedules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ codes: stockCodes })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '일정을 가져오는 도중 오류가 발생했습니다.');
      }

      if (data.events && Array.isArray(data.events)) {
        mergeAISchedules(data.events);
      }

      alert(`🎉 다음 종목들의 일정을 성공적으로 수집하여 병합을 완료했습니다!\n[${stockNames}]`);

    } catch (err: any) {
      console.error(err);
      alert(`오류 발생: ${err.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  // --- UI 헬퍼 함수 ---
  // 특정 날짜(YYYY-MM-DD)에 해당하는 일정 목록 필터링
  const getEventsForDate = (dateStr: string) => {
    return schedules.filter((event) => event.date === dateStr);
  };

  // 일정 분류별 배지 스타일 및 아이콘 구하기
  const getTypeBadge = (type: ScheduleType) => {
    const badges: Record<ScheduleType, { text: string; bg: string; color: string }> = {
      EARNINGS: { text: '실적발표', bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa' },
      IPO: { text: 'IPO', bg: 'rgba(139, 92, 246, 0.15)', color: '#c084fc' },
      DIVIDEND: { text: '배당일', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
      CONFERENCE: { text: '학회', bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' },
      OTHER: { text: '기타', bg: 'rgba(148, 163, 184, 0.15)', color: '#cbd5e1' }
    };
    return badges[type] || badges.OTHER;
  };

  // 달력 격자에 채워질 날짜 리스트 생성
  const renderCalendarDays = () => {
    const days = [];

    // 1) 1일이 시작하는 요일 전까지 빈 칸 채우기
    for (let i = 0; i < firstDayOfWeek; i++) {
      days.push(<div key={`empty-${i}`} style={{ opacity: 0.15, height: '100%', minWidth: 0 }} />);
    }

    // 2) 1일부터 마지막 날까지 날짜 카드 그리기
    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dateKey = `${currentYear}-${monthStr}-${dayStr}`;

      const isSelected = selectedDate === dateKey;
      const isToday =
        today.getFullYear() === currentYear &&
        today.getMonth() === currentMonth &&
        today.getDate() === day;

      const dateEvents = getEventsForDate(dateKey);

      days.push(
        <div
          key={`day-${day}`}
          onClick={() => setSelectedDate(dateKey)}
          style={{
            height: '100%',
            minWidth: 0, // [교육용 주석] 그리드 셀이 텍스트 길이에 늘어나지 않게 최소 너비를 0으로 강제합니다.
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px',
            borderRadius: '12px',
            border: isSelected 
              ? '1.5px solid var(--accent-blue)' 
              : '1px solid rgba(255,255,255,0.05)',
            background: isSelected 
              ? 'rgba(59, 130, 246, 0.1)' 
              : isToday 
                ? 'rgba(255,255,255,0.08)' 
                : 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            position: 'relative',
            overflow: 'hidden' // [교육용 주석] 내부 일정이 넘치더라도 카드를 튀어나가지 않게 합니다.
          }}
          onMouseEnter={(e) => {
            if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
          }}
          onMouseLeave={(e) => {
            if (!isSelected) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)';
          }}
        >
          {/* 날짜 표시 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontWeight: isToday ? 'bold' : 'normal',
              color: isToday ? 'var(--accent-blue)' : 'var(--text-primary)',
              fontSize: '0.95rem'
            }}>
              {day}
            </span>
            {isToday && (
              <span style={{
                fontSize: '0.65rem',
                background: 'var(--accent-blue)',
                padding: '2px 6px',
                borderRadius: '8px',
                color: 'white'
              }}>
                오늘
              </span>
            )}
          </div>

          {/* 등록된 일정이 있다면 도트 또는 텍스트 목록 배지 렌더링 */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px', width: '100%', minWidth: 0 }}>
            {dateEvents.slice(0, 2).map((event) => {
              const badge = getTypeBadge(event.type);
              return (
                <div
                  key={event.id}
                  style={{
                    fontSize: '0.65rem',
                    background: badge.bg,
                    color: badge.color,
                    padding: '2px 4px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%'
                  }}
                  title={event.title}
                >
                  {event.isAI ? '🪄 ' : ''}{event.stockName ? `[${event.stockName}] ` : ''}{event.title}
                </div>
              );
            })}
            {dateEvents.length > 2 && (
              <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 'bold' }}>
                +{dateEvents.length - 2}개 더보기
              </div>
            )}
          </div>
        </div>
      );
    }

    return days;
  };

  // 현재 선택된 날짜에 매칭된 일정 목록
  const selectedDateEvents = getEventsForDate(selectedDate);
  const [selectedY, selectedM, selectedD] = selectedDate.split('-');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* 상단 컨트롤 및 헤더 영역 */}
      <header className="glass-panel" style={{
        display: 'flex', flexDirection: 'column',
        padding: '16px 24px', gap: '16px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button className="glass-button" onClick={handlePrevMonth} style={{ width: 'auto', padding: '8px 16px' }}>◀ 이전 달</button>
            <h2 style={{ margin: 0, fontSize: '1.4rem', minWidth: '120px', textAlign: 'center' }}>
              {currentYear}년 {currentMonth + 1}월
            </h2>
            <button className="glass-button" onClick={handleNextMonth} style={{ width: 'auto', padding: '8px 16px' }}>다음 달 ▶</button>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* [교육용 주석] 전체 종목 일정을 한 번에 일괄 수집하는 초고속 업데이트 버튼입니다. */}
            <button
              className="glass-button"
              onClick={handleAllStocksUpdate}
              disabled={aiLoading}
              style={{
                width: 'auto', padding: '10px 20px',
                background: aiLoading 
                  ? 'rgba(255,255,255,0.05)' 
                  : 'linear-gradient(135deg, #10b981, #3b82f6)',
                color: 'white',
                position: 'relative'
              }}
            >
              {aiLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="spinner" style={{
                    width: '14px', height: '14px', border: '2px solid white',
                    borderTopColor: 'transparent', borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  분석 중...
                </span>
              ) : (
                '🪄 일정 업데이트'
              )}
            </button>

            <button
              className="glass-button"
              onClick={() => { setEditingEvent(null); setShowAddModal(true); }}
              style={{ width: 'auto', padding: '10px 20px', background: 'rgba(59, 130, 246, 0.3)' }}
            >
              ➕ 일정 추가
            </button>
          </div>
        </div>
      </header>

      {/* 대시보드 2컬럼 레이아웃 */}
      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 380px', gap: '24px' }}>
        
        {/* 왼쪽: 커스텀 달력 그리드 */}
        <section className="glass-panel" style={{ padding: '24px' }}>
          {/* 요일 헤더 */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '8px', marginBottom: '12px', textAlign: 'center'
          }}>
            {weekdays.map((day, idx) => (
              <div
                key={day}
                style={{
                  fontWeight: 'bold',
                  fontSize: '0.85rem',
                  color: idx === 0 ? '#ff5555' : idx === 6 ? '#5588ff' : 'var(--text-secondary)',
                  paddingBottom: '8px',
                  borderBottom: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 달력 날짜 카드 격자 */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: '100px', // [교육용 주석] 모든 날짜 칸의 높이를 100px로 일치시켜 내용 유무와 상관없이 완벽한 격자 구조를 이룹니다.
            gap: '8px'
          }}>
            {renderCalendarDays()}
          </div>
        </section>

        {/* 오른쪽: 선택된 날짜의 일정 상세 정보 */}
        <section className="glass-panel" style={{
          display: 'flex', flexDirection: 'column', padding: '24px', justifyContent: 'flex-start'
        }}>
          <h3 style={{
            fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline'
          }}>
            <span>📅 {selectedY}년 {selectedM}월 {selectedD}일</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              일정 {selectedDateEvents.length}개
            </span>
          </h3>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: '12px',
            overflowY: 'auto', maxHeight: '420px', flexGrow: 1, paddingRight: '4px'
          }}>
            {selectedDateEvents.length === 0 ? (
              <div style={{
                padding: '40px 0', color: 'var(--text-secondary)', textAlign: 'center',
                fontSize: '0.9rem', display: 'flex', flexDirection: 'column', gap: '8px'
              }}>
                <span>등록된 일정이 없습니다.</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                  오른쪽 위의 "일정 업데이트" 버튼을 누르거나 일정을 직접 등록해 보세요!
                </span>
              </div>
            ) : (
              selectedDateEvents.map((event) => {
                const badge = getTypeBadge(event.type);
                return (
                  <div
                    key={event.id}
                    className="glass-panel"
                    style={{
                      padding: '16px', background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px',
                      display: 'flex', flexDirection: 'column', gap: '8px',
                      transition: 'transform 0.2s', transform: 'none' // 호버 튀어오름 방지
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', textAlign: 'left' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span
                            className="clickable-stock-name"
                            style={{
                              fontWeight: 'bold', fontSize: '0.95rem', color: 'var(--text-primary)',
                              cursor: 'pointer'
                            }}
                            onClick={() => { setEditingEvent(event); setShowAddModal(true); }}
                          >
                            {event.title}
                          </span>
                          {event.isAI && (
                            <span style={{
                              fontSize: '0.65rem',
                              background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.25), rgba(59, 130, 246, 0.25))',
                              border: '1px solid rgba(167, 139, 250, 0.4)',
                              color: '#c084fc',
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontWeight: 'bold',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '2px'
                            }}>
                              🪄 AI 수집
                            </span>
                          )}
                        </div>
                        {event.stockCode && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            🔗 연동 종목: {event.stockName || event.stockCode} ({event.stockCode})
                          </span>
                        )}
                      </div>
                      
                      <span style={{
                        fontSize: '0.65rem', background: badge.bg, color: badge.color,
                        padding: '3px 8px', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap'
                      }}>
                        {badge.text}
                      </span>
                    </div>

                    {event.description && (
                      <p style={{
                        fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0,
                        textAlign: 'left', background: 'rgba(0,0,0,0.15)', padding: '8px 10px',
                        borderRadius: '6px', whiteSpace: 'pre-wrap'
                      }}>
                        {event.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button
                        className="glass-button"
                        onClick={() => { setEditingEvent(event); setShowAddModal(true); }}
                        style={{
                          width: 'auto', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)'
                        }}
                      >
                        ⚙️ 수정
                      </button>
                      <button
                        className="glass-button"
                        onClick={() => {
                          if (confirm('이 일정을 정말 삭제하시겠습니까?')) {
                            deleteSchedule(event.id);
                          }
                        }}
                        style={{
                          width: 'auto', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px',
                          background: 'rgba(239,68,68,0.15)', color: '#ff5555', border: '1px solid rgba(239,68,68,0.2)'
                        }}
                      >
                        🗑️ 삭제
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <button
            className="glass-button"
            onClick={() => {
              setEditingEvent(null);
              // 모달 열 때 현재 달력에서 클릭한 날짜가 기본 세팅되도록 설정
              setShowAddModal(true);
            }}
            style={{ marginTop: '16px', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' }}
          >
            ➕ 현재 날짜에 일정 추가
          </button>
        </section>
      </div>

      {/* 일정 등록 및 편집 모달 */}
      <AddScheduleModal
        isOpen={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingEvent(null); }}
        onSubmit={(formEvent) => {
          if (editingEvent) {
            editSchedule(editingEvent.id, formEvent);
          } else {
            addSchedule(formEvent);
          }
        }}
        onDelete={deleteSchedule}
        initialEvent={editingEvent}
      />
    </div>
  );
}
