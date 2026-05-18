import sys
import json
import yfinance as yf
from datetime import datetime

def get_stock_analysis(code):
    """
    야후 파이낸스(yfinance)를 이용해 종목의 분석 자료를 가져오는 함수입니다.
    한국 종목의 경우 info 데이터가 비어있는 경우가 많아, fast_info와 재무제표를 활용해 보완합니다.
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
        
        # [보완] fast_info를 사용해 시가총액을 가져옵니다. 
        # 한국 종목은 info에서 marketCap이 null로 나오는 경우가 많지만 fast_info는 잘 나옵니다.
        try:
            fast_info = ticker.fast_info
            market_cap = fast_info.get('market_cap') or fast_info.market_cap
        except:
            market_cap = None
            
        # 종목 정보(info) 가져오기
        info = ticker.info
        
        # 만약 코스피로 시도했는데 데이터가 아예 없으면 코스닥(.KQ)으로 재시도합니다.
        if code.isdigit() and (not info or 'symbol' not in info):
            ticker_symbol = f"{code}.KQ"
            ticker = yf.Ticker(ticker_symbol)
            info = ticker.info
            try:
                fast_info = ticker.fast_info
                market_cap = fast_info.get('market_cap') or fast_info.market_cap
            except:
                pass

        # 기본 투자 지표 추출
        per = info.get("trailingPE") or info.get("forwardPE")
        pbr = info.get("priceToBook")
        eps = info.get("trailingEps")
        dividend_yield = info.get("dividendYield")

        # 재무제표 데이터 (연간 손익계산서) 가져오기
        financials = ticker.financials
        
        financial_data = []
        if not financials.empty:
            # 최근 최대 3개년의 데이터만 사용합니다.
            years = financials.columns[:3]
            
            for year in years:
                year_str = str(year.year)
                
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
        
        # 프론트엔드에서 사용하기 위해 순서를 과거 -> 최신으로 뒤집습니다.
        financial_data = financial_data[::-1]

        # [보완] 한국 종목처럼 PER이 제공되지 않는 경우, 직접 계산(추정)합니다.
        # 추정 PER = 현재 시가총액 / 최근 연도 순이익
        if not per and market_cap and financial_data:
            latest_net_income = financial_data[-1].get("netIncome")
            if latest_net_income and latest_net_income > 0:
                per = market_cap / latest_net_income

        result = {
            "marketCap": market_cap or info.get("marketCap"),
            "per": per,
            "pbr": pbr,
            "eps": eps,
            "dividendYield": dividend_yield,
            "currency": info.get("currency") or ("KRW" if code.isdigit() else "USD"),
            "financials": financial_data
        }

        return result

    except Exception as e:
        # 에러가 발생하면 에러 메시지를 반환합니다.
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "종목 코드를 입력해주세요."}))
        sys.exit(1)

    code = sys.argv[1].upper()
    
    analysis_result = get_stock_analysis(code)
    
    print(json.dumps(analysis_result, ensure_ascii=False))
