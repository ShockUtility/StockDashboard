import sys
import json
import FinanceDataReader as fdr
from datetime import datetime, timedelta

def get_stock_name(code, country):
    try:
        if country == "KR" or (country == "AUTO" and code.isdigit()):
            df = fdr.StockListing('KRX')
            if 'Code' in df.columns:
                name = df[df['Code'] == code]['Name'].values
                if len(name) > 0:
                    return name[0]
        else:
            # 미국 주식 검색
            for mkt in ['NASDAQ', 'NYSE', 'AMEX']:
                df = fdr.StockListing(mkt)
                if 'Symbol' in df.columns:
                    name = df[df['Symbol'] == code]['Name'].values
                    if len(name) > 0:
                        return name[0]
    except Exception as e:
        pass
    return code

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "종목 코드를 입력해주세요."}))
        sys.exit(1)

    code = sys.argv[1].upper()
    country = sys.argv[2].upper() if len(sys.argv) > 2 else "AUTO"
    with_name = True if len(sys.argv) > 3 and sys.argv[3] == "--with-name" else False

    try:
        # [최적화] 전체 데이터를 가져오는 대신, 최근 10일치 데이터만 가져와서 속도를 대폭 향상시킵니다.
        # 시세 새로고침에는 오늘과 어제의 종가만 필요하기 때문입니다.
        end_date = datetime.now()
        start_date = end_date - timedelta(days=10)
        
        df = fdr.DataReader(code, start=start_date.strftime('%Y-%m-%d'))
        
        if df.empty:
            print(json.dumps({"error": f"[{code}] 데이터를 찾을 수 없습니다. 종목 코드를 확인해주세요."}))
            sys.exit(1)
            
        current_price = float(df.iloc[-1]['Close'])
        
        # 전일 대비 변동률 계산
        change_percent = 0.0
        if len(df) > 1:
            prev_price = float(df.iloc[-2]['Close'])
            if prev_price > 0:
                change_percent = (current_price / prev_price - 1.0) * 100.0
        
        # 통화 설정 (한국 종목은 KRW, 그 외는 USD로 가정)
        if country == "KR" or (country == "AUTO" and code.isdigit()):
            currency = "KRW"
        else:
            currency = "USD"
            
        result = {
            "code": code,
            "currentPrice": current_price,
            "changePercent": change_percent,
            "currency": currency
        }
        
        # --with-name 파라미터가 있을 때만 종목명 검색 (속도 저하 방지)
        if with_name:
            result["name"] = get_stock_name(code, country)
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
