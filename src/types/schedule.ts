/**
 * [교육용 주석]
 * 주요일정 기능을 구현하기 위한 데이터 타입(Type) 정의 파일입니다.
 * 달력에 표시될 일정의 종류와 필수/선택적 입력 데이터들의 구조를 정의합니다.
 */

// 일정의 카테고리를 나타내는 유니온 타입입니다.
// EARNINGS: 실적 발표, IPO: 신규 상장, DIVIDEND: 배당일, CONFERENCE: 학회 및 콘퍼런스, OTHER: 기타 일정
export type ScheduleType = 'EARNINGS' | 'IPO' | 'DIVIDEND' | 'EX_DIVIDEND' | 'CONFERENCE' | 'OTHER';

// 하나의 일정 객체가 가져야 할 데이터 구조(인터페이스)를 선언합니다.
export interface CalendarEvent {
  id: string;             // 일정의 고유 식별자 (예: 생성 시각 타임스탬프)
  date: string;           // 일정 날짜 (포맷: YYYY-MM-DD)
  title: string;          // 일정 명칭 (예: "삼성전자 Q1 실적 발표")
  type: ScheduleType;     // 일정 종류 (상기 선언한 5개 종류 중 하나)
  ticker?: string;        // 일정과 관련된 주식 종목 티커 코드 (선택사항, 예: "005930")
  stockName?: string;     // 일정과 관련된 주식 종목 한글명 (선택사항, 예: "삼성전자")
  description?: string;   // 일정에 대한 상세 내용이나 참고사항 (선택사항)
  isAI: boolean;          // AI에 의해 자동 추가된 일정인지 여부 (필수사항)
}
