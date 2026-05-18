import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 메모리에 캐시를 담아두어 빠른 검색을 지원하는 변수들입니다.
let cachedStocks: { code: string, name: string, market: string }[] | null = null;
let lastCacheDate = '';
let lastFileModTime = 0;

/**
 * 주식 종목 캐시 파일을 로드하는 함수입니다.
 * 교육용 설명: 이 함수는 서버가 시작되거나 파일이 변경되었을 때 JSON 파일을 읽어 메모리에 저장합니다.
 */
function loadCache() {
  try {
    const cachePath = path.join(process.cwd(), 'python', 'stock_names_cache.json');
    
    // 파일이 존재하지 않으면 로드를 하지 않고 false를 반환합니다.
    if (!fs.existsSync(cachePath)) return false;
    
    const stats = fs.statSync(cachePath);
    
    // [성능 최적화] 이미 로드했고 파일이 변경되지 않았다면 기존 캐시를 그대로 재사용합니다.
    if (cachedStocks && stats.mtimeMs === lastFileModTime) {
        return true;
    }
    
    // 파일을 텍스트 형식으로 읽어옵니다.
    const fileContent = fs.readFileSync(cachePath, 'utf-8');
    
    // [보안/방어 코드 추가] 파일 내용이 비어있는지 확인합니다.
    // 운영 서버에서 파일이 생성 중이거나 깨져서 비어있을 때 발생하는 오류를 방지합니다.
    if (!fileContent || fileContent.trim() === '') {
      console.warn('⚠️ 주식 캐시 파일이 비어있습니다. (stock_names_cache.json)');
      return false;
    }
    
    let data;
    try {
      // [보안/방어 코드 추가] JSON 문자열을 객체로 변환합니다.
      // 파일 내용이 불완전하여 JSON 형식이 깨졌을 때 서버가 멈추는 것을 방지합니다.
      data = JSON.parse(fileContent);
    } catch (parseError) {
      console.error('❌ 주식 캐시 파일의 JSON 형식이 올바르지 않습니다 (Unexpected end of JSON input 등):', parseError);
      return false; // 파싱 실패 시 안전하게 실패 처리
    }
    
    lastFileModTime = stats.mtimeMs;
    lastCacheDate = data.date;
    cachedStocks = [];
    
    // 객체 형태의 데이터를 배열 형태로 가공하여 검색이 쉽도록 만듭니다.
    for (const [code, info] of Object.entries(data.stocks)) {
      if (typeof info === 'object' && info !== null) {
        cachedStocks.push({
          code,
          name: (info as any).name || '',
          market: (info as any).market || ''
        });
      }
    }
    return true;
  } catch (error) {
    // 파일 읽기 등 기타 시스템 오류가 발생했을 때 처리입니다.
    console.error('Failed to load stock cache', error);
    return false;
  }
}

/**
 * API 요청을 처리하는 핸들러입니다.
 * 예: /api/search-stock?q=삼성&country=KR
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.toLowerCase() || '';
  const country = searchParams.get('country') || 'KR'; // 'KR' 또는 'US'
  
  // 검색어가 없으면 빈 배열을 반환합니다.
  if (!q) {
    return NextResponse.json([]);
  }

  // 요청이 올 때마다 파일 변경 여부를 감지하여 필요 시 캐시를 새로 로드합니다.
  loadCache(); 

  // 캐시 로드에 실패했거나 데이터가 없는 경우의 예외 처리입니다.
  if (!cachedStocks) {
    return NextResponse.json({ error: '캐시 데이터가 없습니다.' }, { status: 500 });
  }

  const results = [];
  let count = 0;

  // 메모리에 로드된 캐시를 순회하며 검색어와 일치하는 종목을 찾습니다.
  for (let i = 0; i < cachedStocks.length; i++) {
    const item = cachedStocks[i];
    
    // 1. 국가별 필터링 (한국 주식 또는 미국 주식)
    if (country === 'KR' && item.market !== 'KRX') continue;
    if (country === 'US' && item.market === 'KRX') continue;

    // 2. 검색어 매칭 (종목명 또는 종목코드에 검색어가 포함되어 있는지 확인)
    if (item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)) {
      results.push(item);
      count++;
      
      // 성능과 UI 가독성을 위해 최대 10개만 찾으면 검색을 중단합니다.
      if (count >= 10) break; 
    }
  }

  // 검색 결과를 JSON 형태로 반환합니다.
  return NextResponse.json(results);
}
