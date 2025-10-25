"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, TrendingUp, Coins } from "lucide-react"
import type { MarketOption } from "@/lib/types"
import { useAccount, useReadContract } from "wagmi"
import { useCallback, useMemo } from "react"
import { toast } from "sonner"
import { proposal_abi } from "@/contracts/proposal-abi"
import { marketToken_abi } from "@/contracts/marketToken-abi"
import { treasury_abi } from "@/contracts/treasury-abi"
import { ethers } from "ethers"

interface AuctionResolvedProps {
  winningMarket: MarketOption
  finalYesPrice: number
  finalNoPrice: number
  totalVolume: number
  userYesTokens: number
  userNoTokens: number
  onClaimWinnings: () => void
  onClaimLosingTokens: () => void
}

export function AuctionResolved({
  winningMarket,
  finalYesPrice,
  finalNoPrice,
  totalVolume,
  userYesTokens,
  userNoTokens,
  onClaimWinnings,
  onClaimLosingTokens,
}: AuctionResolvedProps) {
  const losingMarket = winningMarket === "YES" ? "NO" : "YES"
  const winningPrice = winningMarket === "YES" ? finalYesPrice : finalNoPrice
  const losingPrice = winningMarket === "YES" ? finalNoPrice : finalYesPrice
  const userWinningTokens = winningMarket === "YES" ? userYesTokens : userNoTokens
  const userLosingTokens = winningMarket === "YES" ? userNoTokens : userYesTokens
  const outcomeLabel = winningMarket === "YES" ? "Approved" : "Rejected"
  const priceDiff = Math.abs(finalYesPrice - finalNoPrice)

  return (
    <div className="space-y-6">
      {/* Final Results Header */}
      <Card className="border-green-500/50 bg-green-500/5 shadow-lg">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="rounded-full bg-green-500/20 p-4">
              <CheckCircle2 className="h-12 w-12 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <CardTitle className="text-3xl font-bold text-green-600 dark:text-green-400">Auction Resolved</CardTitle>
          <CardDescription className="text-lg mt-2">
            The market has been settled and final results are available
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Winning Market */}
      <Card className="border-green-500/50 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div>
                <CardTitle className="text-2xl">Winning Market</CardTitle>
                <CardDescription>Final settlement details</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-600 text-white text-lg px-4 py-2 hover:bg-green-700">{outcomeLabel}</Badge>
              <Badge variant="outline" className="text-sm px-3 py-1">{winningMarket}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Final Price</p>
              <p className="text-3xl font-bold text-green-600 dark:text-green-400">${winningPrice.toFixed(4)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Total Volume</p>
              <p className="text-3xl font-bold text-foreground">${totalVolume.toLocaleString()}</p>
            </div>
          </div>

          {/* Price difference between Approved (YES) and Rejected (NO) */}
          <div className="rounded-md border bg-muted/40 p-3">
            <p className="text-sm text-muted-foreground">Price Difference (YES - NO)</p>
            <p className="text-xl font-semibold">${priceDiff.toFixed(4)}</p>
          </div>

          {userWinningTokens > 0 && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Your Winning Tokens</p>
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {userWinningTokens.toFixed(2)} {winningMarket}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Value: ${(userWinningTokens * winningPrice).toFixed(2)}
                  </p>
                </div>
                <Coins className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <Button
                onClick={onClaimWinnings}
                className="w-full bg-green-600 hover:bg-green-700 text-white text-lg py-6"
                size="lg"
              >
                <CheckCircle2 className="mr-2 h-5 w-5" />
                Claim Options
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Losing Market */}
      <Card className="border-border/50 shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl">Losing Market</CardTitle>
              <CardDescription>Reclaim your tokens from the losing side</CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-4 py-2">
              {losingMarket}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Final Price</p>
              <p className="text-2xl font-semibold text-muted-foreground">${losingPrice.toFixed(4)}</p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Market Status</p>
              <Badge variant="secondary" className="text-base">
                Settled
              </Badge>
            </div>
          </div>

          {userLosingTokens > 0 && (
            <div className="pt-4 border-t border-border">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground">Your Tokens</p>
                  <p className="text-xl font-semibold text-foreground">
                    {userLosingTokens.toFixed(2)} {losingMarket}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">These tokens can be reclaimed</p>
                </div>
                <Coins className="h-6 w-6 text-muted-foreground" />
              </div>
              <Button
                onClick={onClaimLosingTokens}
                variant="outline"
                className="w-full text-base py-5 bg-transparent"
                size="lg"
              >
                <Coins className="mr-2 h-4 w-4" />
                Claim Losing Market Tokens
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Stats */}
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Market Summary</CardTitle>
          <CardDescription>Final statistics for this prediction market</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">YES Final Price</p>
              <p className="text-xl font-semibold">${finalYesPrice.toFixed(4)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">NO Final Price</p>
              <p className="text-xl font-semibold">${finalNoPrice.toFixed(4)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Price Difference (YES - NO)</p>
              <p className="text-xl font-semibold">${priceDiff.toFixed(4)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Total Volume</p>
              <p className="text-xl font-semibold">${totalVolume.toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export function AuctionResolvedOnChain({ proposalAddress }: { proposalAddress: `0x${string}` }) {
  const { address: user, isConnected } = useAccount()
  const ZERO = "0x0000000000000000000000000000000000000000" as const

  // Read addresses and final TWAPs from Proposal
  const { data: yesTokenAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "yesToken" })
  const { data: noTokenAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "noToken" })
  const { data: treasuryAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "treasury" })
  const { data: twapYes } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "twapPriceTokenYes" })
  const { data: twapNo } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "twapPriceTokenNo" })

  const yesToken = yesTokenAddr as `0x${string}` | undefined
  const noToken = noTokenAddr as `0x${string}` | undefined
  const treasury = treasuryAddr as `0x${string}` | undefined

  const canReadTokens = !!yesToken && !!noToken
  const canReadTreasury = !!treasury

  // Read redeemer to detect losers
  const { data: yesRedeemer } = useReadContract({ address: yesToken!, abi: marketToken_abi, functionName: "redeemer", query: { enabled: canReadTokens } })
  const { data: noRedeemer } = useReadContract({ address: noToken!, abi: marketToken_abi, functionName: "redeemer", query: { enabled: canReadTokens } })

  // User balances
  const { data: yesBal } = useReadContract({ address: yesToken!, abi: marketToken_abi, functionName: "balanceOf", args: [user ?? ZERO], query: { enabled: canReadTokens && !!user } })
  const { data: noBal } = useReadContract({ address: noToken!, abi: marketToken_abi, functionName: "balanceOf", args: [user ?? ZERO], query: { enabled: canReadTokens && !!user } })

  // Pots and refunds flag
  const { data: potYes } = useReadContract({ address: treasury!, abi: treasury_abi, functionName: "potYes", query: { enabled: canReadTreasury } })
  const { data: potNo } = useReadContract({ address: treasury!, abi: treasury_abi, functionName: "potNo", query: { enabled: canReadTreasury } })
  const { data: refundsEnabled } = useReadContract({ address: treasury!, abi: treasury_abi, functionName: "refundsEnabled", query: { enabled: canReadTreasury } })

  const yesLost = useMemo(() => !!yesRedeemer && (yesRedeemer as string) !== ZERO, [yesRedeemer])
  const noLost = useMemo(() => !!noRedeemer && (noRedeemer as string) !== ZERO, [noRedeemer])

  const winningMarket: MarketOption = useMemo(() => {
    if (yesLost && !noLost) return "NO"
    if (noLost && !yesLost) return "YES"
    return "YES"
  }, [yesLost, noLost])

  // TWAPs are 6 decimals (same scale as PyUSD in the app)
  const finalYesPrice = Number((twapYes as bigint) ?? 0n) / 1e6
  const finalNoPrice = Number((twapNo as bigint) ?? 0n) / 1e6
  const totalVolume = (Number((potYes as bigint) ?? 0n) + Number((potNo as bigint) ?? 0n)) / 1e6
  const userYesTokens = Number((yesBal as bigint) ?? 0n) / 1e18
  const userNoTokens = Number((noBal as bigint) ?? 0n) / 1e18

  const onClaimLosingTokens = useCallback(async () => {
    if (!isConnected) {
      toast.error("Connect wallet")
      return
    }
    if (!refundsEnabled) {
      toast.error("Refunds not enabled yet")
      return
    }
    const losingToken = winningMarket === "YES" ? noToken : yesToken
    if (!losingToken) return
    try {
      const anyWindow = window as any
      if (!anyWindow?.ethereum) throw new Error("No wallet found")
      const provider = new ethers.BrowserProvider(anyWindow.ethereum)
      const signer = await provider.getSigner()
      const c = new ethers.Contract(proposalAddress, proposal_abi as any, signer)
      const tx = await c.claimTokens(losingToken)
      toast.message("Claiming...", { description: tx.hash })
      const rcpt = await tx.wait()
      if (!rcpt || (rcpt.status !== 1n && rcpt.status !== 1)) throw new Error("Transaction failed")
      toast.success("Claim successful")
    } catch (e: any) {
      toast.error("Claim failed", { description: e?.shortMessage || e?.message })
    }
  }, [isConnected, refundsEnabled, winningMarket, yesToken, noToken, proposalAddress])

  const onClaimWinnings = useCallback(() => {
    toast.info("Winner tokens remain in your wallet. No claim required.")
  }, [])

  return (
    <AuctionResolved
      winningMarket={winningMarket}
      finalYesPrice={finalYesPrice}
      finalNoPrice={finalNoPrice}
      totalVolume={totalVolume}
      userYesTokens={userYesTokens}
      userNoTokens={userNoTokens}
      onClaimWinnings={onClaimWinnings}
      onClaimLosingTokens={onClaimLosingTokens}
    />
  )
}
