import sys
import json
import FinanceDataReader as fdr
from datetime import datetime, timedelta

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "종목 코드를 입력해주세요."}))
        sys.exit(1)

    code = sys.argv[1].upper()
    country = sys.argv[2].upper() if len(sys.argv) > 2 else "AUTO"

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
            
        # [최적화] 시세 갱신 속도를 위해 불필요한 종목명 조회 로직을 완전히 제거했습니다.
        result = {
            "code": code,
            "currentPrice": current_price,
            "changePercent": change_percent,
            "currency": currency
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
