import json
import sys
import os
from datetime import date, datetime
import yfinance as yf

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


def normalize_date(value):
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def parse_calendar_events(calendar, year, original_ticker):
    # [교육용 설명]
    # yfinance calendar 데이터에서 실적 발표일, 배당일, 배당락일을 파싱합니다.
    # 각 일정의 성격에 맞게 타입명을 직관적으로 변경하고,
    # status(문자열) 대신 확정 여부를 명확히 나타내는 isConfirmed(Boolean) 필드를 사용합니다.
    events = []
    if not isinstance(calendar, dict):
        return events

    for key, value in calendar.items():
        if value is None:
            continue

        if key == "Earnings Date":
            items = value if isinstance(value, (list, tuple)) else [value]
            for item in items:
                if isinstance(item, (date, datetime)) and item.year == year:
                    events.append(
                        {
                            "type": "EARNINGS",
                            "date": normalize_date(item),
                            "description": "",
                            "isConfirmed": False,  # 실적 발표일은 예상이므로 False 처리
                            "ticker": original_ticker
                        }
                    )
        elif key == "Dividend Date" and isinstance(value, (date, datetime)):
            if value.year == year:
                events.append(
                    {
                        "type": "DIVIDEND",  # DIVIDEND_DATE에서 DIVIDEND로 타입명 간소화
                        "date": normalize_date(value),
                        "description": "",
                        "isConfirmed": True,  # 배당 예정일은 확정이므로 True 처리
                        "ticker": original_ticker
                    }
                )
        elif key == "Ex-Dividend Date" and isinstance(value, (date, datetime)):
            if value.year == year:
                events.append(
                    {
                        "type": "EX_DIVIDEND",  # EX_DIVIDEND_DATE에서 EX_DIVIDEND로 변경
                        "date": normalize_date(value),
                        "description": "",
                        "isConfirmed": True,  # 배당락일은 확정이므로 True 처리
                        "ticker": original_ticker
                    }
                )

    return events


def parse_action_events(actions, year, original_ticker):
    # [교육용 설명]
    # yfinance actions 데이터에서 주식 분할 이벤트를 파싱합니다.
    # 기존 STOCK_SPLIT을 SPLIT으로 간소화하고, 확정된 내역이므로 isConfirmed를 True로 설정합니다.
    events = []
    if actions is None or actions.empty:
        return events

    for idx, row in actions.iterrows():
        event_year = idx.year if isinstance(idx, (date, datetime)) else None
        if event_year != year:
            continue

        splits = float(row.get("Stock Splits", 0) or 0)

        if splits != 0:
            events.append(
                {
                    "type": "SPLIT",  # STOCK_SPLIT에서 SPLIT으로 변경
                    "date": normalize_date(idx),
                    "ratio": str(splits),
                    "description": "",
                    "isConfirmed": True,  # 주식 분할 완료 내역이므로 확정(True)
                    "ticker": original_ticker
                }
            )

    return events


def get_ticker_schedule(ticker_symbol, year=None):
    if year is None:
        year = date.today().year

    original_ticker = ticker_symbol.upper()
    # yfinance 조회를 위한 티커 정규화 적용 (.KS/.KQ 등)
    normalized_ticker = get_stock_market_suffix(original_ticker)

    ticker = yf.Ticker(normalized_ticker)
    
    # [교육용 설명] yfinance 라이브러리가 특정 종목(예: 우선주 등)을 파싱할 때 내부 오류를 유발할 수 있으므로
    # calendar 정보 획득 시 try-except 예외 처리를 감싸 안정성을 확보합니다.
    calendar = {}
    try:
        calendar = ticker.calendar
    except Exception as exc:
        print(f"Warning: Failed to fetch calendar for {normalized_ticker}: {exc}", file=sys.stderr)

    # [교육용 설명] 'PriceHistory' object has no attribute '_dividends' 등과 같은 내부 속성 파싱 오류 발생 시
    # 전체 금융 일정 병합 스크립트가 도중에 실패하지 않도록 try-except 예외 처리를 추가합니다.
    actions = None
    try:
        actions = ticker.actions
    except Exception as exc:
        print(f"Warning: Failed to fetch actions for {normalized_ticker}: {exc}", file=sys.stderr)

    events = parse_calendar_events(calendar, year, original_ticker) + parse_action_events(actions, year, original_ticker)

    seen = set()
    unique_events = []
    for event in events:
        key = (
            event.get("type"),
            event.get("date"),
            event.get("description"),
            event.get("amount"),
            event.get("ratio"),
        )
        if key in seen:
            continue
        seen.add(key)
        unique_events.append(event)

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
