import sys
import json
import FinanceDataReader as fdr
import yfinance as yf

def get_korean_stock_name(code):
    try:
        # 먼저 KOSPI로 시도
        info = yf.Ticker(f"{code}.KS").info
        if 'shortName' in info and info['shortName']:
            return info['shortName']
    except:
        pass
    
    try:
        # KOSDAQ으로 시도
        info = yf.Ticker(f"{code}.KQ").info
        if 'shortName' in info and info['shortName']:
            return info['shortName']
    except:
        pass
    
    return ""

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
        name = code
        is_korean = (country == "KR") or (country == "AUTO" and code.isdigit())
        
        if is_korean:
            fetched_name = get_korean_stock_name(code)
            name = fetched_name if fetched_name else code
            currency = "KRW"
        else:
            # 미국 주식 등으로 간주
            try:
                info = yf.Ticker(code).info
                name = info.get('shortName', code)
            except:
                name = code
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
