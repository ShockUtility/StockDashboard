import sys
import json
import FinanceDataReader as fdr
def get_stock_name(code, country="KR"):
    try:
        if country == "KR":
            # KRX 상장 종목 전체 리스트 가져오기 (KOSPI, KOSDAQ, KONEX 포함)
            df_krx = fdr.StockListing('KRX')
            stock = df_krx[df_krx['Code'] == code]
            if not stock.empty:
                return stock.iloc[0]['Name']
        else:
            # 미국 주식 종목명 가져오기 (NASDAQ, NYSE, AMEX 통합 리스트 활용 가능)
            # 미국 주식은 워낙 방대하므로 우선 S&P500이나 주요 거래소 리스트에서 찾기를 시도합니다.
            for market in ['NASDAQ', 'NYSE']:
                df_us = fdr.StockListing(market)
                stock = df_us[df_us['Symbol'] == code]
                if not stock.empty:
                    return stock.iloc[0]['Name']
    except:
        pass
    return code

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "종목 코드를 입력해주세요."}))
        sys.exit(1)

    code = sys.argv[1].upper()
    country = sys.argv[2].upper() if len(sys.argv) > 2 else "AUTO"

    try:
        # FinanceDataReader를 이용해 최근 주가 가져오기
        df = fdr.DataReader(code)
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
        
        # 종목명 가져오기
        # 종목명 및 통화 설정
        if country == "KR" or (country == "AUTO" and code.isdigit()):
            name = get_stock_name(code, "KR")
            currency = "KRW"
        else:
            name = get_stock_name(code, "US")
            currency = "USD"
            
        result = {
            "code": code,
            "name": name,
            "currentPrice": current_price,
            "changePercent": change_percent,
            "currency": currency
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
