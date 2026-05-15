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
    
    # 기본값: 최근 120일간의 데이터를 가져와서 이동평균선 계산을 위한 충분한 데이터 확보
    end_date = datetime.now()
    start_date = end_date - timedelta(days=120)

    try:
        # FinanceDataReader를 이용해 주가 이력 가져오기
        df = fdr.DataReader(code, start=start_date.strftime('%Y-%m-%d'), end=end_date.strftime('%Y-%m-%d'))
        
        if df.empty:
            print(json.dumps({"error": f"[{code}] 데이터를 찾을 수 없습니다."}))
            sys.exit(1)
            
        # [최적화] 데이터 안정성을 위해 결측치(NaN)가 있는 행은 제거합니다.
        df = df.dropna()
            
        # 필요한 데이터만 추출 (날짜와 시,고,저,종가)
        history = []
        for index, row in df.iterrows():
            # [최적화] 중복되는 'price' 필드를 제거하고 'close'로 통일했습니다.
            history.append({
                "date": index.strftime('%Y-%m-%d'),
                "open": float(row['Open']),
                "high": float(row['High']),
                "low": float(row['Low']),
                "close": float(row['Close'])
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
