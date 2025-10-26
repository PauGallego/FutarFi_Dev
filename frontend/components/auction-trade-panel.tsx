"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/stateful-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAccount } from "wagmi"
import { toast } from "sonner"
import type { MarketOption, AuctionData } from "@/lib/types"
import { useAuctionBuy } from "@/hooks/use-auction-buy"
import { formatUnits } from "viem"
import { parseUnits } from "viem"
import { cn } from "@/lib/utils"
import { useRef } from "react"

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
  const amountInputRef = useRef<HTMLInputElement | null>(null)
  const [amountError, setAmountError] = useState<string | null>(null)

  // Oracle price is scaled to 6 decimals (PyUSD, 6d)
  const currentPrice = useMemo(() => {
    if (onchainPrice && onchainPrice > 0n) return Number(onchainPrice) / 1_000_000
    return selectedMarket === "YES" ? auctionData.yesCurrentPrice : auctionData.noCurrentPrice
  }, [onchainPrice, selectedMarket, auctionData])
  const estimatedTokens = amount ? (Number.parseFloat(amount) / currentPrice).toFixed(2) : "0.00"

  // Guard: entered PyUSD amount (6d) must not exceed user's PyUSD balance
  const amount6d = useMemo(() => {
    try { return parseUnits(amount || "0", 6) } catch { return 0n }
  }, [amount])
  const insufficientBalance = amount6d > (pyusdBalance ?? 0n)
  const invalidAmount = amount6d <= 0n

  const isDisabled = !isConnected || !amount || invalidAmount || isApproving || isBuying || !proposalAddress || insufficientBalance
  const handleBid = async (): Promise<boolean> => {
    if (isDisabled) return false
    try {
      await approveAndBuy()
      toast.success("Liquidity added!", { description: `${amount} PyUSD for ${estimatedTokens} ${selectedMarket} tokens` })
      setAmount("")
      return true
    } catch (e: any) {
      toast.error("Liquidity failed", { description: error || e?.message })
      return false
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
          <Button className="w-full" onClick={async ()=>{ handleClaim() ; return true }} aria-disabled={!isConnected}>
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
            <CardTitle className="text-lg">Add Liquidity</CardTitle>
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
                onChange={(e) => { setAmount(e.target.value); if (amountError) setAmountError(null) }}
                disabled={!isConnected || isApproving || isBuying}
                className="pr-14 no-spin"
                ref={amountInputRef}
              />
              {amountError && (
                <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">{amountError}</div>
              )}
              <button
                type="button"
                onClick={() => setAmount(formatUnits(pyusdBalance as bigint, 6))}
                className="absolute inset-y-0 right-2 my-auto px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                disabled={!isConnected || isApproving || isBuying}
              >
                MAX
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Price (PyUSD, 6d):</span>
              <span className="font-mono">${currentPrice.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estimated Tokens:</span>
              <span className="font-mono">{Number(estimatedTokens).toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your t{selectedMarket} Balance:</span>
              <span className="font-mono">{(Number((userTokenBalance) ?? 0n) / 1e18).toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining Mintable:</span>
              <span className="font-mono">{(Number(remaining) / 1e18).toFixed(6)}</span>
            </div>
          </div>

          {insufficientBalance && (
            <div className="text-xs text-destructive">Insufficient PyUSD balance for this amount.</div>
          )}

          {(() => {
            const variantEnabled = selectedMarket === "YES"
              ? "bg-primary text-primary-foreground hover:bg-primary/90"
              : "bg-destructive text-destructive-foreground hover:bg-destructive/90";
            const variantDisabled = "bg-muted text-muted-foreground border border-border";
            return (
              <Button
                onClick={handleBid}
                aria-disabled={isDisabled}
                onDisabledClick={() => {
                  // Ignore clicks during approval/buy pending states
                  if (isApproving || isBuying) return
                  if (!amount || invalidAmount) {
                    amountInputRef.current?.focus()
                    setAmountError("Please enter a valid amount.")
                  }
                }}
                className={cn(
                  "w-full inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 h-10 px-4 py-2",
                  isDisabled
                    ? cn(variantDisabled, "opacity-60 cursor-not-allowed hover:ring-0 focus-visible:ring-0", (isApproving || isBuying) && "pointer-events-none")
                    : cn(variantEnabled, selectedMarket === "YES" ? "hover:ring-green-500" : "hover:ring-red-500"),
                )}
              >
                {isApproving ? "Approving..." : isBuying ? "Buying..." : "Buy Liquidity"}
              </Button>
            )
          })()}
        </CardContent>
      </Card>
    </div>
  )
}
