import yfinance as yf
import json
import sys
from datetime import datetime

def get_exchange_rate():
    try:
        # 야후 파이낸스에서 원/달러 환율 티커 조회 (USDKRW=X)
        ticker = yf.Ticker("USDKRW=X")
        
        # 최근 1개월치 데이터 가져오기 (차트 구성을 위해)
        df = ticker.history(period="1mo")
        
        if df.empty:
            raise ValueError("환율 데이터를 찾을 수 없습니다 (USDKRW=X)")
            
        # 최신 종가(Close)를 현재 환율로 사용
        current_rate = float(df.iloc[-1]['Close'])
        
        # 과거 기록 리스트 생성
        history = []
        for index, row in df.iterrows():
            # index는 Timestamp 객체이므로 문자열로 변환
            dt = index.to_pydatetime()
            history.append({
                "date": dt.strftime("%-m월 %-d일"), # "5월 12일" 형식
                "rate": round(float(row['Close']), 2)
            })
        
        result = {
            "rate": current_rate,
            "currency": "KRW",
            "history": history
        }
        print(json.dumps(result))
        
    except Exception as e:
        error_result = {"error": str(e)}
        print(json.dumps(error_result))
        sys.exit(1)

if __name__ == "__main__":
    get_exchange_rate()
