"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import type { OrderType, TradeAction, MarketOption } from "@/lib/types"
import { useCreateOrder } from "@/hooks/use-create-order"

type MarketTradePanelProps = {
  selectedMarket: MarketOption
  onMarketChange: (market: MarketOption) => void
  proposalId: string
  onOrderPlaced?: () => void
}

export function MarketTradePanel({ selectedMarket, onMarketChange, proposalId, onOrderPlaced }: MarketTradePanelProps) {
  const { isConnected } = useAccount()
  const { createOrder, isLoading: creating, error: createError } = useCreateOrder()

  const [orderType, setOrderType] = useState<OrderType>("market")
  const [tradeAction, setTradeAction] = useState<TradeAction>("BUY")
  const [amount, setAmount] = useState("")
  const [limitPrice, setLimitPrice] = useState("")
  const [slippage, setSlippage] = useState([0.5])

  // Mock calculations
  const estimatedPrice = orderType === "market" ? 0.52 : Number.parseFloat(limitPrice) || 0
  const estimatedAmount = amount ? Number.parseFloat(amount) : 0
  const estimatedTotal = estimatedPrice * estimatedAmount
  const estimatedSlippage = orderType === "market" ? (estimatedTotal * slippage[0]) / 100 : 0
  const finalTotal = estimatedTotal + estimatedSlippage

  const handleCreateOrder = async () => {
    if (!amount) return

    const side: 'approve' | 'reject' = selectedMarket === "YES" ? 'approve' : 'reject'
    const payload = {
      proposalId,
      side,
      orderType: tradeAction === "BUY" ? ("buy" as const) : ("sell" as const),
      orderExecution: orderType,
      price: orderType === "market" ? 0 : Number(limitPrice || 0),
      amount: Number(amount || 0),
    }

    const out = await createOrder(payload)
    if (!out) {
      if (createError) toast.error("Order failed", { description: createError })
      return
    }

    if (out.ok) {
      toast.success("Order created!", { description: `${tradeAction} ${amount}${orderType === "limit" ? ` @ $${limitPrice}` : " at market"}` })
      setAmount("")
      setLimitPrice("")
      onOrderPlaced?.()
    } else {
      toast.error("Order failed", { description: out.data?.error || `Status ${out.status}` })
    }
  }

  return (
    <div className="space-y-4">
      {/* Order Form */}
      <Card>
        <CardHeader className="space-y-3">
          {/* Market Selector – full width top, no borders between */}
          <div className="relative -mx-6 -mt-6 rounded-t-md bg-muted overflow-hidden">
            <div
              className={`absolute inset-y-0 w-1/2 transition-all duration-300 ease-out ${
                selectedMarket === "YES" ? "left-0 bg-primary" : "left-1/2 bg-destructive"
              }`}
            />
            <div className="relative z-10 flex w-full">
              <button
                onClick={() => onMarketChange("YES")}
                className={`${
                  selectedMarket === "YES" ? "text-black" : "text-muted-foreground hover:text-foreground"
                } w-1/2 py-3 font-semibold text-sm text-center`}
              >
                YES Market
              </button>
              <button
                onClick={() => onMarketChange("NO")}
                className={`${
                  selectedMarket === "NO" ? "text-black" : "text-muted-foreground hover:text-foreground"
                } w-1/2 py-3 font-semibold text-sm text-center`}
              >
                NO Market
              </button>
            </div>
          </div>

          <div>
            <CardTitle className="text-lg">Create Order</CardTitle>
            <CardDescription>Place market or limit orders</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Action</Label>
            <div className="relative rounded-md bg-muted overflow-hidden">
              <div
                className={`absolute inset-y-0 w-1/2 transition-all duration-300 ease-out ${
                  tradeAction === "BUY" ? "left-0 bg-primary" : "left-1/2 bg-destructive"
                }`}
              />
              <div className="relative z-10 flex w-full">
                <button
                  onClick={() => setTradeAction("BUY")}
                  className={`${
                    tradeAction === "BUY" ? "text-black" : "text-muted-foreground hover:text-foreground"
                  } w-1/2 py-2 font-semibold text-sm text-center`}
                >
                  BUY
                </button>
                <button
                  onClick={() => setTradeAction("SELL")}
                  className={`${
                    tradeAction === "SELL" ? "text-black" : "text-muted-foreground hover:text-foreground"
                  } w-1/2 py-2 font-semibold text-sm text-center`}
                >
                  SELL
                </button>
              </div>
            </div>
          </div>

          <Tabs value={orderType} onValueChange={(v) => setOrderType(v as OrderType)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="market">Market</TabsTrigger>
              <TabsTrigger value="limit">Limit</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!isConnected || creating}
            />
          </div>

          {orderType === "limit" && (
            <div className="space-y-2">
              <Label htmlFor="price">Limit Price</Label>
              <Input
                id="price"
                type="number"
                placeholder="0.00"
                value={limitPrice}
                onChange={(e) => setLimitPrice(e.target.value)}
                disabled={!isConnected || creating}
              />
            </div>
          )}

          {orderType === "market" && (
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="slippage">Slippage Tolerance</Label>
                <span className="text-sm text-muted-foreground">{slippage[0]}%</span>
              </div>
              <Slider
                id="slippage"
                min={0.1}
                max={5}
                step={0.1}
                value={slippage}
                onValueChange={setSlippage}
                disabled={!isConnected || creating}
              />
            </div>
          )}

          <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Order Type:</span>
              <span className="font-mono capitalize">{orderType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Est. Price:</span>
              <span className="font-mono">${estimatedPrice.toFixed(4)}</span>
            </div>
            {orderType === "market" && (
              <>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slippage:</span>
                  <span className="font-mono text-yellow-500">${estimatedSlippage.toFixed(4)}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>You {tradeAction === "BUY" ? "Pay" : "Receive"}:</span>
                  <span className="font-mono">${finalTotal.toFixed(4)}</span>
                </div>
              </>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleCreateOrder}
            disabled={!isConnected || creating || !amount || (orderType === "limit" && !limitPrice)}
          >
            {creating ? "Creating..." : `${tradeAction} ${orderType === "market" ? "at Market" : "with Limit"}`}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
