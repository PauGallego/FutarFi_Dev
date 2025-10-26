"use client"
import React, { useEffect, useRef } from "react"
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
    // YES (approve) in green, NO (reject) in red
    const yesSeries = (chart as any).addSeries
      ? (chart as any).addSeries(LineSeries, {
          color: '#16a34a',
          lineWidth: 2,
        })
      : (chart as any).addLineSeries({
          color: '#16a34a',
          lineWidth: 2,
        })
    const noSeries = (chart as any).addSeries
      ? (chart as any).addSeries(LineSeries, {
          color: '#ef4444',
          lineWidth: 2,
        })
      : (chart as any).addLineSeries({
          color: '#ef4444',
          lineWidth: 2,
        })

    // Ensure container has enough vertical space
    container.style.height = '420px'

    // Initial fetch + realtime polling from backend (both markets)
    const controller = new AbortController()
    const interval = '1m'
    const limit = 300
    let lastYesSec = 0
    let lastNoSec = 0

    const mapLine = (candles: any[]): LinePoint[] =>
      candles.map((c: any) => ({
        time: toSecs(c.timestamp),
        value: Number(c.close ?? c.open ?? 0),
      }))

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
        if (yes.length > 0) {
          yesSeries.setData(yes)
          lastYesSec = yes[yes.length - 1].time
        }
        if (no.length > 0) {
          noSeries.setData(no)
          lastNoSec = no[no.length - 1].time
        }
        chart.timeScale().fitContent()
        chart.timeScale().scrollToPosition(5, true)
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
        if (yes.length > 0) {
          const newYes = yes.filter(p => p.time > lastYesSec)
          if (newYes.length > 0) {
            for (const p of newYes) { yesSeries.update(p); lastYesSec = p.time }
          } else {
            const last = yes[yes.length - 1]
            if (last && last.time === lastYesSec) yesSeries.update(last)
          }
        }
        if (no.length > 0) {
          const newNo = no.filter(p => p.time > lastNoSec)
          if (newNo.length > 0) {
            for (const p of newNo) { noSeries.update(p); lastNoSec = p.time }
          } else {
            const last = no[no.length - 1]
            if (last && last.time === lastNoSec) noSeries.update(last)
          }
        }
        try { chart.timeScale().scrollToRealTime?.() } catch {}
      } catch (_) { /* ignore */ }
    }

    void loadInitial()
    const intervalID = window.setInterval(() => { void poll() }, 5000)

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
  }, [proposalId])

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
