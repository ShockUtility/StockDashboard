/* eslint-disable */
import { useState, useEffect, useCallback } from 'react';
import { Portfolio, Asset } from '../types/portfolio';

export function usePortfolio() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [currentPortfolioId, setCurrentPortfolioId] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);

  // 초기 데이터 로드 및 마이그레이션
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsMounted(true);
    const savedPortfolios = localStorage.getItem('stock_portfolios_v2');
    if (savedPortfolios) {
      const parsed = JSON.parse(savedPortfolios);
      setPortfolios(parsed);
      if (parsed.length > 0) setCurrentPortfolioId(parsed[0].id);
    } else {
      const oldPortfolio = localStorage.getItem('stock_portfolio');
      const oldCash = localStorage.getItem('stock_cash');

      if (oldPortfolio || oldCash) {
        const migratedAssets: Asset[] = [];

        if (oldPortfolio) {
          const parsedOld = JSON.parse(oldPortfolio);
          parsedOld.forEach((item: any) => {
            let type: Asset['type'] = 'KR_STOCK';
            let currency: Asset['currency'] = 'KRW';

            if (item.currency === 'USD') {
              type = 'US_STOCK';
              currency = 'USD';
            } else if (item.currency === 'GOLD') {
              type = 'CUSTOM';
              currency = 'KRW';
            }

            migratedAssets.push({ ...item, type, currency });
          });
        }

        if (oldCash) {
          const parsedCash = JSON.parse(oldCash);
          if (parsedCash.KRW > 0) migratedAssets.push({ id: 'cash-krw-' + Date.now(), type: 'CASH', name: '현금 (KRW)', code: 'CASH', quantity: parsedCash.KRW, avgPrice: 1, currentPrice: 1, currency: 'KRW' });
          if (parsedCash.USD > 0) migratedAssets.push({ id: 'cash-usd-' + Date.now(), type: 'CASH', name: '현금 (USD)', code: 'CASH', quantity: parsedCash.USD, avgPrice: 1, currentPrice: 1, currency: 'USD' });
          if (parsedCash.GOLD > 0) migratedAssets.push({ id: 'cash-gold-' + Date.now(), type: 'CASH', name: '현금 (금계좌)', code: 'CASH', quantity: parsedCash.GOLD, avgPrice: 1, currentPrice: 1, currency: 'KRW' });
        }

        const defaultPortfolio: Portfolio = { id: 'default-' + Date.now(), name: '기본 포트폴리오', assets: migratedAssets };
        setPortfolios([defaultPortfolio]);
        setCurrentPortfolioId(defaultPortfolio.id);
      } else {
        const initPortfolio: Portfolio = { id: 'init-' + Date.now(), name: '나의 포트폴리오', assets: [] };
        setPortfolios([initPortfolio]);
        setCurrentPortfolioId(initPortfolio.id);
      }
    }
  }, []);

  // 포트폴리오 변경 시 자동 저장
  useEffect(() => {
    if (isMounted && portfolios.length > 0) {
      localStorage.setItem('stock_portfolios_v2', JSON.stringify(portfolios));
    }
  }, [portfolios, isMounted]);

  const handleAddPortfolio = useCallback(() => {
    const newPortfolio: Portfolio = {
      id: 'pf-' + Date.now(),
      name: '새 포트폴리오',
      assets: [{ id: 'cash-' + Date.now(), type: 'CASH', name: '현금 (KRW)', code: 'CASH', quantity: 0, avgPrice: 1, currentPrice: 1, currency: 'KRW' }]
    };
    setPortfolios(prev => [...prev, newPortfolio]);
    setCurrentPortfolioId(newPortfolio.id);
  }, []);

  const handleRenamePortfolio = useCallback((id: string, newName: string) => {
    setPortfolios(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
  }, []);

  const handleDeletePortfolio = useCallback((id: string) => {
    if (portfolios.length <= 1) {
      alert('최소 하나 이상의 포트폴리오는 유지해야 합니다.');
      return;
    }
    if (confirm('이 포트폴리오와 포함된 모든 자산이 삭제됩니다. 계속하시겠습니까?')) {
      const nextPortfolios = portfolios.filter(p => p.id !== id);
      setPortfolios(nextPortfolios);
      if (currentPortfolioId === id) setCurrentPortfolioId(nextPortfolios[0].id);
    }
  }, [portfolios, currentPortfolioId]);

  const handleAddAsset = useCallback((portfolioId: string, newAsset: Asset) => {
    setPortfolios(prev => prev.map(p => p.id === portfolioId ? { ...p, assets: [...p.assets, newAsset] } : p));
  }, []);

  const handleDeleteAsset = useCallback((portfolioId: string, assetId: string) => {
    if (confirm('정말 삭제하시겠습니까?')) {
      setPortfolios(prev => prev.map(p => p.id === portfolioId ? { ...p, assets: p.assets.filter(a => a.id !== assetId) } : p));
    }
  }, []);

  const handleMoveAsset = useCallback((fromPid: string, toPid: string, assetId: string) => {
    setPortfolios(prev => {
      let movingAsset: Asset | undefined;
      const updatedPrev = prev.map(p => {
        if (p.id === fromPid) {
          movingAsset = p.assets.find(a => a.id === assetId);
          return { ...p, assets: p.assets.filter(a => a.id !== assetId) };
        }
        return p;
      });

      if (!movingAsset) return prev;

      return updatedPrev.map(p => p.id === toPid ? { ...p, assets: [...p.assets, movingAsset!] } : p);
    });
  }, []);

  const handleEditAsset = useCallback((portfolioId: string, assetId: string, updatedData: Partial<Asset>) => {
    setPortfolios(prev => prev.map(p => {
      if (p.id === portfolioId) {
        return {
          ...p,
          assets: p.assets.map(a => a.id === assetId ? { ...a, ...updatedData } : a)
        };
      }
      return p;
    }));
  }, []);

  return {
    isMounted,
    portfolios,
    setPortfolios,
    currentPortfolioId,
    setCurrentPortfolioId,
    handleAddPortfolio,
    handleRenamePortfolio,
    handleDeletePortfolio,
    handleAddAsset,
    handleDeleteAsset,
    handleMoveAsset,
    handleEditAsset
  };
}
