"use client"
import React, { useEffect, useMemo, useState, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  BarChart,
  Bar,
  Cell,
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
  orderBookEntries?: OrderBookEntry[]
  proposalId?: string
}

function formatTimeLabel(ts: string | number | Date) {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  } catch {
    return String(ts)
  }
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
const GREEN = "#16a34a" // Tailwind green-600

type Candle = {
  timestamp: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

type CandlesResponse = {
  proposalId: string
  side: string
  interval: string
  candles: Candle[]
}

export function MarketView({
  marketData,
  userOrders,
  selectedMarket,
  onMarketChange,
  onCancelOrder,
  userOrdersError,
  orderBookEntries,
  proposalId,
}: MarketViewProps) {
  const fallbackOrderBook = selectedMarket === "YES" ? marketData.yesOrderBook : marketData.noOrderBook
  const orderBook = orderBookEntries && orderBookEntries.length > 0 ? orderBookEntries : fallbackOrderBook
  const baseOrders = userOrders ?? []
  const marketOrders = baseOrders.filter((order) => order.market === selectedMarket)

  const [candles, setCandles] = useState<Candle[]>([])
  const [loadingCandles, setLoadingCandles] = useState(false)
  const [candlesError, setCandlesError] = useState<string | null>(null)
  const interval = "1m"
  const NUM_BARS = 20 // número fijo de barras en el gráfico
  const backoffRef = useRef<{ ms: number; next: number }>({ ms: 0, next: 0 })

  useEffect(() => {
    if (!proposalId) return
    const side = selectedMarket === "YES" ? "approve" : "reject"

    const controller = new AbortController()
    async function fetchCandles() {
      if (backoffRef.current.next && Date.now() < backoffRef.current.next) return
      setCandlesError(null)
      setLoadingCandles(true)
      try {
        const res = await fetch(
          `${API_BASE}/orderbooks/${proposalId}/${side}/candles?interval=${interval}&limit=${NUM_BARS}`,
          { signal: controller.signal }
        )
        const ct = res.headers.get("content-type") || ""
        if (!res.ok) {
          const body = await res.text().catch(() => "")
          // Exponential backoff on 429
          if (res.status === 429) {
            backoffRef.current.ms = Math.min(backoffRef.current.ms ? backoffRef.current.ms * 2 : 5000, 60000)
            backoffRef.current.next = Date.now() + backoffRef.current.ms
          }
          throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ""}`)
        }
        if (!ct.includes("application/json")) {
          const body = await res.text().catch(() => "")
          throw new Error(`Unexpected response (not JSON): ${body.slice(0, 120)}`)
        }
        const data: CandlesResponse = await res.json()
        setCandles(Array.isArray(data?.candles) ? data.candles : [])
        // reset backoff on success
        backoffRef.current.ms = 0
        backoffRef.current.next = 0
      } catch (e: any) {
        if (e?.name !== "AbortError") {
          setCandles([])
          setCandlesError(e?.message || "Failed to load candles")
        }
      } finally {
        setLoadingCandles(false)
      }
    }

    void fetchCandles()
    const id = setInterval(fetchCandles, 10000)
    return () => {
      controller.abort()
      clearInterval(id)
    }
  }, [proposalId, selectedMarket])

  // Gráfico de velas con NUM_BARS fijo (últimas N velas alineadas a la derecha)
  const fixedCandleChartData = useMemo(() => {
    const out = new Array(NUM_BARS).fill(null).map(() => ({ time: "", open: 0, high: 0, low: 0, close: 0, bodyBase: 0, body: 0, rangeHL: 0, isUp: true }))
    const start = Math.max(0, candles.length - NUM_BARS)
    const slice = candles.slice(start)
    // place slice at the end of out
    const offset = NUM_BARS - slice.length
    slice.forEach((c, i) => {
      const bodyBase = Math.min(Number(c.open), Number(c.close))
      const body = Math.abs(Number(c.close) - Number(c.open))
      const low = Number(c.low)
      const high = Number(c.high)
      out[offset + i] = {
        time: formatTimeLabel(c.timestamp),
        open: Number(c.open),
        high,
        low,
        close: Number(c.close),
        bodyBase,
        body,
        rangeHL: Math.max(0, high - low),
        isUp: Number(c.close) >= Number(c.open),
      }
    })
    return out
  }, [candles])

  // Gráfico de volumen con NUM_BARS fijo (últimas N barras)
  const fixedVolumeChartData = useMemo(() => {
    const out = new Array(NUM_BARS).fill(null).map(() => ({ time: "", volume: 0 }))
    const start = Math.max(0, candles.length - NUM_BARS)
    const slice = candles.slice(start)
    const offset = NUM_BARS - slice.length
    slice.forEach((c, i) => {
      out[offset + i] = { time: formatTimeLabel(c.timestamp), volume: Number(c.volume) }
    })
    return out
  }, [candles])

  // Force chart remount when data set changes to avoid stale layout after hard refresh
  const chartKey = useMemo(() => `${proposalId ?? ''}-${selectedMarket}-${candles.length}-${candles[candles.length - 1]?.timestamp ?? ''}`, [proposalId, selectedMarket, candles])

  return (
    <div className="space-y-6">
      {/* Candlestick */}
      <Card>
        <CardHeader>
          <CardTitle>Market Candles</CardTitle>
          <CardDescription>OHLC from backend candles</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart key={`c-${chartKey}`} data={fixedCandleChartData} barCategoryGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={GREEN} />
                <XAxis dataKey="time" stroke={GREEN} tick={{ fill: GREEN, fontSize: 12 }} interval={0} />
                <YAxis stroke={GREEN} tick={{ fill: GREEN, fontSize: 12 }} domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: `1px solid ${GREEN}`,
                    borderRadius: "8px",
                  }}
                  formatter={(value: any, name: any, props: any) => {
                    const p = props?.payload
                    if (p) {
                      return [
                        `O:${p.open.toFixed(4)} H:${p.high.toFixed(4)} L:${p.low.toFixed(4)} C:${p.close.toFixed(4)}`,
                        "OHLC",
                      ]
                    }
                    return [value, name]
                  }}
                />
                <Legend wrapperStyle={{ color: GREEN }} />
                <Bar dataKey="low" stackId="wick" fill="transparent" />
                <Bar dataKey="rangeHL" stackId="wick" fill={GREEN} barSize={2} />
                <Bar dataKey="bodyBase" stackId="body" fill="transparent" />
                <Bar dataKey="body" stackId="body" barSize={16}>
                  {fixedCandleChartData.map((_, i) => (
                    <Cell key={`c-${i}`} fill={GREEN} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Volume */}
      <Card>
        <CardHeader>
          <CardTitle>Volume</CardTitle>
          <CardDescription>Executed token volume per interval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart key={`v-${chartKey}`} data={fixedVolumeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GREEN} />
                <XAxis dataKey="time" stroke={GREEN} tick={{ fill: GREEN, fontSize: 12 }} interval={0} />
                <YAxis stroke={GREEN} tick={{ fill: GREEN, fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: `1px solid ${GREEN}`,
                    borderRadius: "8px",
                  }}
                />
                <Legend wrapperStyle={{ color: GREEN }} />
                <Bar dataKey="volume" fill={GREEN} barSize={16} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Order Book / Your Orders */}
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
