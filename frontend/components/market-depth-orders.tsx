"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { MarketOption, OrderBookEntry, UserOrder } from "@/lib/types"
import { OrderBook } from "@/components/order-book"
import { OrderList } from "@/components/order-list"

interface Props {
  market: MarketOption
  orderBook: OrderBookEntry[]
  userOrders: UserOrder[]
  onCancelOrder: (orderId: string) => void
  userOrdersError?: string | null
}

export function MarketDepthAndOrders({ market, orderBook, userOrders, onCancelOrder, userOrdersError }: Props) {
  const [tab, setTab] = useState<"book" | "yours">("book")

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Market</CardTitle>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="grid grid-cols-2">
              <TabsTrigger value="book">Order Book</TabsTrigger>
              <TabsTrigger value="yours">Your Orders</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </CardHeader>
      <CardContent>
        {tab === "book" ? (
          <OrderBook orderBook={orderBook} market={market} />
        ) : (
          <OrderList orders={userOrders} onCancelOrder={onCancelOrder} error={userOrdersError} />
        )}
      </CardContent>
    </Card>
  )
}
