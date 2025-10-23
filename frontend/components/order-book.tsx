"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { OrderBookEntry, MarketOption } from "@/lib/types"

interface OrderBookProps {
  orderBook: OrderBookEntry[]
  market: MarketOption
}

export function OrderBook({ orderBook, market }: OrderBookProps) {
  const buyOrders = orderBook.filter((o) => o.side === "buy").slice(0, 10)
  const sellOrders = orderBook.filter((o) => o.side === "sell").slice(0, 10)

  const accentColor = market === "YES" ? "primary" : "destructive"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Order Book - {market}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          {/* Buy Orders */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 items-center text-xs font-semibold text-muted-foreground pb-2 border-b">
              <span className="text-left">Price</span>
              <span className="text-center">Amount</span>
              <span className="text-right">Total</span>
            </div>
            <div className="space-y-1">
              {buyOrders.map((order, i) => (
                <div key={i} className="grid grid-cols-3 items-center text-sm font-mono">
                  <span className={`text-${accentColor} text-left`}>${order.price.toFixed(4)}</span>
                  <span className="text-center">{order.amount.toFixed(2)}</span>
                  <span className="text-right text-muted-foreground">${order.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sell Orders */}
          <div className="space-y-2">
            <div className="grid grid-cols-3 items-center text-xs font-semibold text-muted-foreground pb-2 border-b">
              <span className="text-left">Price</span>
              <span className="text-center">Amount</span>
              <span className="text-right">Total</span>
            </div>
            <div className="space-y-1">
              {sellOrders.map((order, i) => (
                <div key={i} className="grid grid-cols-3 items-center text-sm font-mono">
                  <span className="text-destructive text-left">${order.price.toFixed(4)}</span>
                  <span className="text-center">{order.amount.toFixed(2)}</span>
                  <span className="text-right text-muted-foreground">${order.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
