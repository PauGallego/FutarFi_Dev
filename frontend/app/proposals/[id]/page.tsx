"use client"

import React, { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { ProposalHeader } from "@/components/proposal-header"
import { AuctionView } from "@/components/auction-view"
import { MarketView } from "@/components/market-view"
import { AuctionTradePanel } from "@/components/auction-trade-panel"
import { MarketTradePanel } from "@/components/market-trade-panel"
import { useChainId } from "wagmi"
import type { Proposal, UserOrder, MarketOption, UserBalance } from "@/lib/types"
import { useGetProposalById } from "@/hooks/use-get-proposalById"

interface PageProps {
  params: {id: string}
}


function generateMockOrders(): UserOrder[] {
  return [
    {
      id: "1",
      market: "YES",
      type: "limit",
      side: "BUY",
      price: 0.52,
      amount: 100,
      filled: 50,
      status: "pending",
      timestamp: Date.now() - 3600000,
    },
    {
      id: "2",
      market: "YES",
      type: "market",
      side: "SELL",
      price: 0.55,
      amount: 50,
      filled: 50,
      status: "filled",
      timestamp: Date.now() - 7200000,
    },
  ]
}

function generateMockUserBalance(): UserBalance {
  return {
    yesTokens: BigInt(1500000000000000000), // 1.5 tokens
    noTokens: BigInt(2300000000000000000), // 2.3 tokens
    collateral: BigInt(10000000), // 10 USDC
  }
}

export default function ProposalDetailPage({ params }: PageProps) {
  const { id } = params

  const chainId = useChainId()

  const { proposal: hookProposal, isLoading: hookLoading, error: hookError } = useGetProposalById(id)

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [userOrders, setUserOrders] = useState<UserOrder[]>([])
  const [userBalance, setUserBalance] = useState<UserBalance | null>(null)
  const [selectedMarket, setSelectedMarket] = useState<MarketOption>("YES")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {

    if (!hookProposal) {
      setProposal(null)
      setError(hookError ? String(hookError) : null)
      setIsLoading(hookLoading)
      return
    }

    const zero = '0x0000000000000000000000000000000000000000'
    const mapped: Proposal = {
      id: hookProposal.id,
      admin: hookProposal.admin || zero,
      title: hookProposal.title || '',
      description: hookProposal.description || '',

      // state already matches the frontend `Proposal.state` union from the hook
      state: (hookProposal.state as 'Auction' | 'Live' | 'Resolved' | 'Cancelled') || 'Auction',

      // Auction / live times (seconds)
      auctionStartTime: Number(hookProposal.auctionStartTime || 0),
      auctionEndTime: Number(hookProposal.auctionEndTime || 0),
      liveStart: Number(hookProposal.liveStart || hookProposal.auctionEndTime || 0),
      liveEnd: Number(hookProposal.liveEnd || hookProposal.auctionEndTime || 0),
      liveDuration: Number(hookProposal.liveDuration || 0),

      // Token / treasury / auctions (use zero-address fallbacks)
      subjectToken: (hookProposal.subjectToken as `0x${string}`) || zero,
      pyUSD: (hookProposal.pyUSD as `0x${string}`) || zero,
      minToOpen: hookProposal.minToOpen ? String(hookProposal.minToOpen) : '0',
      maxCap: hookProposal.maxCap ? String(hookProposal.maxCap) : '0',
      yesAuction: (hookProposal.yesAuction as `0x${string}`) || zero,
      noAuction: (hookProposal.noAuction as `0x${string}`) || zero,
      yesToken: (hookProposal.yesToken as `0x${string}`) || zero,
      noToken: (hookProposal.noToken as `0x${string}`) || zero,
      treasury: (hookProposal.treasury as `0x${string}`) || zero,

      // Execution target and calldata
      target: (hookProposal.target as `0x${string}`) || zero,
      data: hookProposal.data || '0x',

      // Proposal contract instance address
      address: (hookProposal.address as `0x${string}`) || zero,
    }


    setProposal(mapped)
    setError(null)
    setIsLoading(hookLoading)

    setUserOrders(generateMockOrders())
    setUserBalance(generateMockUserBalance())

  }, [hookProposal, hookLoading, hookError])

  const handleCancelOrder = (orderId: string) => {
    setUserOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: "cancelled" as const } : o)))
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !proposal) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error || "Proposal not found"}</AlertDescription>
        </Alert>
        <Button asChild className="mt-4">
          <Link href="/proposals">Back to Proposals</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Left/Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <ProposalHeader proposal={proposal} chainId={chainId} />

          {(((proposal as any).status === "Auction" || (proposal as any).status === "Canceled") && (proposal as any).auctionData && userBalance) ? (
            <AuctionView auctionData={(proposal as any).auctionData} userBalance={userBalance} />
          ) : (
            (proposal as any).marketData && (
              <MarketView
                marketData={(proposal as any).marketData}
                userOrders={userOrders}
                selectedMarket={selectedMarket}
                onMarketChange={setSelectedMarket}
                onCancelOrder={handleCancelOrder}
              />
            )
          )}
        </div>

        {/* Right Sidebar */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          {(((proposal as any).status === "Auction" || (proposal as any).status === "Canceled") && (proposal as any).auctionData) ? (
            <AuctionTradePanel auctionData={(proposal as any).auctionData} isFailed={(proposal as any).status === "Canceled"} />
          ) : (
            <MarketTradePanel />
          )}
        </div>
      </div>
    </div>
  )
}
