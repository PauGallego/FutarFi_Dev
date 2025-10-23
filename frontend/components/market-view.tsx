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
import { OrderBook } from "@/components/order-book"
import { OrderList } from "@/components/order-list"
import type { MarketData, MarketOption, UserOrder } from "@/lib/types"
import { Label } from "@/components/ui/label"

interface MarketViewProps {
  marketData: MarketData
  userOrders: UserOrder[]
  selectedMarket: MarketOption
  onMarketChange: (market: MarketOption) => void
  onCancelOrder: (orderId: string) => void
}

export function MarketView({ marketData, userOrders, selectedMarket, onMarketChange, onCancelOrder }: MarketViewProps) {
  const orderBook = selectedMarket === "YES" ? marketData.yesOrderBook : marketData.noOrderBook
  const marketOrders = userOrders.filter((order) => order.market === selectedMarket)

  const twapChartData = marketData.twapHistory.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    YES: point.yesTWAP,
    NO: point.noTWAP,
  }))

  const volumeChartData = marketData.volumeDistribution.map((point) => ({
    price: point.price.toFixed(3),
    Buy: point.buyVolume,
    Sell: point.sellVolume,
  }))

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label className="text-sm font-medium">Select Market</Label>
        <div className="relative p-1 rounded-full bg-muted border-2 border-border">
          <div
            className={`
              absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full
              transition-all duration-300 ease-out
              ${selectedMarket === "YES" ? "left-1 bg-primary" : "left-[calc(50%+3px)] bg-destructive"}
            `}
          />
          <button
            onClick={() => onMarketChange("YES")}
            className={`
              relative z-10 w-1/2 px-6 py-3 rounded-full font-semibold text-sm
              transition-colors duration-300
              ${selectedMarket === "YES" ? "text-black" : "text-muted-foreground hover:text-foreground"}
            `}
          >
            YES Market
          </button>
          <button
            onClick={() => onMarketChange("NO")}
            className={`
              relative z-10 w-1/2 px-6 py-3 rounded-full font-semibold text-sm
              transition-colors duration-300
              ${selectedMarket === "NO" ? "text-black" : "text-muted-foreground hover:text-foreground"}
            `}
          >
            NO Market
          </button>
        </div>
      </div>

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
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Order Book */}
      <OrderBook orderBook={orderBook} market={selectedMarket} />

      {/* User Orders */}
      {marketOrders.length > 0 && <OrderList orders={marketOrders} onCancelOrder={onCancelOrder} />}
    </div>
  )
}
