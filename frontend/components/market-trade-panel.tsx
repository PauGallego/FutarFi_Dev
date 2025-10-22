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
import type { OrderType, TradeAction } from "@/lib/types"

type MarketTradePanelProps = {}

export function MarketTradePanel({}: MarketTradePanelProps) {
  const { isConnected } = useAccount()
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

  const handleCreateOrder = () => {
    if (!amount) return
    const orderDetails =
      orderType === "market"
        ? `${tradeAction} ${amount} tokens at market price`
        : `${tradeAction} ${amount} tokens @ $${limitPrice}`

    toast.success("Order created!", { description: orderDetails })
    setAmount("")
    setLimitPrice("")
  }

  return (
    <div className="space-y-4">
      {/* Order Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Create Order</CardTitle>
          <CardDescription>Place market or limit orders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Action</Label>
            <div className="relative p-1 rounded-full bg-muted border-2 border-border">
              <div
                className={`
                  absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full
                  transition-all duration-300 ease-out
                  ${tradeAction === "BUY" ? "left-1 bg-primary" : "left-[calc(50%+3px)] bg-destructive"}
                `}
              />
              <button
                onClick={() => setTradeAction("BUY")}
                className={`
                  relative z-10 w-1/2 px-6 py-3 rounded-full font-semibold text-sm
                  transition-colors duration-300
                  ${tradeAction === "BUY" ? "text-black" : "text-muted-foreground hover:text-foreground"}
                `}
              >
                BUY
              </button>
              <button
                onClick={() => setTradeAction("SELL")}
                className={`
                  relative z-10 w-1/2 px-6 py-3 rounded-full font-semibold text-sm
                  transition-colors duration-300
                  ${tradeAction === "SELL" ? "text-black" : "text-muted-foreground hover:text-foreground"}
                `}
              >
                SELL
              </button>
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
              disabled={!isConnected}
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
                disabled={!isConnected}
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
                disabled={!isConnected}
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
            disabled={!isConnected || !amount || (orderType === "limit" && !limitPrice)}
          >
            {tradeAction} {orderType === "market" ? "at Market" : "with Limit"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
