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
            <div className="flex justify-between text-xs font-semibold text-muted-foreground pb-2 border-b">
              <span>Price</span>
              <span>Amount</span>
              <span>Total</span>
            </div>
            <div className="space-y-1">
              {buyOrders.map((order, i) => (
                <div key={i} className="flex justify-between text-sm font-mono">
                  <span className={`text-${accentColor}`}>${order.price.toFixed(4)}</span>
                  <span>{order.amount.toFixed(2)}</span>
                  <span className="text-muted-foreground">${order.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Sell Orders */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-semibold text-muted-foreground pb-2 border-b">
              <span>Price</span>
              <span>Amount</span>
              <span>Total</span>
            </div>
            <div className="space-y-1">
              {sellOrders.map((order, i) => (
                <div key={i} className="flex justify-between text-sm font-mono">
                  <span className="text-destructive">${order.price.toFixed(4)}</span>
                  <span>{order.amount.toFixed(2)}</span>
                  <span className="text-muted-foreground">${order.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
