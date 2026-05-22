'use client';

import React, { useState } from 'react';
import { Mic, Star, DollarSign, Lock, Pencil, Circle, Bot, Trash2, RefreshCw, Plus } from 'lucide-react';
import { CalendarEvent, ScheduleType } from '../types/schedule';
import { AddScheduleModal } from './modals/AddScheduleModal';

// [교육용 주석] 일정 종류에 따른 무료 라이센스(MIT)의 고화질 단색 벡터 아이콘 및 전용 고정 색상 설정 테이블입니다.
// 컬러 이모지 대신 기기별 일관성을 지니고 텍스트 색상(color)에 매핑되는 lucide-react의 아이콘들을 채택했습니다.
export const SCHEDULE_TYPE_CONFIG = {
  EARNINGS: {
    text: '실적발표',
    icon: Mic, // 마스크 대신 사용자의 피드백을 반영해 단색 마이크 아이콘으로 적용
    color: '#60a5fa',
    bg: 'rgba(59, 130, 246, 0.12)',
    borderColor: 'rgba(59, 130, 246, 0.25)'
  },
  IPO: {
    text: '신규상장',
    icon: Star, // 요청에 따라 별 모양 아이콘으로 변경
    color: '#c084fc',
    bg: 'rgba(139, 92, 246, 0.12)',
    borderColor: 'rgba(139, 92, 246, 0.25)'
  },
  DIVIDEND: {
    text: '배당금', // 사용자의 피드백을 반영하여 '배당일'에서 '배당금'으로 명칭 통일
    icon: DollarSign, // 요청에 따라 달러 기호 아이콘으로 변경
    color: '#fbbf24',
    bg: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.25)'
  },
  EX_DIVIDEND: {
    text: '배당락',
    icon: Lock, // 요청에 따라 독자 분리 및 자물쇠 아이콘으로 신설
    color: '#f97316',
    bg: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.25)'
  },
  CONFERENCE: {
    text: '학회/세미나',
    icon: Pencil, // 요청에 따라 연필 아이콘으로 변경
    color: '#34d399',
    bg: 'rgba(16, 185, 129, 0.12)',
    borderColor: 'rgba(16, 185, 129, 0.25)'
  },
  OTHER: {
    text: '기타일정',
    icon: Circle, // 요청에 따라 서클(원형) 아이콘으로 변경
    color: '#94a3b8',
    bg: 'rgba(148, 163, 184, 0.12)',
    borderColor: 'rgba(148, 163, 184, 0.2)'
  }
};

// [교육용 주석] 
// 저장되어 있거나 수동 입력된 제목 내에 포함될 수 있는 유니코드 컬러 이모지 및
// 기존 데이터에 삽입되어 있을 수 있는 "[AI 수집]", "AI 수집" 등의 문자열을 깔끔하게 제거해 주는 정제 함수입니다.
// 달력의 단색 기호(■, ▲ 등)와 중복 노출되는 것을 차단하고 텍스트만 단정하게 출력합니다.
export const removeEmojis = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '') // 컬러 이모지 제거
    .replace(/\[?AI\s*수집\]?/g, '') // "[AI 수집]", "AI 수집", "[AI수집]" 등 텍스트 제거
    .trim();
};

interface ScheduleSectionProps {
  portfolios: any[]; // 보유 종목 코드 추출용 포트폴리오 리스트
  schedules: CalendarEvent[];
  addSchedule: (event: Omit<CalendarEvent, 'id' | 'isAI'>) => void;
  editSchedule: (id: string, event: Omit<CalendarEvent, 'id' | 'isAI'>) => void;
  deleteSchedule: (id: string) => void;
  deleteSchedulesByStock: (stockCode: string) => void;
  mergeAISchedules: (aiEvents: Omit<CalendarEvent, 'id'>[]) => void;
}

/**
 * [교육용 주석]
 * 주요일정 탭의 전체 레이아웃을 렌더링하는 메인 컴포넌트입니다.
 * 1. 캘린더 화면: 등록된 일정을 단색 아이콘과 전용 고정 색상 배지로 요약 표시합니다.
 * 2. 상세 영역: 선택한 날짜의 상세 일정을 카드 형태로 보여주며 연동된 종목의 일괄 삭제 옵션을 제공합니다.
 */
