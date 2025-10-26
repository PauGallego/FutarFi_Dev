"use client"
import React, { useEffect, useRef } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MarketDepthAndOrders } from "@/components/market-depth-orders"
import type { MarketData, MarketOption, OrderBookEntry, UserOrder } from "@/lib/types"
import { createChart, CandlestickSeries } from "lightweight-charts"
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

let randomFactor = 25 + Math.random() * 25
const samplePoint = (i: number): number => (
  i * (
    0.5 +
    Math.sin(i / 1) * 0.2 +
    Math.sin(i / 2) * 0.4 +
    Math.sin(i / randomFactor) * 0.8 +
    Math.sin(i / 50) * 0.5
  )
)
function generateData(numberOfCandles: number, updatesPerCandle: number, startAt: number) {
  const createCandle = (val: number, time: number) => ({
    time,
    open: val,
    high: val,
    low: val,
    close: val,
  })

  const updateCandle = (candle: any, val: number) => ({
    time: candle.time,
    close: val,
    open: candle.open,
    low: Math.min(candle.low, val),
    high: Math.max(candle.high, val),
  })
  randomFactor = 25 + Math.random() * 25
  const date = new Date(Date.UTC(2018, 0, 1, 12, 0, 0, 0))
  const numberOfPoints = numberOfCandles * updatesPerCandle
  const initialData: any[] = []
  const realtimeUpdates: any[] = []
  let lastCandle: any
  let previousValue = samplePoint(-1)

  for (let i = 0; i < numberOfPoints; ++i) {
    if (i % updatesPerCandle === 0) {
      date.setUTCDate(date.getUTCDate() + 1)
    }
    const time = date.getTime() / 1000
    let value = samplePoint(i)
    const diff = (value - previousValue) * Math.random()
    value = previousValue + diff
    previousValue = value
    if (i % updatesPerCandle === 0) {
      const candle = createCandle(value, time)
      lastCandle = candle
      if (i >= startAt) {
        realtimeUpdates.push(candle)
      }
    } else {
      const newCandle = updateCandle(lastCandle, value)
      lastCandle = newCandle
      if (i >= startAt) {
        realtimeUpdates.push(newCandle)
      } else if ((i + 1) % updatesPerCandle === 0) {
        initialData.push(newCandle)
      }
    }
  }

  return {
    initialData,
    realtimeUpdates,
  }
}

function* getNextRealtimeUpdate(realtimeData: any[]) {
  for (const dataPoint of realtimeData) {
    yield dataPoint
  }
  return null
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

  const chartContainerRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const container = chartContainerRef.current
    if (!container) return

    const chartOptions = {
      layout: {
        textColor: '#94a3b8',
        background: { type: 'solid', color: '#1a1a1a' },
      },
      grid: {
        vertLines: { color: '#444' },
        horzLines: { color: '#444' },
      },
      height: 420,
    } as const

    const chart = createChart(container, chartOptions as any)
    const series = (chart as any).addSeries
      ? (chart as any).addSeries(CandlestickSeries, {
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      })
      : (chart as any).addCandlestickSeries({
        upColor: '#26a69a',
        downColor: '#ef5350',
        borderVisible: false,
        wickUpColor: '#26a69a',
        wickDownColor: '#ef5350',
      })

    // Ensure container has enough vertical space
    container.style.height = '420px'

    const data = generateData(2500, 20, 1000)
    series.setData(data.initialData)
    chart.timeScale().fitContent()
    chart.timeScale().scrollToPosition(5, true)

    // Hide TradingView logo/link if present (lightweight-charts branding anchor)
    const hideBranding = () => {
      const links = container.querySelectorAll('a[href*="tradingview.com"]')
      links.forEach((el) => {
        ; (el as HTMLElement).style.display = 'none'
      })
    }
    hideBranding()
    const mo = new MutationObserver(() => hideBranding())
    mo.observe(container, { childList: true, subtree: true })

    const streamingDataProvider = getNextRealtimeUpdate(data.realtimeUpdates)
    const intervalID = window.setInterval(() => {
      const update = streamingDataProvider.next()
      if ((update as any).done) {
        clearInterval(intervalID)
        return
      }
      series.update((update as any).value)
    }, 100)

    const onResize = () => {
      chart.applyOptions({ height: 420 })
    }
    window.addEventListener('resize', onResize)

    return () => {
      clearInterval(intervalID)
      window.removeEventListener('resize', onResize)
      mo.disconnect()
      chart.remove()
    }
  }, [])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div id="chartContainer" ref={chartContainerRef} className="flex tv-chart-container h-[420px] w-auto" />
        </CardHeader>
      </Card>

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
