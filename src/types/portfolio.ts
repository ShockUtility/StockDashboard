export interface Asset {
  id: string;
  type: 'KR_STOCK' | 'US_STOCK' | 'CUSTOM' | 'CASH';
  code: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  changePercent?: number;
  currency: 'KRW' | 'USD';
}

export interface Portfolio {
  id: string;
  name: string;
  assets: Asset[];
}

export type SortKey = 'name' | 'quantity' | 'avgPrice' | 'currentPrice' | 'investment' | 'current' | 'returnAmount' | 'returnPercent';
export type SortDirection = 'asc' | 'desc';

export interface SortConfig {
  key: SortKey;
  direction: SortDirection;
}

export interface PieModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  data: { name: string; value: number }[];
  formatMoney: (val: number, cur: string) => string;
}

export interface ExchangeRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  exchangeHistory: { date: string; rate: number }[];
  exchangeRate: number;
}

export interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'KR_STOCK' | 'US_STOCK' | 'CUSTOM' | 'CASH';
  setType: (val: 'KR_STOCK' | 'US_STOCK' | 'CUSTOM' | 'CASH') => void;
  code: string;
  setCode: (val: string) => void;
  actualCode: string;
  setActualCode: (val: string) => void;
  avgPrice: string;
  setAvgPrice: (val: string) => void;
  quantity: string;
  setQuantity: (val: string) => void;
  loading: boolean;
  errorMsg: string;
  setErrorMsg: (val: string) => void;
  currency: 'KRW' | 'USD';
  setCurrency: (val: 'KRW' | 'USD') => void;
  onSubmit: (e: React.FormEvent) => void;
}

export interface StockDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  asset: Asset | null;
  formatMoney: (val: number, cur: string) => string;
}
