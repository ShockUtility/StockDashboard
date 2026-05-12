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
    
    # 기본값: 최근 60일간의 데이터를 가져와서 실거래일 기준 약 30~40개 확보
    end_date = datetime.now()
    start_date = end_date - timedelta(days=60)

    try:
        # FinanceDataReader를 이용해 주가 이력 가져오기
        df = fdr.DataReader(code, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
        
        if df.empty:
            print(json.dumps({"error": f"[{code}] 데이터를 찾을 수 없습니다."}))
            sys.exit(1)
            
        # 필요한 데이터만 추출 (날짜와 종가)
        history = []
        for index, row in df.iterrows():
            history.append({
                "date": index.strftime('%Y-%m-%d'),
                "price": float(row['Close'])
            })
            
        result = {
            "code": code,
            "history": history
        }
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
