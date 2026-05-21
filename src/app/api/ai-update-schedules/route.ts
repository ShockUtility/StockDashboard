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
          console.error(`Python script exited with code ${codeStatus}`);
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
              let type: 'EARNINGS' | 'IPO' | 'DIVIDEND' | 'CONFERENCE' | 'OTHER' = 'OTHER';

              // 파이썬 이벤트 타입 분기에 따른 한글 제목 매핑 및 타입 분류
              if (rawEvt.type === 'EARNINGS') {
                type = 'EARNINGS';
                const isEstimated = rawEvt.status === 'ESTIMATED';
                title = `${isEstimated ? '[예상] ' : ''}${ticker} 실적 발표일`;
              } else if (rawEvt.type === 'DIVIDEND_DATE') {
                type = 'DIVIDEND';
                title = `${ticker} 배당금 지급 예정일`;
              } else if (rawEvt.type === 'EX_DIVIDEND_DATE') {
                type = 'DIVIDEND';
                title = `${ticker} 배당락일`;
              } else if (rawEvt.type === 'DIVIDEND_PAYMENT') {
                type = 'DIVIDEND';
                // 배당 금액이 소수로 반환되는 경우 소수점 둘째자리까지 정돈
                const amountVal = parseFloat(rawEvt.amount);
                const amountText = !isNaN(amountVal) ? ` (주당 $${amountVal.toFixed(2)})` : '';
                title = `${ticker} 배당금 지급${amountText}`;
              } else if (rawEvt.type === 'STOCK_SPLIT') {
                type = 'OTHER';
                const ratioText = rawEvt.ratio ? ` (${rawEvt.ratio})` : '';
                title = `${ticker} 주식 분할${ratioText}`;
              } else {
                title = `${ticker} 금융 일정 (${rawEvt.description})`;
              }

              events.push({
                date: rawEvt.date,
                title: title,
                type: type,
                stockCode: ticker,
                description: rawEvt.description || '',
                isAI: true // AI/자동으로 긁어온 데이터임을 표시
              });
            }
          }

          return resolve(NextResponse.json({ events }));
        } catch (e: any) {
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
