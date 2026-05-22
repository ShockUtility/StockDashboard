import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';

// GET 요청을 처리하는 핸들러입니다.
export async function GET(request: Request) {
  // URL에서 쿼리 파라미터를 추출합니다.
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  // 종목 코드가 없으면 에러를 반환합니다.
  if (!code) {
    return NextResponse.json({ error: '종목 코드가 필요합니다.' }, { status: 400 });
  }

  console.log(`[주식 분석] 시작 (종목: ${code})`);

  // 파이썬 스크립트를 실행하고 결과를 받아오기 위해 Promise를 사용합니다.
  return new Promise<NextResponse>((resolve) => {
    // 운영 환경과 개발 환경에 따라 파이썬 실행 파일 경로를 설정합니다.
    const pythonExecutable = process.env.NODE_ENV === 'production' 
      ? '/usr/bin/python' 
      : 'python3';
      
    // 실행할 파이썬 스크립트의 절대 경로를 설정합니다.
    const scriptPath = path.join(process.cwd(), 'python', 'get_stock_analysis.py');

    // 파이썬 프로세스를 생성합니다. (스크립트 경로와 종목 코드를 인자로 전달)
    const pyProcess = spawn(pythonExecutable, [scriptPath, code]);

    let dataString = '';
    let errorString = '';

    // 표준 출력(stdout)에서 데이터를 받아옵니다.
    pyProcess.stdout.on('data', (data) => {
      dataString += data.toString();
    });

    // 표준 에러(stderr)에서 에러 메시지를 받아옵니다.
    pyProcess.stderr.on('data', (data) => {
      errorString += data.toString();
    });

    // 프로세스가 종료되면 실행되는 이벤트 리스너입니다.
    pyProcess.on('close', (codeStatus) => {
      // 종료 코드가 0이 아니면 에러가 발생한 것입니다.
      if (codeStatus !== 0) {
        console.error(`[주식 분석] 실패 (종료 코드: ${codeStatus})`);
        console.error('Python Error:', errorString);
        return resolve(NextResponse.json({ error: '데이터를 가져오는 중 오류가 발생했습니다.' }, { status: 500 }));
      }

      try {
        // 파이썬 스크립트가 출력한 JSON 문자열을 파싱합니다.
        const result = JSON.parse(dataString.trim());
        
        // 결과 내에 에러 메시지가 있다면 400 에러를 반환합니다.
        if (result.error) {
          console.error(`[주식 분석] 내부 에러 응답: ${result.error}`);
          return resolve(NextResponse.json({ error: result.error }, { status: 400 }));
        }
        
        console.log(`[주식 분석] 완료 (종목: ${code})`);
        // 성공적인 결과를 반환합니다.
        return resolve(NextResponse.json(result));
      } catch (e: any) {
        console.error(`[주식 분석] 파싱 에러: ${e.message}`);
        console.error('Error parsing python output:', dataString);
        return resolve(NextResponse.json({ error: '데이터 파싱 오류가 발생했습니다.' }, { status: 500 }));
      }
    });
  });
}
