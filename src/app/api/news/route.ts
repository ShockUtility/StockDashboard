import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');
  
  if (!q) {
    return NextResponse.json({ error: 'Query parameter q is required' }, { status: 400 });
  }
  
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=ko&gl=KR&ceid=KR:ko`;
    
    // 서버에서 구글 RSS 요청 (CORS 영향 없음)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch news from Google' }, { status: res.status });
    }
    
    const text = await res.text();
    
    // XML 데이터를 그대로 클라이언트에 반환
    return new Response(text, {
      headers: { 
        'Content-Type': 'text/xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' // 5분 캐시
      },
    });
  } catch (error) {
    console.error('API News error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
