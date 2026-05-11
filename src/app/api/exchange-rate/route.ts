import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function GET() {
  return new Promise((resolve) => {
    const pythonExecutable = path.join(process.cwd(), '.venv', 'bin', 'python3');
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
        console.error(`Python script exited with code ${codeStatus}`);
        console.error(errorString);
        return resolve(NextResponse.json({ error: '환율 데이터를 가져오는 중 오류가 발생했습니다.' }, { status: 500 }));
      }

      try {
        const result = JSON.parse(dataString.trim());
        if (result.error) {
          return resolve(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        return resolve(NextResponse.json(result));
      } catch (e) {
        console.error('Error parsing python output:', dataString);
        return resolve(NextResponse.json({ error: '환율 데이터 파싱 오류' }, { status: 500 }));
      }
    });
  });
}
