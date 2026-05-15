import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

export async function POST(request: Request) {
  try {
    // 클라이언트로부터 여러 종목의 정보를 담은 배열을 받습니다.
    const body = await request.json();
    const items = body.items;

    if (!items || !Array.isArray(items)) {
      return NextResponse.json({ error: '올바른 형식의 종목 배열이 필요합니다.' }, { status: 400 });
    }

    return new Promise<NextResponse>((resolve) => {
      const pythonExecutable = process.env.NODE_ENV === 'production' 
        ? '/usr/bin/python' 
        : 'python3';
      const scriptPath = path.join(process.cwd(), 'python', 'get_stocks.py');

      // 리스트 데이터를 JSON 문자열로 변환하여 파이썬 스크립트의 인자로 전달합니다.
      const pyProcess = spawn(pythonExecutable, [scriptPath, JSON.stringify(items)]);

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
          return resolve(NextResponse.json({ error: '주가 데이터를 가져오는 중 오류가 발생했습니다.' }, { status: 500 }));
        }

        try {
          // 파이썬에서 반환한 결과(배열 형식 JSON)를 파싱합니다.
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
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: '요청을 처리하는 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
