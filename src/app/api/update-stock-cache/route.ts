import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * 주식 종목 캐시를 백그라운드에서 갱신하는 API입니다.
 * 교육용 설명: 이 API는 프론트엔드에서 페이지가 처음 로드될 때 호출됩니다.
 * 오늘 날짜의 캐시가 없다면 파이썬 스크립트를 백그라운드로 실행하여 캐시를 생성합니다.
 */
export async function GET() {
  try {
    const cachePath = path.join(process.cwd(), 'python', 'stock_names_cache.json');
    const today = new Date().toISOString().split('T')[0]; // 오늘 날짜 (YYYY-MM-DD)

    let needUpdate = true;

    // 1. 기존 캐시 파일이 존재하는지 확인합니다.
    if (fs.existsSync(cachePath)) {
      try {
        const fileContent = fs.readFileSync(cachePath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        // 캐시 파일의 날짜가 오늘 날짜와 같다면 갱신할 필요가 없습니다.
        if (data.date === today) {
          needUpdate = false;
        }
      } catch (parseError) {
        // JSON 파싱 에러가 난 경우(파일이 깨진 경우) 갱신이 필요합니다.
        console.error('캐시 파일 파싱 실패, 새로 갱신합니다.', parseError);
        needUpdate = true;
      }
    }

    // 2. 갱신이 필요한 경우에만 백그라운드 작업을 실행합니다.
    if (needUpdate) {
      const updateScript = path.join(process.cwd(), 'python', 'update_stock_names.py');
      
      // [교육용 주석 & 경로 버그 해결]
      // 다른 API 파일들과 동일하게 운영서버(production)인 경우 '/usr/bin/python' 절대경로를 쓰고,
      // 그 외 개발/테스트 환경에서는 'python3'를 사용하도록 삼항 연산자 분기를 적용했습니다.
      const pythonExecutable = process.env.NODE_ENV === 'production'
        ? '/usr/bin/python'
        : 'python3';

      // [디버깅 요청 반영]
      // 파이썬 실행 중 발생하는 모든 콘솔 출력(print)과 에러 추적 로그(Traceback)를
      // 파일로 안전하게 떨구어 추적할 수 있도록 파일 쓰기 스트림(WriteStream)을 생성합니다.
      const logFilePath = path.join(process.cwd(), 'python', 'update_stock.log');
      const logStream = fs.createWriteStream(logFilePath, { flags: 'a' });

      // [중요] Node.js에서 외부 프로세스(파이썬)를 백그라운드로 실행하는 방법입니다.
      // spawn을 사용하고 detached: true를 주면 부모 프로세스(웹 서버)와 독립적으로 실행됩니다.
      // stdio 옵션에 logStream을 연결하여 파이썬의 표준출력/에러출력을 파일로 우회 전송합니다.
      const child = spawn(pythonExecutable, [updateScript], {
        detached: true,
        stdio: ['ignore', logStream, logStream] 
      });

      // [디버깅 요청 반영]
      // 파이썬 프로세스 자체가 구동 실패(예: 경로 없음, 실행 권한 없음 등)했을 때의
      // 에러 이벤트를 정교하게 가로채서 파일과 서버 콘솔 양쪽에 기록을 남겨 원인을 규명합니다.
      child.on('error', (err) => {
        console.error('❌ [주식 캐시 갱신] 프로세스 기동 에러 발생:', err);
        logStream.write(`[${new Date().toLocaleString()}] ❌ 프로세스 기동 실패 에러: ${err.message}\n`);
      });

      // 부모 프로세스가 자식 프로세스의 종료를 기다리지 않도록 연결을 끊습니다.
      child.unref();

      // 시작 시점에 로그 파일에 랜드마크 로그를 기재합니다.
      logStream.write(`[${new Date().toLocaleString()}] 🚀 주식 종목 캐시 갱신 작업을 백그라운드에서 시작했습니다.\n`);
      logStream.write(`💻 [실행 커맨드]: ${pythonExecutable} ${updateScript}\n`);

      // 서버 터미널 콘솔에도 기동 성공 사실과 커맨드를 표출해 줍니다.
      console.log(`🚀 [주식 캐시 갱신] 작업을 백그라운드에서 기동했습니다.`);
      console.log(`💻 [실행 커맨드]: ${pythonExecutable} ${updateScript}`);
      
      return NextResponse.json({ 
        status: 'updating', 
        message: '캐시 갱신이 백그라운드에서 시작되었습니다.' 
      });
    }

    // 3. 이미 최신 캐시가 있다면 아무 작업도 하지 않고 응답합니다.
    return NextResponse.json({ 
      status: 'ok', 
      message: '캐시가 이미 최신 상태입니다.' 
     });

  } catch (error) {
    console.error('캐시 갱신 API 오류:', error);
    return NextResponse.json({ 
      status: 'error', 
      message: '서버 오류가 발생했습니다.' 
    }, { status: 500 });
  }
}
