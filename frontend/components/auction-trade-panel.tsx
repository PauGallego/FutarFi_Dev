"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import type { MarketOption, AuctionData } from "@/lib/types"
import { useAuctionBuy } from "@/hooks/use-auction-buy"

interface AuctionTradePanelProps {
  auctionData: AuctionData
  isFailed: boolean
  proposalAddress: `0x${string}`
}

export function AuctionTradePanel({ auctionData, isFailed, proposalAddress }: AuctionTradePanelProps) {
  const { isConnected, address } = useAccount()
  const [selectedMarket, setSelectedMarket] = useState<MarketOption>("YES")
  const { amount, setAmount, approveAndBuy, isApproving, isBuying, error, remaining, userTokenBalance, onchainPrice, pyusdBalance } =
    useAuctionBuy({ proposalAddress, side: selectedMarket })

  const currentPrice = useMemo(() => {
    if (onchainPrice && onchainPrice > 0n) return Number(onchainPrice) / 1_000_000 // to USDC
    return selectedMarket === "YES" ? auctionData.yesCurrentPrice : auctionData.noCurrentPrice
  }, [onchainPrice, selectedMarket, auctionData])
  const estimatedTokens = amount ? (Number.parseFloat(amount) / currentPrice).toFixed(4) : "0.00"

  const canBuy = isConnected && !!amount && !isApproving && !isBuying && !!proposalAddress
  const handleBid = async () => {
    if (!canBuy) return
    try {
      await approveAndBuy()
      toast.success("Bid placed!", { description: `${amount} USDC for ${estimatedTokens} ${selectedMarket} tokens` })
      setAmount("")
    } catch (e: any) {
      toast.error("Bid failed", { description: error || e?.message })
    }
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
      <Card>
        <CardHeader className="space-y-3">
          {/* Market Selector – full width top, no borders between (match MarketTradePanel) */}
          <div className="relative -mx-6 -mt-6 rounded-t-md bg-muted overflow-hidden">
            <div
              className={`absolute inset-y-0 w-1/2 transition-all duration-300 ease-out ${
                selectedMarket === "YES" ? "left-0 bg-primary" : "left-1/2 bg-destructive"
              }`}
            />
            <div className="relative z-10 flex w-full">
              <button
                onClick={() => setSelectedMarket("YES")}
                className={`${
                  selectedMarket === "YES" ? "text-black" : "text-muted-foreground hover:text-foreground"
                } w-1/2 py-3 font-semibold text-sm text-center`}
              >
                YES Market
              </button>
              <button
                onClick={() => setSelectedMarket("NO")}
                className={`${
                  selectedMarket === "NO" ? "text-black" : "text-muted-foreground hover:text-foreground"
                } w-1/2 py-3 font-semibold text-sm text-center`}
              >
                NO Market
              </button>
            </div>
          </div>

          <div>
            <CardTitle className="text-lg">Place Bid</CardTitle>
            <CardDescription>Buy {selectedMarket} tokens at current auction price</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="amount">Amount (PyUSD)</Label>
              <span className="text-xs text-muted-foreground">Balance: {(Number(pyusdBalance) / 1e6).toLocaleString(undefined, { maximumFractionDigits: 6 })} PyUSD</span>
            </div>
            <div className="relative">
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!isConnected || isApproving || isBuying}
                className="pr-14"
              />
              <button
                type="button"
                onClick={() => setAmount((Number(pyusdBalance) / 1e6).toString())}
                className="absolute inset-y-0 right-2 my-auto px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                disabled={!isConnected || isApproving || isBuying}
              >
                MAX
              </button>
            </div>
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
              <span className="text-muted-foreground">Your {selectedMarket} Balance:</span>
              <span className="font-mono">{Number(userTokenBalance) / 1e18}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining Mintable:</span>
              <span className="font-mono">{Number(remaining) / 1e18}</span>
            </div>
          </div>

          <Button className="w-full" onClick={handleBid} disabled={!canBuy}>
            {isApproving ? "Approving..." : isBuying ? "Buying..." : "Place Bid"}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
