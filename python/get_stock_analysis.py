import sys
import json
import yfinance as yf
from datetime import datetime

def get_stock_analysis(code):
    """
    야후 파이낸스(yfinance)를 이용해 종목의 분석 자료를 가져오는 함수입니다.
    한국 종목과 미국 종목을 구분하여 처리합니다.
    """
    # 한국 종목 처리: 숫자로만 이루어진 코드인 경우
    if code.isdigit():
        # 우선 코스피(.KS)로 시도합니다.
        ticker_symbol = f"{code}.KS"
    else:
        # 미국 종목 등은 입력된 코드 그대로 사용합니다.
        ticker_symbol = code

    try:
        # Ticker 객체 생성
        ticker = yf.Ticker(ticker_symbol)
        
        # 종목 정보(info) 가져오기
        info = ticker.info
        
        # 만약 코스피로 시도했는데 데이터가 없거나 symbol이 일치하지 않으면 코스닥(.KQ)으로 재시도합니다.
        if code.isdigit() and (not info or 'symbol' not in info or info.get('trailingPE') is None):
            ticker_symbol = f"{code}.KQ"
            ticker = yf.Ticker(ticker_symbol)
            info = ticker.info

        # 기본 투자 지표 추출
        result = {
            "marketCap": info.get("marketCap"),             # 시가총액
            "per": info.get("trailingPE") or info.get("forwardPE"), # PER (현재 또는 미래)
            "pbr": info.get("priceToBook"),                 # PBR
            "eps": info.get("trailingEps"),                 # EPS (주당순이익)
            "dividendYield": info.get("dividendYield"),     # 배당수익률 (예: 0.02 -> 2%)
            "currency": info.get("currency"),               # 통화 (KRW, USD 등)
        }

        # 재무제표 데이터 (연간 손익계산서) 가져오기
        financials = ticker.financials
        
        financial_data = []
        if not financials.empty:
            # 최근 최대 3개년의 데이터만 사용합니다.
            # financials의 컬럼은 날짜(Datetime) 형태입니다.
            years = financials.columns[:3]
            
            for year in years:
                # 연도만 추출 (예: 2023)
                year_str = str(year.year)
                
                # 데이터프레임에서 필요한 항목을 추출합니다.
                # 데이터가 없는 경우를 대비해 예외 처리를 하거나 get() 스타일로 접근합니다.
                try:
                    revenue = float(financials.loc['Total Revenue', year]) if 'Total Revenue' in financials.index else None
                except:
                    revenue = None
                    
                try:
                    operating_income = float(financials.loc['Operating Income', year]) if 'Operating Income' in financials.index else None
                except:
                    operating_income = None
                    
                try:
                    net_income = float(financials.loc['Net Income', year]) if 'Net Income' in financials.index else None
                except:
                    net_income = None

                financial_data.append({
                    "year": year_str,
                    "revenue": revenue,
                    "operatingIncome": operating_income,
                    "netIncome": net_income
                })
        
        # 프론트엔드에서 차트로 그릴 때 시간 순서대로 (과거 -> 최신) 그리도록 뒤집어줍니다.
        result["financials"] = financial_data[::-1]

        return result

    except Exception as e:
        # 에러가 발생하면 에러 메시지를 반환합니다.
        return {"error": str(e)}

if __name__ == "__main__":
    # 명령줄 인수로 종목 코드가 전달되었는지 확인합니다.
    if len(sys.argv) < 2:
        print(json.dumps({"error": "종목 코드를 입력해주세요."}))
        sys.exit(1)

    code = sys.argv[1].upper()
    
    # 분석 데이터 가져오기
    analysis_result = get_stock_analysis(code)
    
    # JSON 형태로 출력 (ensure_ascii=False로 한글 깨짐 방지)
    print(json.dumps(analysis_result, ensure_ascii=False))
