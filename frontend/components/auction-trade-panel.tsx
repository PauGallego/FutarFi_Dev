"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import type { MarketOption, AuctionData } from "@/lib/types"

interface AuctionTradePanelProps {
  auctionData: AuctionData
  isFailed: boolean
}

export function AuctionTradePanel({ auctionData, isFailed }: AuctionTradePanelProps) {
  const { isConnected } = useAccount()
  const [selectedMarket, setSelectedMarket] = useState<MarketOption>("YES")
  const [amount, setAmount] = useState("")

  const currentPrice = selectedMarket === "YES" ? auctionData.yesCurrentPrice : auctionData.noCurrentPrice
  const estimatedTokens = amount ? (Number.parseFloat(amount) / currentPrice).toFixed(4) : "0.00"
  const slippage = amount ? ((Number.parseFloat(amount) * 0.001) / currentPrice).toFixed(4) : "0.00"

  const handleBid = () => {
    if (!amount) return
    toast.success("Bid placed!", { description: `${amount} USDC for ${estimatedTokens} ${selectedMarket} tokens` })
    setAmount("")
  }

  const handleClaim = () => {
    toast.success("Collateral claimed!", { description: "Your tokens have been returned" })
  }

  if (isFailed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-destructive">Auction Failed</CardTitle>
          <CardDescription>Minimum bid requirement not met</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={handleClaim} disabled={!isConnected}>
            Claim Collateral
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Market Selector */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Select Token</Label>
        <div className="relative p-1 rounded-full bg-muted border-2 border-border">
          <div
            className={`
              absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full
              transition-all duration-300 ease-out
              ${selectedMarket === "YES" ? "left-1 bg-primary" : "left-[calc(50%+3px)] bg-destructive"}
            `}
          />
          <button
            onClick={() => setSelectedMarket("YES")}
            className={`
              relative z-10 w-1/2 px-6 py-3 rounded-full font-semibold text-sm
              transition-colors duration-300
              ${selectedMarket === "YES" ? "text-black" : "text-muted-foreground hover:text-foreground"}
            `}
          >
            YES
          </button>
          <button
            onClick={() => setSelectedMarket("NO")}
            className={`
              relative z-10 w-1/2 px-6 py-3 rounded-full font-semibold text-sm
              transition-colors duration-300
              ${selectedMarket === "NO" ? "text-black" : "text-muted-foreground hover:text-foreground"}
            `}
          >
            NO
          </button>
        </div>
      </div>

      {/* Bid Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Place Bid</CardTitle>
          <CardDescription>Buy {selectedMarket} tokens at current auction price</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (USDC)</Label>
            <Input
              id="amount"
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={!isConnected}
            />
          </div>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Price:</span>
              <span className="font-mono">${currentPrice.toFixed(4)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Tokens:</span>
              <span className="font-mono">{estimatedTokens}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slippage:</span>
              <span className="font-mono text-yellow-500">~{slippage}</span>
            </div>
          </div>

          <Button className="w-full" onClick={handleBid} disabled={!isConnected || !amount}>
            Place Bid
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
