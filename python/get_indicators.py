import sys
import json
import FinanceDataReader as fdr
from datetime import datetime, timedelta

def main():
    # 사용자가 요청한 전체 지수 및 자산 목록
    all_symbols = {
        # 주요 지수
        "KS11": "코스피",
        "KQ11": "코스닥",
        "US500": "S&P 500",
        "IXIC": "나스닥",
        "DJI": "다우존스",

        "CL=F": "WTI",
        "BZ=F": "브렌트유",
        "GC=F": "국제 금값",
        "SI=F": "국제 은값",
        "HG=F": "국제 구리값",        

        "BTC-USD": "비트코인",
        "ETH-USD": "이더리움",
        
        # 환율
        "USD/KRW": "원/달러 환율",
        "EUR/KRW": "유로 (EUR/KRW)",
        "JPY/KRW": "원/엔화 환율",
        "CNY/KRW": "위안화 (CNY/KRW)"
    }

    # 인자값에 따라 필터링
    symbols = {}
    if len(sys.argv) > 1:
        req_type = sys.argv[1]
        if req_type == "indices":
            # 환율(/KRW로 끝나지 않는 것)을 제외한 주요 지수
            symbols = {k: v for k, v in all_symbols.items() if not k.endswith('/KRW')}
        elif req_type == "rates":
            # 환율(/KRW로 끝나는 것)만 포함
            symbols = {k: v for k, v in all_symbols.items() if k.endswith('/KRW')}
        else:
            symbols = all_symbols
    else:
        symbols = all_symbols

    results = []
    
    end_date = datetime.now()
    # 최근 30일간의 데이터를 안정적으로 가져오기 위해 조회 기간을 45일로 늘립니다.
    # 주말과 공휴일을 제외하고 최소 30개의 데이터를 확보하기 위함입니다.
    start_date = end_date - timedelta(days=45)

    for symbol, name in symbols.items():
        try:
            df = fdr.DataReader(symbol, start=start_date.strftime('%Y-%m-%d'))
            if df.empty:
                results.append({
                    "symbol": symbol,
                    "name": name,
                    "error": "데이터를 찾을 수 없습니다."
                })
                continue
                
            # 최근 최대 30개의 데이터만 사용합니다.
            recent_df = df.tail(30)
            
            current_price = float(recent_df.iloc[-1]['Close'])
            
            # 전일 대비 변동률 및 변동액 계산
            change_percent = 0.0
            change_amount = 0.0
            if len(recent_df) > 1:
                prev_price = float(recent_df.iloc[-2]['Close'])
                if prev_price > 0:
                    change_amount = current_price - prev_price
                    change_percent = (current_price / prev_price - 1.0) * 100.0
            
            # 엔화 환율은 보통 100엔 기준으로 표기하므로 100을 곱해줍니다.
            if symbol == "JPY/KRW":
                current_price *= 100
                change_amount *= 100
                
            # 차트에 사용할 데이터 리스트 생성 (날짜와 값 포함)
            sparkline_data = []
            for index, row in recent_df.iterrows():
                # 인덱스가 datetime 객체인 경우 포맷팅합니다.
                date_str = index.strftime('%Y-%m-%d') if hasattr(index, 'strftime') else str(index)
                price = float(row['Close'])
                
                if symbol == "JPY/KRW":
                    price *= 100
                    
                sparkline_data.append({
                    "date": date_str,
                    "value": price
                })
                
            results.append({
                "symbol": symbol,
                "name": name,
                "currentPrice": current_price,
                "changeAmount": change_amount,
                "changePercent": change_percent,
                "sparklineData": sparkline_data # 날짜와 값이 포함된 배열
            })
        except Exception as e:
            results.append({
                "symbol": symbol,
                "name": name,
                "error": str(e)
            })

    print(json.dumps(results, ensure_ascii=False))

if __name__ == "__main__":
    main()
