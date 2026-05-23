import json
import sys
import os
from datetime import date, datetime
import yfinance as yf
import pandas as pd

# [교육용 설명]
# 한국 주식의 경우 야후 파이낸스(yfinance) 조회를 위해 종목코드 뒤에 접미사(.KS 또는 .KQ)를 붙여주어야 합니다.
# 로컬에 캐시된 stock_names_cache.json 정보를 바탕으로 올바른 접미사를 동적으로 식별하여 덧붙입니다.
def get_stock_market_suffix(code):
    code = code.strip().upper()
    # 이미 마켓 접미사가 들어있다면 변환 없이 즉시 반환합니다.
    if "." in code:
        return code
        
    cache_file = os.path.join(os.path.dirname(__file__), 'stock_names_cache.json')
    if os.path.exists(cache_file):
        try:
            with open(cache_file, 'r', encoding='utf-8') as f:
                cache_data = json.load(f)
                stock_info = cache_data.get('stocks', {}).get(code)
                if isinstance(stock_info, dict):
                    market = stock_info.get("market", "")
                    # KOSDAQ 시장 종목의 경우 .KQ 접미사를 반환합니다.
                    if market == "KOSDAQ":
                        return f"{code}.KQ"
        except Exception:
            pass
            
    # 기본 디폴트 처리: 6자리 숫자로 구성된 한국 종목 코드일 경우 코스피(.KS)를 기본 적용합니다.
    if code.isdigit() and len(code) == 6:
        return f"{code}.KS"
    return code


def json_default(obj):
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    raise TypeError(f"Object of type {obj.__class__.__name__} is not JSON serializable")


# [교육용 설명]
# yfinance를 통해 수집된 금융 데이터의 결측값 및 타입 불일치를 보완하기 위한 데이터 정제 및 변환 함수 모음입니다.

