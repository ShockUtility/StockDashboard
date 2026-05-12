import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const country = searchParams.get('country') || 'KR';

  if (!code) {
    return NextResponse.json({ error: '종목 코드가 필요합니다.' }, { status: 400 });
  }

  return new Promise((resolve) => {
    // 프로젝트 루트 기준 파이썬 경로 설정 (.venv 내부)
    const pythonExecutable = path.join(process.cwd(), '.venv', 'bin', 'python3');
    const scriptPath = path.join(process.cwd(), 'python', 'get_stock_history.py');

    // 파이썬 프로세스 실행
    const pyProcess = spawn(pythonExecutable, [scriptPath, code, country]);

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
        console.error(`Python script exited with code ${codeStatus}`);
        console.error(errorString);
        return resolve(NextResponse.json({ error: '주가 이력 데이터를 가져오는 중 오류가 발생했습니다.' }, { status: 500 }));
      }

      try {
        const result = JSON.parse(dataString.trim());
        if (result.error) {
          return resolve(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        return resolve(NextResponse.json(result));
      } catch (e) {
        console.error('Error parsing python output:', dataString);
        return resolve(NextResponse.json({ error: '데이터 파싱 오류' }, { status: 500 }));
      }
    });
  });
}
