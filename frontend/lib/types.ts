export interface Proposal {
  id: string
  title: string
  description: string
  creator: string
  startTime: bigint
  endTime: bigint
  executed: boolean
  passed: boolean
  yesMarket: string
  noMarket: string
  status: "pending" | "active" | "closed" | "executed"
}

export interface MarketData {
  yesPrice: bigint
  noPrice: bigint
  totalSupply: bigint
  yesBalance: bigint
  noBalance: bigint
}

export interface PricePoint {
  timestamp: number
  yesPrice: number
  noPrice: number
}

export type MarketOption = "YES" | "NO"
export type TradeAction = "BUY" | "SELL"
