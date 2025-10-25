"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
} from "recharts"
import { MarketDepthAndOrders } from "@/components/market-depth-orders"
import type { MarketData, MarketOption, OrderBookEntry, UserOrder } from "@/lib/types"

interface MarketViewProps {
  marketData: MarketData
  userOrders: UserOrder[]
  selectedMarket: MarketOption
  onMarketChange: (market: MarketOption) => void
  onCancelOrder: (orderId: string) => void
  userOrdersError?: string | null
  // New: live orderbook from hook
  orderBookEntries?: OrderBookEntry[]
  proposalId?: string
}

export function MarketView({ marketData, userOrders, selectedMarket, onMarketChange, onCancelOrder, userOrdersError, orderBookEntries }: MarketViewProps) {
  const fallbackOrderBook = selectedMarket === "YES" ? marketData.yesOrderBook : marketData.noOrderBook
  const orderBook = orderBookEntries && orderBookEntries.length > 0 ? orderBookEntries : fallbackOrderBook
  const baseOrders = userOrders ?? []
  const marketOrders = baseOrders.filter((order) => order.market === selectedMarket)

  const twapChartData = marketData.twapHistory.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    YES: point.yesTWAP,
    NO: point.noTWAP,
  }))

  // const volumeChartData = marketData.volumeDistribution.map((point) => ({
  //   price: point.price.toFixed(3),
  //   Buy: point.buyVolume,
  //   Sell: point.sellVolume,
  // }))

  return (
    <div className="space-y-6">
      {/* TWAP Chart */}
      <Card>
        <CardHeader>
          <CardTitle>TWAP Price History</CardTitle>
          <CardDescription>Time-Weighted Average Price from order book</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={twapChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 1]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="YES" stroke="hsl(var(--primary))" strokeWidth={2} />
                <Line type="monotone" dataKey="NO" stroke="hsl(var(--destructive))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Order Volume Distribution</CardTitle>
          <CardDescription>Buy and sell order volumes at different price levels</CardDescription>
        </CardHeader>
        {/* <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="price" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Bar dataKey="Buy" fill="hsl(var(--primary))" />
                <Bar dataKey="Sell" fill="hsl(var(--destructive))" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent> */}
      </Card>

      {/* Combined Order Book / Your Orders */}
      <MarketDepthAndOrders
        market={selectedMarket}
        orderBook={orderBook}
        userOrders={marketOrders}
        onCancelOrder={onCancelOrder}
        userOrdersError={userOrdersError}
      />
    </div>
  )
}
