import FinanceDataReader as fdr
import json
import sys
import pandas as pd
from datetime import datetime, timedelta

def get_exchange_rate():
    try:
        # 최근 50일간의 데이터를 조회하여 영업일 및 최신성 확보
        end_date = datetime.now()
        start_date = end_date - timedelta(days=50)
        
        # FinanceDataReader를 사용하여 조회 (USDKRW=X 티커가 실시간성이 높음)
        df = fdr.DataReader('USDKRW=X', start_date.strftime('%Y-%m-%d'))
        
        if df.empty:
            # USDKRW=X 실패 시 기본 USD/KRW 재시도
            df = fdr.DataReader('USD/KRW', start_date.strftime('%Y-%m-%d'))
            
        if df.empty:
            raise ValueError("환율 데이터를 수집할 수 없습니다.")

        # 데이터프레임의 모든 열 이름을 대문자로 통일하여 처리 (소스별 차이 방지)
        df.columns = [c.upper() for c in df.columns]
        
        # 종가 데이터 열 찾기 (CLOSE 또는 ADJ CLOSE)
        close_col = 'CLOSE'
        if 'ADJ CLOSE' in df.columns:
            # ADJ CLOSE가 있고 CLOSE가 없거나 NaN이면 ADJ CLOSE 사용
            if 'CLOSE' not in df.columns:
                close_col = 'ADJ CLOSE'
            else:
                df['CLOSE'] = df['CLOSE'].fillna(df['ADJ CLOSE'])
        
        # 종가 데이터가 없는 행 제거
        df = df.dropna(subset=[close_col])
        
        # 가장 최신 데이터 30개 추출
        df = df.tail(30)
        
        # 현재 환율 (마지막 행)
        current_rate = float(df.iloc[-1][close_col])
        
        # 과거 기록 리스트 생성
        history = []
        for index, row in df.iterrows():
            dt = index.to_pydatetime()
            history.append({
                "date": dt.strftime("%Y-%m-%d"), 
                "rate": round(float(row[close_col]), 2)
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
