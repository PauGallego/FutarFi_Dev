"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OrderBookEntry, MarketOption } from "@/lib/types"

interface OrderBookProps {
  orderBook: OrderBookEntry[]
  market: MarketOption
}

export function OrderBook({ orderBook, market }: OrderBookProps) {
  // Compute live proportions using counts of total orders per side
  const totalBuys = orderBook.filter(o => o.side === 'buy').length
  const totalSells = orderBook.filter(o => o.side === 'sell').length
  const totalOrders = totalBuys + totalSells
  const bidPct = totalOrders > 0 ? (totalBuys / totalOrders) * 100 : 0
  const askPct = totalOrders > 0 ? (totalSells / totalOrders) * 100 : 0

  const buyOrders = orderBook.filter((o) => o.side === "buy").slice(0, 10)
  const sellOrders = orderBook.filter((o) => o.side === "sell").slice(0, 10)

  const Row = ({ order, align }: { order: OrderBookEntry; align: "left" | "right" }) => {
    const filled = typeof order.filled === 'number' ? order.filled : 0
    const amount = typeof order.amount === 'number' ? order.amount : 0
    const computedPct = amount > 0 ? Math.min(1, Math.max(0, filled / amount)) : 0
    const fillPct = typeof order.fillPct === 'number' ? order.fillPct : computedPct
  const pctNum = fillPct * 100
  const width = `${pctNum.toFixed(2)}%`

    return (
      <div className="relative grid grid-cols-4 items-center text-sm font-mono py-0.5">
        {/* background fill bar */}
        <div
          className={`absolute inset-y-0 ${align === 'left' ? 'left-0' : 'right-0'} ${align === 'left' ? 'bg-primary/15' : 'bg-destructive/15'}`}
          style={{ width }}
        />
        {/* foreground content */}
        <span className={`relative z-10 ${align === 'left' ? 'text-primary' : 'text-destructive'} text-left`}>${order.price.toFixed(4)}</span>
  <span className="relative z-10 text-center">{order.amount.toFixed(3)}</span>
  <span className="relative z-10 text-center text-muted-foreground">{pctNum.toFixed(0)}%</span>
        <span className="relative z-10 text-right text-muted-foreground">${order.total.toFixed(2)}</span>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Book - t{market}</CardTitle>
        {/* Proportional bar: left (bids, green) vs right (asks, red) by order counts */}
        <div className="mt-2 h-2 w-full rounded bg-muted overflow-hidden flex">
          <div className="h-full bg-primary" style={{ width: `${bidPct}%` }} />
          <div className="h-full bg-destructive" style={{ width: `${askPct}%` }} />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Buy Orders */}
          <div className="space-y-2">
            <div className="text-[11px] tracking-wide font-semibold text-primary/80">Bids</div>
            <div className="grid grid-cols-4 items-center text-xs font-semibold text-muted-foreground pb-2 border-b">
              <span className="text-left">Price</span>
              <span className="text-center">Amount</span>
              <span className="text-center">Filled</span>
              <span className="text-right">Total</span>
            </div>
            <div className="space-y-1">
              {buyOrders.map((order, i) => (
                <Row key={`buy-${i}`} order={order} align="left" />
              ))}
            </div>
          </div>

          {/* Sell Orders */}
          <div className="space-y-2">
            <div className="text-[11px] tracking-wide font-semibold text-destructive/80">Asks</div>
            <div className="grid grid-cols-4 items-center text-xs font-semibold text-muted-foreground pb-2 border-b">
              <span className="text-left">Price</span>
              <span className="text-center">Amount</span>
              <span className="text-center">Filled</span>
              <span className="text-right">Total</span>
            </div>
            <div className="space-y-1">
              {sellOrders.map((order, i) => (
                <Row key={`sell-${i}`} order={order} align="right" />
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
