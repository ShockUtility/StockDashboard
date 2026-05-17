'use client';

import { useState } from 'react';
import { Portfolio } from '../types/portfolio';
import { formatMoney } from '../utils/format';

interface NewsSectionProps {
  portfolios: Portfolio[];
  exchangeRate: number;
}

interface NewsItem {
  title: string;
  link: string;
  pubDate: Date;
  pubDateStr: string;
  source: string;
}

export const NewsSection = ({ portfolios, exchangeRate }: NewsSectionProps) => {
  const [selectedStock, setSelectedStock] = useState<string | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loadingNews, setLoadingNews] = useState(false);

  // 1. 모든 계좌의 주식(KR, US) 추출 및 병합
  const stockMap = new Map<string, { name: string, code: string, type: string, totalValueKRW: number }>();

  portfolios.forEach(p => {
    p.assets.forEach(a => {
      if (a.type === 'KR_STOCK' || a.type === 'US_STOCK') {
        const rate = a.currency === 'USD' ? exchangeRate : 1;
        const valueKRW = a.quantity * a.currentPrice * rate;
        
        if (stockMap.has(a.code)) {
          const existing = stockMap.get(a.code)!;
          existing.totalValueKRW += valueKRW;
        } else {
          stockMap.set(a.code, {
            name: a.name,
            code: a.code,
            type: a.type,
            totalValueKRW: valueKRW
          });
        }
      }
    });
  });

  // 2. 평가금 순으로 정렬
  const sortedStocks = Array.from(stockMap.values())
    .sort((a, b) => b.totalValueKRW - a.totalValueKRW);

  // 3. 서버를 경유하여 구글 RSS 뉴스 가져오기 함수
  const fetchNews = async (stockName: string) => {
    setSelectedStock(stockName);
    setLoadingNews(true);
    setNews([]);
    
    try {
      // 직접 구글로 요청하지 않고, 우리가 만든 API 라우트를 경유합니다.
      const url = `/api/news?q=${encodeURIComponent(stockName)}`;
      
      const res = await fetch(url);
      if (!res.ok) throw new Error('뉴스 피드를 가져오지 못했습니다.');
      
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");
      const items = xml.querySelectorAll("item");
      
      const newsList: NewsItem[] = Array.from(items).map(item => {
        const title = item.querySelector("title")?.textContent || '';
        const link = item.querySelector("link")?.textContent || '';
        const pubDateStr = item.querySelector("pubDate")?.textContent || '';
        const source = item.querySelector("source")?.textContent || '';
        
        return { 
          title, 
          link, 
          pubDate: new Date(pubDateStr), 
          pubDateStr, 
          source 
        };
      });
      
      // 날짜순 정렬 (최신순)
      newsList.sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime());
      
      setNews(newsList);
    } catch (err) {
      console.error('Fetch news error:', err);
      alert('뉴스를 가져오는 중 오류가 발생했습니다. 서버 상태를 확인해 주세요.');
    } finally {
      setLoadingNews(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '24px', marginTop: '32px', minHeight: '600px' }}>
      {/* 좌측: 종목 리스트 */}
      <div className="glass-panel" style={{ padding: '24px', height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>📈 보유 종목</h3>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px' }}>종목을 클릭하면 뉴스를 검색합니다.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', maxHeight: '700px' }}>
          {sortedStocks.map((stock) => (
            <div 
              key={stock.code} 
              className="hover-bright"
              onClick={() => fetchNews(stock.name)}
              style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center', 
                padding: '12px 16px', 
                background: selectedStock === stock.name ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.02)', 
                borderRadius: '12px', 
                border: selectedStock === stock.name ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid rgba(255,255,255,0.05)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>{stock.type === 'KR_STOCK' ? '🇰🇷' : '🇺🇸'}</span>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.95rem' }}>{stock.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{stock.code}</span>
                </div>
              </div>
            </div>
          ))}

          {sortedStocks.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
              보유한 주식 종목이 없습니다.
            </div>
          )}
        </div>
      </div>

      {/* 우측: 뉴스 영역 */}
      <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--text-primary)', margin: 0 }}>
            📰 {selectedStock ? `[${selectedStock}] 관련 뉴스` : '실시간 뉴스'}
          </h3>
          <p className="text-secondary" style={{ fontSize: '0.85rem', marginTop: '4px' }}>구글 RSS 검색 결과입니다.</p>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '700px', flex: 1 }}>
          {loadingNews ? (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: '30px', height: '30px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }}></div>
                뉴스를 불러오는 중...
              </div>
            </div>
          ) : news.length > 0 ? (
            news.map((item, idx) => (
              <a 
                key={idx} 
                href={item.link} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover-bright"
                style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '8px', 
                  padding: '16px', 
                  background: 'rgba(255,255,255,0.02)', 
                  borderRadius: '12px', 
                  border: '1px solid rgba(255,255,255,0.05)',
                  textDecoration: 'none',
                  transition: 'all 0.2s'
                }}
              >
                <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.4' }}>{item.title}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>{item.source}</span>
                  <span>{item.pubDate.toLocaleString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </a>
            ))
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '200px', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.01)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '12px' }}>📡</span>
                {selectedStock ? '검색된 뉴스가 없습니다.' : '좌측에서 종목을 선택하시면 뉴스가 표시됩니다.'}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};
