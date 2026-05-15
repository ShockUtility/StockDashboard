import sys
import json
import FinanceDataReader as fdr

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
