/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';

export function useExchangeRate() {
  const [exchangeRate, setExchangeRate] = useState<number>(1400);
  const [exchangeHistory, setExchangeHistory] = useState<{ date: string; rate: number }[]>([]);

  const fetchExchangeRate = useCallback(async () => {
    try {
      const res = await fetch('/api/exchange-rate');
      const data = await res.json();
      if (res.ok && data.rate) {
        setExchangeRate(data.rate);
        if (data.history) setExchangeHistory(data.history);
        localStorage.setItem('stock_exchange_rate', data.rate.toString());
      }
    } catch (err) {
      console.error("환율 업데이트 실패:", err);
    }
  }, []);

  useEffect(() => {
    const savedRate = localStorage.getItem('stock_exchange_rate');
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (savedRate) setExchangeRate(parseFloat(savedRate));
    fetchExchangeRate();
  }, [fetchExchangeRate]);

  return { exchangeRate, exchangeHistory, fetchExchangeRate };
}
