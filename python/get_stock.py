import sys
import json
import FinanceDataReader as fdr
from datetime import datetime, timedelta

import os
import subprocess

def get_stock_name(code):
    cache_file = os.path.join(os.path.dirname(__file__), 'stock_names_cache.json')
    today = datetime.now().strftime('%Y-%m-%d')
    
    need_update = True
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
            if cache_data.get('date') == today:
                need_update = False
        except:
            pass

    # 갱신이 필요하면 업데이트 스크립트를 동기적으로 실행합니다. (수 초 소요)
    if need_update:
        update_script = os.path.join(os.path.dirname(__file__), 'update_stock_names.py')
        # 서버 환경에 따라 python 경로가 다를 수 있어 sys.executable을 사용하거나 python3을 호출합니다.
        python_exe = sys.executable or 'python3'
        subprocess.run([python_exe, update_script], capture_output=True)
        
    # 캐시 파일에서 이름 읽기
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
            return cache_data.get('stocks', {}).get(code, code)
    except:
        return code

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
        
        # 통화 설정 (한국 종목은 KRW, 그 외는 USD로 가정)
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
        
        # --with-name 파라미터가 있을 때만 종목명 검색 (속도 저하 방지)
        if with_name:
            result["name"] = get_stock_name(code)
        
        print(json.dumps(result, ensure_ascii=False))
        
    except Exception as e:
        print(json.dumps({"error": str(e)}))

if __name__ == "__main__":
    main()
