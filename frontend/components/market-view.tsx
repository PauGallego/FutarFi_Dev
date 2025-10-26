"use client"
import React, { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MarketDepthAndOrders } from "@/components/market-depth-orders"
import type { MarketData, MarketOption, OrderBookEntry, UserOrder } from "@/lib/types"
import { createChart, LineSeries } from "lightweight-charts"
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'
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

// Helper to map backend candle to lightweight-charts format
type LinePoint = { time: number; value: number }
const toSecs = (ts: string) => Math.floor(new Date(ts).getTime() / 1000)

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
  const [interval, setInterval] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('1m')
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
      timeScale: {
        rightOffset: 0,
        shiftVisibleRangeOnNewBar: true,
      },
      height: 420,
    } as const

    const chart = createChart(container, chartOptions as any)
    // YES (approve) in green, NO (reject) in red
    const yesSeries = (chart as any).addSeries
      ? (chart as any).addSeries(LineSeries, {
          color: '#16a34a',
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: true,
          title: 'tYES',
        })
      : (chart as any).addLineSeries({
          color: '#16a34a',
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: true,
          title: 'tYES',
        })
    const noSeries = (chart as any).addSeries
      ? (chart as any).addSeries(LineSeries, {
          color: '#ef4444',
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: true,
          title: 'tNO',
        })
      : (chart as any).addLineSeries({
          color: '#ef4444',
          lineWidth: 2,
          lastValueVisible: true,
          priceLineVisible: true,
          title: 'tNO',
        })

    // Ensure container has enough vertical space
    container.style.height = '420px'

    // Initial fetch + realtime polling from backend (both markets)
    const controller = new AbortController()
  const limit = 300

    const mapLine = (candles: any[]): LinePoint[] =>
      candles.map((c: any) => ({
        time: toSecs(c.timestamp),
        value: Number(c.close ?? c.open ?? 0),
      }))

    // Build union time grid and carry forward last value so both lines extend to the latest time
    const padLines = (yes: LinePoint[], no: LinePoint[]): { yes: LinePoint[]; no: LinePoint[] } => {
      const timesSet = new Set<number>()
      for (const p of yes) timesSet.add(p.time)
      for (const p of no) timesSet.add(p.time)
      const times = Array.from(timesSet).sort((a, b) => a - b)

      const yesByTime = new Map(yes.map(p => [p.time, p.value]))
      const noByTime = new Map(no.map(p => [p.time, p.value]))

      const firstYes = yes.length > 0 ? yes[0].time : undefined
      const firstNo = no.length > 0 ? no[0].time : undefined

      const outYes: LinePoint[] = []
      const outNo: LinePoint[] = []
      let lastYes: number | undefined = undefined
      let lastNo: number | undefined = undefined

      for (const t of times) {
        const y = yesByTime.get(t)
        const n = noByTime.get(t)
        if (y !== undefined) lastYes = y
        if (n !== undefined) lastNo = n

        // Only start output after the first known value exists for each series
        if (firstYes !== undefined && t >= firstYes && lastYes !== undefined) outYes.push({ time: t, value: lastYes })
        if (firstNo !== undefined && t >= firstNo && lastNo !== undefined) outNo.push({ time: t, value: lastNo })
      }
      return { yes: outYes, no: outNo }
    }

    const loadInitial = async () => {
      if (!proposalId) return
      try {
        const [resYes, resNo] = await Promise.all([
          fetch(`${API_BASE}/orderbooks/${proposalId}/yes/candles?interval=${interval}&limit=${limit}`, { signal: controller.signal }),
          fetch(`${API_BASE}/orderbooks/${proposalId}/no/candles?interval=${interval}&limit=${limit}`, { signal: controller.signal }),
        ])
        const [jsonYes, jsonNo] = await Promise.all([
          resYes.ok ? resYes.json().catch(() => null) : null,
          resNo.ok ? resNo.json().catch(() => null) : null,
        ])
        const yes = Array.isArray(jsonYes?.candles) ? mapLine(jsonYes.candles) : []
        const no = Array.isArray(jsonNo?.candles) ? mapLine(jsonNo.candles) : []
        const padded = padLines(yes, no)
        yesSeries.setData(padded.yes)
        noSeries.setData(padded.no)
  chart.timeScale().fitContent()
  try { chart.timeScale().scrollToRealTime?.() } catch {}
      } catch (_) { /* ignore */ }
    }

    const poll = async () => {
      if (!proposalId) return
      try {
        const [resYes, resNo] = await Promise.all([
          fetch(`${API_BASE}/orderbooks/${proposalId}/yes/candles?interval=${interval}&limit=${limit}`, { signal: controller.signal }),
          fetch(`${API_BASE}/orderbooks/${proposalId}/no/candles?interval=${interval}&limit=${limit}`, { signal: controller.signal }),
        ])
        const [jsonYes, jsonNo] = await Promise.all([
          resYes.ok ? resYes.json().catch(() => null) : null,
          resNo.ok ? resNo.json().catch(() => null) : null,
        ])
        const yes = Array.isArray(jsonYes?.candles) ? mapLine(jsonYes.candles) : []
        const no = Array.isArray(jsonNo?.candles) ? mapLine(jsonNo.candles) : []
        const padded = padLines(yes, no)
        yesSeries.setData(padded.yes)
        noSeries.setData(padded.no)
        try { chart.timeScale().scrollToRealTime?.() } catch {}
      } catch (_) { /* ignore */ }
    }

    void loadInitial()
    const pollMsMap: Record<typeof interval, number> = {
      '1m': 5000,
      '5m': 15000,
      '15m': 30000,
      '1h': 60000,
      '4h': 120000,
      '1d': 300000,
    }
    const pollEvery = pollMsMap[interval] ?? 10000
    const intervalID = window.setInterval(() => { void poll() }, pollEvery)

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

    const onResize = () => {
      chart.applyOptions({ height: 420 })
    }
    window.addEventListener('resize', onResize)

    return () => {
      clearInterval(intervalID)
      controller.abort()
      window.removeEventListener('resize', onResize)
      mo.disconnect()
      chart.remove()
    }
  }, [proposalId, interval])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between pb-2">
            <div className="text-sm text-slate-400">Timeframe</div>
            <div className="flex gap-2">
              {(['1m','5m','15m','1h','4h','1d'] as const).map((iv) => (
                <button
                  key={iv}
                  onClick={() => setInterval(iv)}
                  className={`px-2 py-1 rounded text-sm border transition-colors ${interval === iv ? 'bg-slate-700 text-white border-slate-600' : 'bg-transparent text-slate-300 border-slate-600 hover:bg-slate-800'}`}
                >
                  {iv}
                </button>
              ))}
            </div>
          </div>
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
