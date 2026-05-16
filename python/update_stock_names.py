import json
import os
from datetime import datetime
import FinanceDataReader as fdr

def update_cache():
    cache_file = os.path.join(os.path.dirname(__file__), 'stock_names_cache.json')
    today = datetime.now().strftime('%Y-%m-%d')
    
    # 캐시 데이터 구조
    cache_data = {
        "date": today,
        "stocks": {}
    }
    
    print("종목 캐시 생성 시작...")
    
    # 1. 한국 주식 (KRX)
    try:
        krx_df = fdr.StockListing('KRX')
        if 'Code' in krx_df.columns and 'Name' in krx_df.columns:
            for _, row in krx_df.iterrows():
                cache_data['stocks'][str(row['Code'])] = {
                    "name": str(row['Name']),
                    "market": "KRX"
                }
    except Exception as e:
        print(f"KRX 로드 에러: {e}")

    # 2. 미국 주식
    for mkt in ['NASDAQ', 'NYSE', 'AMEX']:
        try:
            mkt_df = fdr.StockListing(mkt)
            if 'Symbol' in mkt_df.columns and 'Name' in mkt_df.columns:
                for _, row in mkt_df.iterrows():
                    cache_data['stocks'][str(row['Symbol'])] = {
                        "name": str(row['Name']),
                        "market": mkt
                    }
        except Exception as e:
            print(f"{mkt} 로드 에러: {e}")

    # 파일로 저장
    with open(cache_file, 'w', encoding='utf-8') as f:
        json.dump(cache_data, f, ensure_ascii=False, indent=2)
        
    print(f"캐시 갱신 완료: 총 {len(cache_data['stocks'])}개의 종목 이름이 저장되었습니다.")

if __name__ == "__main__":
    update_cache()
