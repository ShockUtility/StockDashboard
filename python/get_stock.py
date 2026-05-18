import sys
import json
import FinanceDataReader as fdr
from datetime import datetime, timedelta
import os

# [교육용 설명]
# 주식 종목명을 캐시 파일에서 찾아 반환하는 함수입니다.
# 이전에는 여기서 직접 캐시를 갱신하느라 렉이 걸렸으나,
# 이제는 갱신 로직을 제거하고 오직 저장된 캐시를 빠르게 '읽기'만 합니다.
def get_stock_name(code):
    cache_file = os.path.join(os.path.dirname(__file__), 'stock_names_cache.json')
    
    # 캐시 파일이 존재하는 경우에만 읽기를 시도합니다.
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                stock_info = cache_data.get('stocks', {}).get(code)
                
                # 정보가 객체 형태인 경우 (정상)
                if isinstance(stock_info, dict):
                    return stock_info
                # 정보가 단순 문자열(이름만)인 경우의 예외 처리
                elif isinstance(stock_info, str):
                    return {"name": stock_info, "market": "UNKNOWN"}
        except Exception as e:
            # 파일 읽기나 JSON 파싱 중 에러가 발생해도 서버가 멈추지 않도록 합니다.
            print(f"캐시 읽기 실패: {e}", file=sys.stderr)
            pass
    
    # 캐시 파일이 없거나 검색 결과가 없는 경우 기본값을 반환합니다.
    return {"name": code, "market": "UNKNOWN"}

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "종목 코드를 입력해주세요."}))
        sys.exit(1)

    code = sys.argv[1].upper()
    country = sys.argv[2].upper() if len(sys.argv) > 2 else "AUTO"
    with_name = True if len(sys.argv) > 3 and sys.argv[3] == "--with-name" else False

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
        
        # 종목명과 마켓 정보 검색 (가벼워진 get_stock_name 함수 호출)
        stock_info = get_stock_name(code) if with_name else {}
        market = stock_info.get("market") if isinstance(stock_info, dict) else "UNKNOWN"
        
        # 통화 설정 (시장 정보 우선 적용)
        if market == "KRX":
            currency = "KRW"
        elif market in ["NASDAQ", "NYSE", "AMEX"]:
            currency = "USD"
        else:
            # 시장 정보를 모를 때는 기존 로직(파라미터 기반) 사용
            if country == "KR" or (country == "AUTO" and code.isdigit()):
                currency = "KRW"
            else:
                currency = "USD"
            
        result = {
            "code": code,
            "currentPrice": current_price,
            "changePercent": change_percent,
            "currency": currency
        }
        
        # --with-name 파라미터가 있을 때만 결과에 포함
        if with_name:
            result["name"] = stock_info.get("name") if isinstance(stock_info, dict) else code
            result["market"] = market
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