export function ScheduleSection({
  portfolios,
  schedules,
  addSchedule,
  editSchedule,
  deleteSchedule,
  deleteSchedulesByStock,
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

  // 5. 삭제 확인 커스텀 모달 상태 관리
  const [deletingEvent, setDeletingEvent] = useState<CalendarEvent | null>(null);

  // 6. [교육용 주석] 모바일 화면(가로 768px 이하)에서 달력 일자 셀을 터치했을 때 띄워줄 상세 일정 팝업 모달 노출 상태입니다.
  const [showMobileDetail, setShowMobileDetail] = useState(false);



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

  // --- 보유 종목 코드 추출 유틸 기능 ---
  // [교육용 주석]
  // - portfolios 데이터 구조를 탐색하여 보유 주식 종목 중 'CASH', 'MANUAL'을 제외한
  //   유효한 한국주식(KR_STOCK) 및 미국주식(US_STOCK) 종목 코드 및 한글 이름을 고유하게 추출하여 메모이징(useMemo)합니다.
  const uniqueStocks = React.useMemo(() => {
    const list: { code: string; name: string }[] = [];
    const seenCodes = new Set<string>();

    portfolios.forEach((p) => {
      if (p.assets && Array.isArray(p.assets)) {
        p.assets.forEach((a: any) => {
          if (a.type === 'KR_STOCK' || a.type === 'US_STOCK') {
            if (a.code && a.code !== 'CASH' && a.code !== 'MANUAL') {
              const upperCode = a.code.toUpperCase();
              if (!seenCodes.has(upperCode)) {
                seenCodes.add(upperCode);
                list.push({
                  code: upperCode,
                  name: a.name || upperCode
                });
              }
            }
          }
        });
      }
    });
    return list;
  }, [portfolios]);

  // [교육용 주석] 종목 코드를 바탕으로 포트폴리오에 등록된 실제 종목명을 조회하는 헬퍼 함수입니다.
  const getStockNameByCode = (code?: string): string => {
    if (!code) return '';
    const upperCode = code.toUpperCase();
    const found = uniqueStocks.find(s => s.code === upperCode);
    return found && found.name !== found.code ? found.name : '';
  };

  // [교육용 주석] 일정 제목이 종목 티커로 시작하는 경우(예: "AAPL 배당금 지급"), 종목 한글 이름으로 치환하여 노출합니다.
  const getDisplayTitle = (event: CalendarEvent): string => {
    let displayTitle = removeEmojis(event.title);
    if (event.stockCode) {
      const upperCode = event.stockCode.toUpperCase();
      if (displayTitle.toUpperCase().startsWith(upperCode)) {
        let resolvedName = event.stockName;
        if (!resolvedName || resolvedName === event.stockCode) {
          resolvedName = getStockNameByCode(event.stockCode);
        }
        if (resolvedName && resolvedName !== event.stockCode) {
          // 티커 부분만 실제 종목명으로 치환
          displayTitle = resolvedName + displayTitle.substring(event.stockCode.length);
        }
      }
    }
    return displayTitle;
  };

  // --- 일정 일괄 업데이트 로직 ---
  // [교육용 주석]
  // - 보유하고 있는 모든 주식 종목의 코드를 추출해 백엔드 API에 전달함으로써,
  //   한 번의 호출로 보유 중인 모든 종목의 금융 일정을 일괄 수집하여 병합 처리합니다.
  // - Python 스크립트 기반 고속 조회 방식으로 개편되어 1~2초 내에 완료됩니다.
  const handleAllStocksUpdate = async () => {
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
        // [교육용 주석] 
        // 백엔드 API는 stockName 없이 stockCode만 리턴하므로,
        // 이미 컴포넌트 상단에서 보유 종목들로 정제해 둔 uniqueStocks 리스트를 활용하여
        // 매칭되는 종목의 한글/영문 종목명(name)을 동적으로 보완해 줍니다.
        // 또한 일정 제목이 티커로 시작하는 경우(예: "AAPL 배당금..."), 이를 한글명(예: "애플 배당금...")으로 미리 치환하여 저장합니다.
        const enrichedEvents = data.events.map((evt: any) => {
          const matchingStock = uniqueStocks.find(
            (s) => s.code.toUpperCase() === evt.stockCode.toUpperCase()
          );
          const stockName = matchingStock ? matchingStock.name : evt.stockCode;

          let enrichedTitle = evt.title;
          if (evt.stockCode && stockName && stockName !== evt.stockCode) {
            const upperCode = evt.stockCode.toUpperCase();
            if (evt.title.toUpperCase().startsWith(upperCode)) {
              enrichedTitle = stockName + evt.title.substring(evt.stockCode.length);
            }
          }

          return {
            ...evt,
            stockName,
            title: enrichedTitle
          };
        });
        mergeAISchedules(enrichedEvents);
      }

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
    return SCHEDULE_TYPE_CONFIG[type] || SCHEDULE_TYPE_CONFIG.OTHER;
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
          onClick={() => {
            setSelectedDate(dateKey);
            // [교육용 주석] 사용자가 스마트폰 등 좁은 화면(가로 768px 이하)에서 일자를 터치(클릭)했을 때에만
            // 상세 목록을 콤팩트한 글래스모피즘 모달 팝업으로 띄우도록 설정하여 모바일 UX 가독성을 높입니다.
            if (typeof window !== 'undefined' && window.innerWidth <= 768) {
              setShowMobileDetail(true);
            }
          }}
          className="calendar-grid-cell"
          style={{
            height: '100%',
            minWidth: 0, // [교육용 주석] 그리드 셀이 텍스트 길이에 늘어나지 않게 최소 너비를 0으로 강제합니다.
            width: '100%',
            boxSizing: 'border-box',
            padding: '4px 6px',
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
            justifyContent: 'flex-start',
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
          {/* [교육용 주석] 
              오늘 날짜일 때 우상단에 표시되던 파란색 "오늘" 텍스트 배지를 완전히 제거했습니다.
              대신 오늘 날짜임을 한눈에 식별할 수 있도록 아래 span 태그의 굵은 파란색 텍스트 강조(color: var(--accent-blue), fontWeight: bold)는 그대로 유지하여 복잡하지 않고 직관적인 UI를 제공합니다. */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{
              fontWeight: isToday ? 'bold' : 'normal',
              color: isToday ? 'var(--accent-blue)' : 'var(--text-primary)',
              fontSize: '0.95rem'
            }}>
              {day}
            </span>
          </div>

          {/* 등록된 일정이 있다면 도트 또는 텍스트 목록 배지 렌더링 */}
          <div className="calendar-events-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.5px', marginTop: '6px', width: '100%', minWidth: 0 }}>
            {dateEvents.slice(0, dateEvents.length > 5 ? 4 : 5).map((event) => {
              const badge = getTypeBadge(event.type);
              const SvgIcon = badge.icon;
              return (
                <div
                  key={event.id}
                  className="calendar-event-badge"
                  style={{
                    fontSize: '0.62rem',
                    background: badge.bg,
                    color: badge.color,
                    border: `1px solid ${badge.borderColor}`,
                    padding: '1px 3px',
                    borderRadius: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                  title={event.isAI ? `${removeEmojis(event.title)} (자동 수집)` : removeEmojis(event.title)}
                >
                  {/* [교육용 주석] 
                      lucide-react의 벡터 SVG 아이콘을 렌더링합니다.
                      이모지 중복 노출을 차단하기 위해 removeEmojis 헬퍼 함수를 적용하여 
                      타이틀 내부의 컬러 이모지를 제거하고 텍스트만 깔끔하게 출력합니다. */}
                  <SvgIcon size={10} strokeWidth={2.5} style={{ flexShrink: 0 }} />
                  {/* [교육용 주석] 
                      1. 달력 요약 배지에서 티커(코드)는 표시하지 않고 유효한 한글/영문 종목 이름(stockName)만 대괄호로 표시합니다.
                         종목 이름이 없는 경우(티커와 동일하거나 비어있는 등) 대괄호 접두사 자체를 생략합니다.
                      2. 달력 칸이 좁으므로 핵심 일정 키워드를 축약 표기합니다.
                         - 배당일(DIVIDEND) -> "배당금"
                         - 배당락(EX_DIVIDEND) -> "배당락"
                         - 실적발표(EARNINGS) -> "실적발표"
                         - 신규상장(IPO) -> "신규상장"
                         - 학회/콘퍼런스(CONFERENCE) -> "학회/세미나"
                         - 기타일정(OTHER) -> 원래 제목에서 이모지 제거하여 표시 */}
                  <span className="desktop-only" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {(() => {
                      // [교육용 주석] event.stockName이 티커 코드와 같거나 누락되었을 경우, 포트폴리오 내의 실제 이름을 찾아 매핑합니다.
                      let resolvedName = event.stockName;
                      if (!resolvedName || resolvedName === event.stockCode) {
                        resolvedName = getStockNameByCode(event.stockCode);
                      }

                      const hasValidName = resolvedName && resolvedName !== event.stockCode;
                      const prefix = hasValidName ? `[${resolvedName}] ` : '';

                      let displayName = '';
                      switch (event.type) {
                        case 'DIVIDEND':
                          displayName = '배당금';
                          break;
                        case 'EX_DIVIDEND':
                          displayName = '배당락';
                          break;
                        case 'EARNINGS':
                          displayName = '실적발표';
                          break;
                        case 'IPO':
                          displayName = '신규상장';
                          break;
                        case 'CONFERENCE':
                          displayName = '학회/세미나';
                          break;
                        default:
                          displayName = getDisplayTitle(event);
                      }

                      return `${prefix}${displayName}`;
                    })()}
                  </span>
                </div>
              );
            })}
            {dateEvents.length > 5 && (
              <div className="desktop-only" style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', textAlign: 'right', fontWeight: 'bold', paddingRight: '4px', marginTop: '1.5px' }}>
                +{dateEvents.length - 4}개 더보기
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
          {/* [교육용 주석] 사용자의 요청에 따라 년월 라벨과의 간격(gap)을 16px에서 6px로 오밀조밀하게 대폭 좁혔습니다. */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* [교육용 주석] 버튼 좌우 크기를 좁히기 위해 좌우 padding을 14px에서 10px로 축소하고 상하 패딩도 6px로 다듬었습니다. */}
            <button className="glass-button" onClick={handlePrevMonth} style={{ width: 'auto', padding: '6px 10px', fontSize: '0.9rem' }}>◀</button>
            {/* 년월 표기 라벨의 minWidth를 auto로 풀어서 가로로 필요 없는 낭비 공간을 최소화했습니다. */}
            <h2 style={{ margin: 0, fontSize: '1.25rem', minWidth: 'auto', textAlign: 'center', padding: '0 4px' }}>
              {currentYear}년 {currentMonth + 1}월
            </h2>
            <button className="glass-button" onClick={handleNextMonth} style={{ width: 'auto', padding: '6px 10px', fontSize: '0.9rem' }}>▶</button>
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {/* [교육용 주석] 
                일정 업데이트 버튼: 이모지 대신 Sparkles 흰색 벡터 아이콘을 사용하고,
                모바일에서는 라벨 텍스트가 숨겨져 아이콘만 단독 표시됩니다. */}
            <button
              className="glass-button schedule-action-btn"
              onClick={handleAllStocksUpdate}
              disabled={aiLoading}
              style={{
                width: 'auto',
                background: aiLoading
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, #10b981, #3b82f6)',
                color: 'white',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {aiLoading ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="spinner" style={{
                    width: '14px', height: '14px', border: '2px solid white',
                    borderTopColor: 'transparent', borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span className="desktop-only">분석 중...</span>
                </span>
              ) : (
                <>
                  <RefreshCw size={16} strokeWidth={2.5} color="white" />
                  <span className="desktop-only">일정 업데이트</span>
                </>
              )}
            </button>

            {/* [교육용 주석] 
                일정 추가 버튼: 이모지 대신 Plus 흰색 벡터 아이콘으로 교체하고,
                모바일에서는 라벨을 숨기고 아이콘만 표시합니다. */}
            <button
              className="glass-button schedule-action-btn"
              onClick={() => { setEditingEvent(null); setShowAddModal(true); }}
              style={{ width: 'auto', background: 'rgba(59, 130, 246, 0.3)', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} strokeWidth={2.5} color="white" />
              <span className="desktop-only">일정 추가</span>
            </button>
          </div>
        </div>
      </header>

      {/* 대시보드 2컬럼 레이아웃 */}
      <div className="schedule-grid">

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
          {/* [교육용 주석]
              모바일 화면에서 인라인 스타일로 지정된 gridAutoRows: '140px' 및 gap: '8px' 속성이 그대로 고정되어 셀의 간격이 비정상적으로 벌어지던 현상을 해결하기 위해
              여기에 'calendar-grid-container' 클래스명을 새롭게 부여했습니다.
              이를 통해 globals.css의 모바일 미디어 쿼리에서 세로 행 높이를 75px로, 간격을 4px로 조화롭게 덮어쓸 수 있도록 지원합니다. */}
          <div className="calendar-grid-container" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gridAutoRows: '140px', // [교육용 주석] 일정 5줄이 더 여유롭고 쾌적하게 표시되도록 세로 공간을 140px로 미세 조정했습니다.
            gap: '8px'
          }}>
            {renderCalendarDays()}
          </div>
        </section>

        {/* 오른쪽: 선택된 날짜의 일정 상세 정보 */}
        {/* [교육용 주석] 
            showMobileDetail 상태에 따라 모바일 팝업 활성화 클래스인 'show-mobile-popup'을 동적으로 토글시킵니다.
            데스크톱에서는 이 클래스가 들어가더라도 globals.css의 데스크톱 스타일 규칙에 영향을 미치지 않으므로 평온하게 기존 2열 레이아웃이 유지됩니다. */}
        <section id="selected-date-detail" className={`glass-panel ${showMobileDetail ? 'show-mobile-popup' : ''}`} style={{
          display: 'flex', flexDirection: 'column', padding: '24px', justifyContent: 'flex-start'
        }}>
          <h3 style={{
            fontSize: '1.2rem', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.1)',
            paddingBottom: '12px', marginBottom: '16px', display: 'flex', justifyContent: 'space-between',
            alignItems: 'baseline'
          }}>
            <span>📅 {selectedY}년 {selectedM}월 {selectedD}일</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                일정 {selectedDateEvents.length}개
              </span>
              {/* [교육용 주석]
                  모바일 팝업 모달이 활성화되었을 때만 노출되는 X 모양의 직관적인 닫기 버튼을 주입합니다.
                  이 버튼은 데스크톱 등 넓은 화면에서는 CSS 클래스(mobile-only)에 의해 보이지 않도록 숨김 처리됩니다. */}
              <button
                className="mobile-only"
                onClick={() => setShowMobileDetail(false)}
                style={{
                  background: 'rgba(255, 255, 255, 0.08)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  color: 'var(--text-secondary)',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  padding: 0,
                  transition: 'background 0.2s'
                }}
              >
                ✕
              </button>
            </div>
          </h3>

          <div style={{
            display: 'flex', flexDirection: 'column', gap: '12px',
            overflowY: 'auto', maxHeight: '700px', flexGrow: 1, paddingRight: '4px'
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
                const DetailIcon = badge.icon;
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
                            {/* [교육용 주석] 렌더링 시 제목에 포함되어 있을 수 있는 컬러 이모지를 제거하고, 티커로 시작한다면 종목 한글명으로 치환하여 표시합니다. */}
                            {getDisplayTitle(event)}
                          </span>
                        </div>
                        {event.stockCode && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {/* [교육용 주석] 
                                종목 이름(stockName)이 존재하고 티커 코드(stockCode)와 다를 때만 '이름 (티커)'로 표시하고,
                                이름이 누락되었거나 티커와 동일한 경우에는 티커 하나만 깔끔하게 표시하여 중복 표기를 방지합니다. */}
                            🔗 연동 종목: {event.stockName && event.stockName !== event.stockCode
                              ? `${event.stockName} (${event.stockCode})`
                              : event.stockCode}
                          </span>
                        )}
                      </div>

                      {/* [교육용 주석]
                          로봇 아이콘을 일정 분류 아이콘 왼쪽에 정렬하여 배치하고,
                          일정 분류 뱃지는 라벨을 없애고 콤팩트한 아이콘으로만 표기하며
                          마우스 오버 시 툴팁(title)으로 상세 내용을 보여주어 고급스러운 UX를 연출합니다. */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {event.isAI && (
                          <span
                            title="자동 수집"
                            style={{
                              fontSize: '0.65rem',
                              background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.25), rgba(59, 130, 246, 0.25))',
                              border: '1px solid rgba(167, 139, 250, 0.4)',
                              color: '#c084fc',
                              padding: '5px',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer'
                            }}
                          >
                            <Bot size={13} strokeWidth={2.5} />
                          </span>
                        )}

                        <span
                          title={badge.text}
                          style={{
                            fontSize: '0.65rem',
                            background: badge.bg,
                            color: badge.color,
                            border: `1.5px solid ${badge.borderColor}`,
                            padding: '5px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer'
                          }}
                        >
                          <DetailIcon size={13} strokeWidth={2.5} />
                        </span>
                      </div>
                    </div>

                    {(() => {
                      // [교육용 주석] 단순 영문 기본 명칭 데이터(Dividend Date, Ex-Dividend Date 등)는 상세 설명에 노출하지 않도록 차단 처리합니다.
                      const desc = event.description?.trim();
                      if (!desc) return null;

                      const ignoreDescriptions = [
                        'earnings date',
                        'dividend date',
                        'ex-dividend date',
                        'dividend payment',
                        'stock split'
                      ];
                      if (event.isAI && ignoreDescriptions.includes(desc.toLowerCase())) {
                        return null;
                      }

                      return (
                        <p style={{
                          fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0,
                          textAlign: 'left', background: 'rgba(0,0,0,0.15)', padding: '8px 10px',
                          borderRadius: '6px', whiteSpace: 'pre-wrap'
                        }}>
                          {desc}
                        </p>
                      );
                    })()}

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                      <button
                        className="glass-button"
                        onClick={() => { setEditingEvent(event); setShowAddModal(true); }}
                        style={{
                          width: 'auto', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px',
                          background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Pencil size={12} />
                        수정
                      </button>
                      <button
                        className="glass-button"
                        onClick={() => setDeletingEvent(event)}
                        style={{
                          width: 'auto', padding: '4px 10px', fontSize: '0.75rem', borderRadius: '6px',
                          background: 'rgba(239,68,68,0.15)', color: '#ff5555', border: '1px solid rgba(239,68,68,0.2)',
                          display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        <Trash2 size={12} />
                        삭제
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {/* [교육용 주석] 
              하단 버튼의 문구를 "➕ 현재 날짜에 일정 추가"에서 "➕ 일정 추가"로 심플하게 변경했습니다.
              이 버튼을 클릭하면, 달력에서 현재 선택되어 있는 날짜(selectedDate)를 기준으로 
              새 일정을 등록할 수 있도록 모달을 호출합니다. */}
          <button
            className="glass-button"
            onClick={() => {
              setEditingEvent(null);
              // 모달 열 때 현재 달력에서 클릭한 날짜가 기본 세팅되도록 설정
              setShowAddModal(true);
            }}
            style={{ marginTop: '16px', background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' }}
          >
            + 일정 추가
          </button>
        </section>
      </div>



      {/* [교육용 주석] 
          모바일 화면에서 날짜를 클릭해 상세 팝업이 활성화되었을 때, 
          달력과 뒷배경 요소를 어둡게 딤(Dim) 아웃 처리하여 모달에 시선을 집중시켜주는 반응형 투명 오버레이입니다. 
          데스크톱 환경에서는 CSS에 의해 자동으로 나타나지 않습니다. */}
      {showMobileDetail && (
        <div 
          className="mobile-only modal-overlay" 
          onClick={() => setShowMobileDetail(false)} 
          style={{ zIndex: 1000, opacity: 1, display: 'flex' }} 
        />
      )}

      {/* 일정 등록 및 편집 모달 */}
      {/* [교육용 주석] 
          defaultDate Prop에 현재 선택된 날짜인 selectedDate를 전달합니다.
          이를 통해 모달이 열릴 때 사용자가 선택한 날짜가 날짜 필드에 미리 입력되어
          엉뚱한 날짜에 일정이 등록되는 버그를 원천 해결합니다. */}
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
        onDelete={() => {
          if (editingEvent) {
            setDeletingEvent(editingEvent);
            setShowAddModal(false);
          }
        }}
        initialEvent={editingEvent}
        defaultDate={selectedDate}
      />

      {/* 커스텀 삭제 확인 모달 (글래스모피즘 프리미엄 디자인 적용) */}
      {deletingEvent && (
        <div className="modal-overlay" style={{ display: 'flex', opacity: 1 }}>
          <div className="modal-content" style={{ transform: 'scale(1)', maxWidth: '440px' }}>
            <button className="modal-close" onClick={() => setDeletingEvent(null)} aria-label="닫기">
              ✕
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', textAlign: 'center' }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(239, 68, 68, 0.12)',
                border: '1.5px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ff5555'
              }}>
                <Trash2 size={24} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>
                  일정을 삭제하시겠습니까?
                </h3>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, padding: '0 8px', lineHeight: '1.5' }}>
                  <strong>"{getDisplayTitle(deletingEvent)}"</strong> 일정을 정말로 삭제하시겠습니까?
                  {deletingEvent.stockCode && (
                    <span style={{ display: 'block', marginTop: '8px', color: '#fbbf24', fontSize: '0.85rem' }}>
                      ⚠️ 이 일정은 <strong>{deletingEvent.stockName || deletingEvent.stockCode}</strong> 종목과 연동되어 있습니다.
                    </span>
                  )}
                </p>
              </div>

              {/* [교육용 주석] 
                  사용자의 요청에 따라 '취소' 버튼을 삭제하고, 버튼들을 좌우 가로로 배열(`flexDirection: 'row'`)했습니다.
                  연동된 종목 코드가 있을 때는 [좌: 전 종목 삭제, 우: 삭제] 형태로 보여주며,
                  연동된 종목 코드가 없을 때는 [삭제] 버튼 하나만 영역을 가득 채우도록 조건부 분기 처리했습니다. */}
              <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', width: '100%', marginTop: '12px' }}>
                {deletingEvent.stockCode ? (
                  <>
                    {/* 좌측 버튼: 전 종목 삭제 (오렌지-레드 그라데이션) */}
                    <button
                      className="glass-button"
                      onClick={() => {
                        if (deletingEvent.stockCode) {
                          deleteSchedulesByStock(deletingEvent.stockCode);
                        }
                        setDeletingEvent(null);
                      }}
                      style={{
                        background: 'linear-gradient(135deg, #f97316, #ef4444)',
                        color: 'white',
                        border: 'none',
                        flex: 1,
                        padding: '12px',
                        fontSize: '0.9rem'
                      }}
                    >
                      전 종목 삭제
                    </button>
                    {/* 우측 버튼: 이 일정만 삭제 */}
                    <button
                      className="glass-button"
                      onClick={() => {
                        deleteSchedule(deletingEvent.id);
                        setDeletingEvent(null);
                      }}
                      style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ff5555',
                        border: '1px solid rgba(239, 68, 68, 0.25)',
                        flex: 1,
                        padding: '12px',
                        fontSize: '0.9rem'
                      }}
                    >
                      삭제
                    </button>
                  </>
                ) : (
                  // 연동 종목이 없는 경우 단일 [삭제] 버튼 단독 표시 (가로 공간 채움)
                  <button
                    className="glass-button"
                    onClick={() => {
                      deleteSchedule(deletingEvent.id);
                      setDeletingEvent(null);
                    }}
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      color: '#ff5555',
                      border: '1px solid rgba(239, 68, 68, 0.25)',
                      flex: 1,
                      padding: '12px',
                      fontSize: '0.9rem'
                    }}
                  >
                    삭제
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