def get_ticker_schedule(ticker_symbol, year=None):
    if year is None:
        year = date.today().year

    original_ticker = ticker_symbol.upper()
    # yfinance 조회를 위한 한국 주식 접미사(.KS 또는 .KQ) 정규화
    normalized_ticker = get_stock_market_suffix(original_ticker)

    ticker = yf.Ticker(normalized_ticker)
    
    # [교육용 설명]
    # Pandas 및 yfinance 데이터가 결측치(NaN, Null)이거나 
    # DatetimeIndex, Timestamp 등 복잡한 데이터 형식으로 반환되는 문제를 
    # 해결하기 위해 날짜 타입을 String(YYYY-MM-DD)으로 정제하는 내부 헬퍼 함수입니다.
    def clean_date(dt_val):
        try:
            if pd.isna(dt_val) or dt_val is None:
                return None
            if isinstance(dt_val, (pd.Timestamp, datetime, date)):
                dt = dt_val
            else:
                dt = pd.to_datetime(dt_val)
            
            # 입력받은 기준 연도(year)와 일치하는 데이터만 선별합니다.
            if dt.year == year:
                return dt.strftime("%Y-%m-%d")
        except Exception:
            pass
        return None

    # 데이터 정제 임시 저장소
    calendar_data = {}
    earnings_dates_list = []
    actions_list = []

    # 1. ticker.calendar 안전하게 파싱 및 정제
    # [교육용 설명] 기업의 다가올 실적 발표 및 배당 기준 예정일 정보를 수집합니다.
    try:
        cal = ticker.calendar
        if isinstance(cal, dict):
            if "Earnings Date" in cal and cal["Earnings Date"]:
                calendar_data["earnings_dates"] = [clean_date(d) for d in cal["Earnings Date"] if clean_date(d)]
            if "Dividend Date" in cal and cal["Dividend Date"]:
                calendar_data["dividend_date"] = clean_date(cal["Dividend Date"])
    except Exception as exc:
        print(f"Warning: Failed to fetch calendar for {normalized_ticker}: {exc}", file=sys.stderr)

    # 2. ticker.earnings_dates 안전하게 파싱 및 정제
    # [교육용 설명] 과거 및 향후 분기별 확정된 실적 발표일 데이터를 데이터프레임 형식으로 수집합니다.
    try:
        ed_df = ticker.earnings_dates
        if isinstance(ed_df, pd.DataFrame) and not ed_df.empty:
            for index, row in ed_df.iterrows():
                formatted_date = clean_date(index)
                if formatted_date:
                    # Estimate, Actual, Surprise(%) 항목이 모두 결측값(NaN)인지 체크해 무의미한 행은 제외합니다.
                    eps_est = row.get("Estimate", None)
                    eps_act = row.get("Actual", None)
                    surprise = row.get("Surprise(%)", None)
                    if pd.isna(eps_est) and pd.isna(eps_act) and pd.isna(surprise):
                        continue
                    earnings_dates_list.append({"date": formatted_date})
    except Exception as exc:
        print(f"Warning: Failed to fetch earnings_dates for {normalized_ticker}: {exc}", file=sys.stderr)

    # 3. ticker.actions 안전하게 파싱 및 정제
    # [교육용 설명] 배당락일(Dividends)과 주식분할(Stock Splits) 시계열 이벤트를 데이터프레임 형식으로 수집합니다.
    try:
        actions_df = ticker.actions
        if isinstance(actions_df, pd.DataFrame) and not actions_df.empty:
            for index, row in actions_df.iterrows():
                formatted_date = clean_date(index)
                if formatted_date:
                    div_val = float(row.get("Dividends", 0) or 0)
                    split_val = float(row.get("Stock Splits", 0) or 0)
                    if div_val > 0 or split_val > 0:
                        actions_list.append({
                            "date": formatted_date,
                            "dividends": div_val,
                            "stock_splits": split_val
                        })
    except Exception as exc:
        print(f"Warning: Failed to fetch actions for {normalized_ticker}: {exc}", file=sys.stderr)

    # 수집 완료된 원본 데이터를 캘린더 이벤트 규격으로 일관성 있게 변환합니다.
    events = []

    # 1) calendar 데이터 ➡️ 캘린더 이벤트 매핑
    dividend_date = calendar_data.get("dividend_date")
    if dividend_date:
        events.append({
            "type": "DIVIDEND",
            "ticker": original_ticker,
            "date": dividend_date,
            "description": "",
            "isConfirmed": True  # 공식 공시 예정일이므로 확정
        })
    
    cal_earnings = calendar_data.get("earnings_dates", [])
    if cal_earnings:
        events.append({
            "type": "EARNINGS",
            "ticker": original_ticker,
            "date": cal_earnings[0],  # 가장 가까운 예정일
            "description": "",
            "isConfirmed": False  # 다가올 실적 발표는 미확정(예상)
        })

    # 2) actions 데이터 ➡️ 캘린더 이벤트 매핑
    for action in actions_list:
        date_str = action["date"]
        if action["dividends"] > 0:
            events.append({
                "type": "EX_DIVIDEND",
                "ticker": original_ticker,
                "date": date_str,
                "description": f"배당금: ${action['dividends']}",
                "isConfirmed": True
            })
        if action["stock_splits"] > 0:
            events.append({
                "type": "SPLIT",
                "ticker": original_ticker,
                "date": date_str,
                "description": f"분할비율: {action['stock_splits']}",
                "isConfirmed": True
            })

    # 3) earnings_dates 데이터 ➡️ 캘린더 이벤트 매핑
    for earning in earnings_dates_list:
        events.append({
            "type": "EARNINGS",
            "ticker": original_ticker,
            "date": earning["date"],
            "description": "",
            "isConfirmed": True  # 확정된 실적 발표
        })

    # 중복 이벤트 제거 처리
    # [교육용 설명] 예정과 과거 실적 발표가 중복 기록되었을 경우(날짜와 타입이 동일한 경우)
    # 중복 제거하여 데이터 전송량을 최소화합니다.
    seen = set()
    unique_events = []
    for event in events:
        key = (
            event.get("type"),
            event.get("date"),
            event.get("description"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique_events.append(event)

    # 이른 날짜부터 가장 늦은 날짜 순으로 정렬합니다.
    unique_events.sort(key=lambda x: (x.get("date", ""), x.get("type", "")))

    return {
        "ticker": original_ticker,
        "year": year,
        "events": unique_events,
    }


def get_schedules(ticker_symbols, year=None):
    if year is None:
        year = date.today().year

    schedules = []
    for ticker_symbol in ticker_symbols:
        ticker_symbol = ticker_symbol.strip()
        if not ticker_symbol:
            continue

        try:
            schedule = get_ticker_schedule(ticker_symbol, year)
            schedules.append(schedule)
        except Exception as exc:
            schedules.append(
                {
                    "ticker": ticker_symbol,
                    "year": year,
                    "error": str(exc),
                }
            )

    return {
        "year": year,
        "schedules": schedules,
    }


if __name__ == "__main__":
    default_tickers = ["AAPL", "AMZN", "005930"]
    year_arg = None
    tickers_arg = default_tickers

    if len(sys.argv) > 1:
        try:
            year_arg = int(sys.argv[1])
            if len(sys.argv) > 2:
                tickers_arg = sys.argv[2:]
        except ValueError:
            tickers_arg = sys.argv[1:]

    if year_arg is None:
        year_arg = date.today().year

    schedule = get_schedules(tickers_arg, year_arg)
    print(json.dumps(schedule, indent=2, ensure_ascii=False, default=json_default))
