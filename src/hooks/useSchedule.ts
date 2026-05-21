'use client';

import { useState, useEffect } from 'react';
import { CalendarEvent } from '../types/schedule';

/**
 * [교육용 주석]
 * 주요일정 데이터를 상태 관리(State)하고, 로컬 스토리지(LocalStorage)에 영속 저장하며,
 * 일정을 추가/수정/삭제/AI 데이터 병합을 처리하는 React 커스텀 훅입니다.
 */
export function useSchedule() {
  const [schedules, setSchedules] = useState<CalendarEvent[]>([]);
  const [isMounted, setIsMounted] = useState(false);

  // 1. 컴포넌트가 브라우저에 마운트(로딩)될 때 로컬 스토리지에서 기존 일정을 불러옵니다.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('schedules');
        if (stored) {
          setSchedules(JSON.parse(stored));
        }
      } catch (error) {
        console.error('로컬 스토리지에서 일정을 가져오는 중 오류 발생:', error);
      }
      setIsMounted(true);
    }
  }, []);

  // 2. 일정 데이터가 변경될 때마다 로컬 스토리지에 저장하여 데이터를 동기화합니다.
  useEffect(() => {
    if (isMounted) {
      try {
        localStorage.setItem('schedules', JSON.stringify(schedules));
      } catch (error) {
        console.error('로컬 스토리지에 일정을 저장하는 중 오류 발생:', error);
      }
    }
  }, [schedules, isMounted]);

  // 3. 신규 일정을 추가하는 함수입니다.
  const addSchedule = (newEvent: Omit<CalendarEvent, 'id'>) => {
    const item: CalendarEvent = {
      ...newEvent,
      isAI: false, // 사용자가 직접 등록한 수동 일정이므로 false를 명시합니다.
      id: 'schedule-' + Date.now() // 고유 ID 발급을 위해 타임스탬프를 조합합니다.
    };
    setSchedules((prev) => [...prev, item]);
  };

  // 4. 기존 일정을 편집(수정)하는 함수입니다.
  const editSchedule = (id: string, updatedEvent: Omit<CalendarEvent, 'id'>) => {
    setSchedules((prev) =>
      prev.map((event) =>
        event.id === id 
          ? { ...event, ...updatedEvent, isAI: false } // 사용자가 수정했으므로 수동 일정(isAI: false)으로 격상합니다.
          : event
      )
    );
  };

  // 5. 일정을 삭제하는 함수입니다.
  const deleteSchedule = (id: string) => {
    setSchedules((prev) => prev.filter((event) => event.id !== id));
  };

  // 6. Gemini AI로부터 받아온 일정 배열을 기존 일정과 병합하는 함수입니다.
  // [교육용 주석]
  // - 새로운 AI 일정이 들어오면, 업데이트 중인 각 종목코드(stockCode)의 수집 연도(Year)를 식별합니다.
  // - 해당 종목의 해당 연도에 대응하는 기존 AI 일정(isAI === true)만 선별적으로 제거합니다.
  // - 다른 종목의 일정이나 사용자가 등록한 수동 일정(isAI: false/undefined)은 절대 건드리지 않고 안전하게 보존합니다.
  const mergeAISchedules = (aiEvents: Omit<CalendarEvent, 'id'>[]) => {
    if (aiEvents.length === 0) return;

    // [교육용 주석]
    // 새로 들어온 AI 일정들로부터 '종목코드_연도' 형태의 고유한 결합 키를 만들어 Set에 저장합니다.
    // 예: 삼성전자("005930")의 2026년도 일정이 들어왔다면 "005930_2026" 키가 생성됩니다.
    const stockYearKeysToClear = new Set(
      aiEvents.map((e) => `${e.stockCode}_${e.date.split('-')[0]}`)
    );

    setSchedules((prev) => {
      // 1. 기존 일정 중 'isAI가 true'이고, 종목코드와 연도 조합 키가 삭제 대상 목록(stockYearKeysToClear)에 포함된 일정만 걸러서 삭제합니다.
      //    이로써 타겟 종목 외 다른 종목들의 동일 연도 일정은 그대로 남게 됩니다.
      const filteredPrev = prev.filter((event) => {
        const key = `${event.stockCode}_${event.date.split('-')[0]}`;
        return !(event.isAI && stockYearKeysToClear.has(key));
      });

      // 2. 새로운 AI 일정을 병합하되, 기존 수동 일정들과 완전히 겹치는 항목은 추가하지 않습니다.
      const uniqueNewEvents = aiEvents
        .filter((newEvent) => {
          const isDuplicate = filteredPrev.some(
            (oldEvent) =>
              oldEvent.date === newEvent.date &&
              oldEvent.title.trim() === newEvent.title.trim() &&
              oldEvent.stockCode === newEvent.stockCode
          );
          return !isDuplicate;
        })
        .map((newEvent) => ({
          ...newEvent,
          isAI: true, // AI가 가져온 것임을 표시합니다.
          id: 'ai-schedule-' + Math.random().toString(36).substr(2, 9) + '-' + Date.now() // AI 전용 ID 발급
        }));

      return [...filteredPrev, ...uniqueNewEvents];
    });
  };

  return {
    isMounted,
    schedules,
    setSchedules,
    addSchedule,
    editSchedule,
    deleteSchedule,
    mergeAISchedules
  };
}
