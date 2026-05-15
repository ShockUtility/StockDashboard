import sys
import json
import FinanceDataReader as fdr

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
                    
            # 통화 설정
            if country == "KR" or (country == "AUTO" and code.isdigit()):
                currency = "KRW"
            else:
                currency = "USD"
                
            # [최적화] 종목명 조회 로직을 제거하여 갱신 속도를 대폭 향상시켰습니다.
            results.append({
                "code": code,
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
