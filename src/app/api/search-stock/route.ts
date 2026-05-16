import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// 메모리에 캐시를 담아두어 빠른 검색 지원
let cachedStocks: { code: string, name: string, market: string }[] | null = null;
let lastCacheDate = '';
let lastFileModTime = 0;

function loadCache() {
  try {
    const cachePath = path.join(process.cwd(), 'python', 'stock_names_cache.json');
    if (!fs.existsSync(cachePath)) return false;
    
    const stats = fs.statSync(cachePath);
    // 이미 로드했고 파일이 변경되지 않았다면 재사용
    if (cachedStocks && stats.mtimeMs === lastFileModTime) {
        return true;
    }
    
    const fileContent = fs.readFileSync(cachePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    lastFileModTime = stats.mtimeMs;
    lastCacheDate = data.date;
    cachedStocks = [];
    
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
    console.error('Failed to load stock cache', error);
    return false;
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.toLowerCase() || '';
  const country = searchParams.get('country') || 'KR'; // 'KR' or 'US'
  
  if (!q) {
    return NextResponse.json([]);
  }

  loadCache(); // 파일 변경 감지 및 로드

  if (!cachedStocks) {
    return NextResponse.json({ error: '캐시 데이터가 없습니다.' }, { status: 500 });
  }

  const results = [];
  let count = 0;

  for (let i = 0; i < cachedStocks.length; i++) {
    const item = cachedStocks[i];
    
    // 국가별 필터링
    if (country === 'KR' && item.market !== 'KRX') continue;
    if (country === 'US' && item.market === 'KRX') continue;

    // 검색어 매칭 (이름 또는 코드에 포함)
    if (item.name.toLowerCase().includes(q) || item.code.toLowerCase().includes(q)) {
      results.push(item);
      count++;
      if (count >= 10) break; // 성능과 UI 가독성을 위해 최대 10개만 반환
    }
  }

  return NextResponse.json(results);
}
