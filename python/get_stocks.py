import sys
import json
import FinanceDataReader as fdr

# 글로벌 캐시: 종목명 검색을 위한 거래소 목록을 한 번만 로드하여 속도를 향상시킵니다.
_krx_listing = None
_us_listing_nasdaq = None
_us_listing_nyse = None

def get_stock_name_cached(code, country="KR"):
    global _krx_listing, _us_listing_nasdaq, _us_listing_nyse
    try:
        if country == "KR":
            if _krx_listing is None:
                _krx_listing = fdr.StockListing('KRX')
            stock = _krx_listing[_krx_listing['Code'] == code]
            if not stock.empty:
                return stock.iloc[0]['Name']
        else:
            # 미국 주식: 우선 NASDAQ에서 검색 후 없으면 NYSE에서 검색
            if _us_listing_nasdaq is None:
                _us_listing_nasdaq = fdr.StockListing('NASDAQ')
            stock = _us_listing_nasdaq[_us_listing_nasdaq['Symbol'] == code]
            if not stock.empty:
                return stock.iloc[0]['Name']
            
            if _us_listing_nyse is None:
                _us_listing_nyse = fdr.StockListing('NYSE')
            stock = _us_listing_nyse[_us_listing_nyse['Symbol'] == code]
            if not stock.empty:
                return stock.iloc[0]['Name']
    except Exception as e:
        pass
    return code

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "종목 데이터(JSON)를 입력해주세요."}))
        sys.exit(1)

    try:
        # 입력값은 JSON 배열 형태: [{"code": "005930", "country": "KR"}, ...]
        items = json.loads(sys.argv[1])
    except json.JSONDecodeError:
        print(json.dumps({"error": "유효하지 않은 JSON 형식입니다."}))
        sys.exit(1)

    results = []
    for item in items:
        code = item.get("code", "").upper()
        country = item.get("country", "AUTO").upper()
        
        if not code:
            continue
            
        try:
            # 개별 종목 주가 조회
            df = fdr.DataReader(code)
            if df.empty:
                results.append({"code": code, "error": f"[{code}] 데이터를 찾을 수 없습니다."})
                continue
                
            current_price = float(df.iloc[-1]['Close'])
            change_percent = 0.0
            
            # 전일 대비 변동률 계산
            if len(df) > 1:
                prev_price = float(df.iloc[-2]['Close'])
                if prev_price > 0:
                    change_percent = (current_price / prev_price - 1.0) * 100.0
                    
            # 종목명 및 통화 설정
            if country == "KR" or (country == "AUTO" and code.isdigit()):
                name = get_stock_name_cached(code, "KR")
                currency = "KRW"
            else:
                name = get_stock_name_cached(code, "US")
                currency = "USD"
                
            results.append({
                "code": code,
                "name": name,
                "currentPrice": current_price,
                "changePercent": change_percent,
                "currency": currency
            })
        except Exception as e:
            results.append({"code": code, "error": str(e)})

    # 결과를 배열 형태의 JSON으로 한 번에 출력
    print(json.dumps(results, ensure_ascii=False))

if __name__ == "__main__":
    main()
