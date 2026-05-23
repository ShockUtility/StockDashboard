import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

/**
 * [교육용 주석]
 * 기존에 Gemini AI API를 호출하던 느린 방식을 제거하고,
 * 파이썬의 yfinance 모듈을 활용하여 1초 미만의 고속으로
 * 실적 발표일, 배당금 정보 등을 수집해 반환하는 Next.js API 엔드포인트입니다.
 * 
 * HTTP Method: POST
 * Request Body: { codes: string[] } (보유하고 있는 주식 종목 코드 배열)
 */
export async function POST(request: Request) {
  try {
    // 1. 요청 Body에서 종목 코드 배열을 받아옵니다.
    const body = await request.json();
    const codes: string[] = body.codes || [];

    if (codes.length === 0) {
      return NextResponse.json({ events: [] }); // 종목 코드가 없으면 즉시 빈 배열 반환
    }

    // 2. 현재 연도를 기준으로 금융 일정을 조회합니다.
    const currentYear = new Date().getFullYear();

    // 3. 파이썬 스크립트 실행 경로 및 환경 설정
    // 환율 정보(get_exchange_rate.py) 호출 로직과 동일하게 프로세스를 스폰(spawn)하여 실행합니다.
    const pythonExecutable = process.env.NODE_ENV === 'production' 
      ? '/usr/bin/python' 
      : 'python3';
    const scriptPath = path.join(process.cwd(), 'python', 'get_schedule.py');

    // 파이썬 인자 구성: [스크립트경로, 연도, 종목코드1, 종목코드2, ...]
    const args = [scriptPath, String(currentYear), ...codes];

    console.log(`[금융 일정 업데이트] 시작 (대상 종목 수: ${codes.length})`);

    return new Promise<NextResponse>((resolve) => {
      const pyProcess = spawn(pythonExecutable, args);

      let dataString = '';
      let errorString = '';

      // 파이썬 표준 출력(stdout) 버퍼링
      pyProcess.stdout.on('data', (data) => {
        dataString += data.toString();
      });

      // 파이썬 표준 에러(stderr) 버퍼링
      pyProcess.stderr.on('data', (data) => {
        errorString += data.toString();
      });

      // 프로세스 종료 시 처리
      pyProcess.on('close', (codeStatus) => {
        if (codeStatus !== 0) {
          console.error(`[금융 일정 업데이트] 실패 (종료 코드: ${codeStatus})`);
          console.error('Error detail:', errorString);
          return resolve(
            NextResponse.json(
              { error: '금융 일정 데이터를 수집하는 도중 파이썬 프로세스 에러가 발생했습니다.' },
              { status: 500 }
            )
          );
        }

        try {
          // 파이썬 출력 JSON 파싱
          const result = JSON.parse(dataString.trim());
          if (result.error) {
            console.error(`[금융 일정 업데이트] 내부 에러 응답: ${result.error}`);
            return resolve(NextResponse.json({ error: result.error }, { status: 400 }));
          }

          const events: any[] = [];

          // [교육용 주석]
          // 파이썬에서 전달받은 로우(Raw) 이벤트를 프론트엔드 CalendarEvent 타입에 맞게 매핑합니다.
          // 또한 영어로 된 상세 내용을 한국어 친절한 제목으로 직관적으로 가공합니다.
          for (const schedule of (result.schedules || [])) {
            if (schedule.error) {
              console.error(`Error fetching schedule for ${schedule.ticker}: ${schedule.error}`);
              // 개별 종목 수집 오류 시 해당 종목만 건너뛰고 다음 종목을 계속 파싱합니다.
              continue;
            }

            const ticker = schedule.ticker;

            for (const rawEvt of (schedule.events || [])) {
              let title = '';
              let type: 'EARNINGS' | 'IPO' | 'DIVIDEND' | 'EX_DIVIDEND' | 'CONFERENCE' | 'OTHER' = 'OTHER';

              // 파이썬 이벤트 타입 분기에 따른 한글 제목 매핑 및 타입 분류
              if (rawEvt.type === 'EARNINGS') {
                type = 'EARNINGS';
                // 파이썬 구조체에서 status 대신 isConfirmed가 사용되므로, 확정되지 않은 경우(false)를 예상 일정으로 판별합니다.
                const isEstimated = rawEvt.isConfirmed === false;
                title = `${isEstimated ? '[예상] ' : ''}${ticker} 실적 발표일`;
              } else if (rawEvt.type === 'DIVIDEND') {
                type = 'DIVIDEND';
                title = `${ticker} 배당금 지급 예정일`;
              } else if (rawEvt.type === 'EX_DIVIDEND') {
                type = 'EX_DIVIDEND';
                // [교육용 주석] 파이썬에서 넘어온 배당금 정보(예: "배당금: $0.26")를 괄호로 포장해 캘린더 타이틀에 즉각 시각화합니다.
                const amountText = rawEvt.description ? ` (${rawEvt.description})` : '';
                title = `${ticker} 배당락일${amountText}`;
              } else if (rawEvt.type === 'SPLIT') {
                type = 'OTHER';
                // [교육용 주석] 파이썬에서 넘어온 주식 분할 비율(예: "분할비율: 2.0")을 괄호로 묶어 타이틀에 반영합니다.
                const ratioText = rawEvt.description ? ` (${rawEvt.description})` : '';
                title = `${ticker} 주식 분할${ratioText}`;
              } else {
                title = `${ticker} 금융 일정 (${rawEvt.description})`;
              }

              events.push({
                date: rawEvt.date,
                title: title,
                type: type,
                ticker: ticker,
                description: rawEvt.description || '',
                isAI: true // AI/자동으로 긁어온 데이터임을 표시
              });
            }
          }

          console.log('[금융 일정 업데이트] 완료 (성공)');
          return resolve(NextResponse.json({ events }));
        } catch (e: any) {
          console.error(`[금융 일정 업데이트] 파싱 에러: ${e.message}`);
          console.error('Error parsing python output:', dataString);
          return resolve(
            NextResponse.json(
              { error: `금융 일정 데이터 파싱 오류: ${e.message}` },
              { status: 500 }
            )
          );
        }
      });
    });

  } catch (error: any) {
    console.error('일정 업데이트 라우트 내부 에러:', error);
    return NextResponse.json(
      { error: error.message || '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
