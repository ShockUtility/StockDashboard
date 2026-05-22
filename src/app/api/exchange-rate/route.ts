import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function GET() {
  console.log('[환율 조회] 시작');

  return new Promise<NextResponse>((resolve) => {
    const pythonExecutable = process.env.NODE_ENV === 'production' 
      ? '/usr/bin/python' 
      : 'python3';
    const scriptPath = path.join(process.cwd(), 'python', 'get_exchange_rate.py');

    const pyProcess = spawn(pythonExecutable, [scriptPath]);

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
        console.error(`[환율 조회] 실패 (종료 코드: ${codeStatus})`);
        console.error(errorString);
        return resolve(NextResponse.json({ error: '환율 데이터를 가져오는 중 오류가 발생했습니다.' }, { status: 500 }));
      }

      try {
        const result = JSON.parse(dataString.trim());
        if (result.error) {
          console.error(`[환율 조회] 내부 에러 응답: ${result.error}`);
          return resolve(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        console.log('[환율 조회] 완료 (성공)');
        return resolve(NextResponse.json(result));
      } catch (e: any) {
        console.error(`[환율 조회] 파싱 에러: ${e.message}`);
        console.error('Error parsing python output:', dataString);
        return resolve(NextResponse.json({ error: '환율 데이터 파싱 오류' }, { status: 500 }));
      }
    });
  });
}
