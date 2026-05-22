import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';

  console.log(`[지수 조회] 시작 (유형: ${type || '전체'})`);

  return new Promise<NextResponse>((resolve) => {
    const pythonExecutable = process.env.NODE_ENV === 'production' 
      ? '/usr/bin/python' 
      : 'python3';
    const scriptPath = path.join(process.cwd(), 'python', 'get_indicators.py');

    // 파이썬 프로세스 실행 시 인자값 전달
    const args = [scriptPath];
    if (type) args.push(type);

    const pyProcess = spawn(pythonExecutable, args);

    let dataString = '';
    let errorString = '';

    pyProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    pyProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    pyProcess.on('close', (codeStatus) => {
      if (codeStatus !== 0) {
        console.error(`[지수 조회] 실패 (종료 코드: ${codeStatus})`);
        console.error(errorString);
        return resolve(NextResponse.json({ error: '지수 데이터를 가져오는 중 오류가 발생했습니다.' }, { status: 500 }));
      }

      try {
        const result = JSON.parse(dataString.trim());
        console.log('[지수 조회] 완료 (성공)');
        return resolve(NextResponse.json(result));
      } catch (e: any) {
        console.error(`[지수 조회] 파싱 에러: ${e.message}`);
        console.error('Error parsing python output:', dataString);
        return resolve(NextResponse.json({ error: '데이터 파싱 오류' }, { status: 500 }));
      }
    });
  });
}
