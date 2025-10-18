"use client"

import { useEffect, useState } from "react"
import { useChainId } from "wagmi"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { ProposalHeader } from "@/components/proposal-header"
import { PriceChart } from "@/components/price-chart"
import { TradePanel } from "@/components/trade-panel"
import type { Proposal, PricePoint } from "@/lib/types"
import type { Address } from "viem"
import { useGetProposalById } from "@/hooks/use-get-proposalById"

interface PageProps {
  params: { id: string }
}

function generateMockPriceData(): PricePoint[] {
  const now = Date.now()
  const data: PricePoint[] = []

  // Generate 7 days of hourly data
  for (let i = 7 * 24; i >= 0; i--) {
    const timestamp = now - i * 60 * 60 * 1000
    const yesPrice = 0.45 + Math.random() * 0.15 + (i / (7 * 24)) * 0.1
    const noPrice = 1 - yesPrice + (Math.random() - 0.5) * 0.05

    data.push({
      timestamp,
      yesPrice: Math.max(0.1, Math.min(0.9, yesPrice)),
      noPrice: Math.max(0.1, Math.min(0.9, noPrice)),
    })
  }

  return data
}

export default function ProposalDetailPage({ params }: PageProps) {
  const { id } = params
  const chainId = useChainId()

  // Use the hook created earlier to fetch the proposal by id
  const { proposal: hookProposal, isLoading: hookLoading, error: hookError } = useGetProposalById(id)

  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [priceData, setPriceData] = useState<PricePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Map the hook's proposal shape to the app Proposal type
  useEffect(() => {
    if (!hookProposal) {
      setProposal(null)
      setError(hookError ? String(hookError) : null)
      setIsLoading(hookLoading)
      return
    }

    const mapped: Proposal = {
      id: hookProposal.id,
      title: hookProposal.title,
      description: hookProposal.description,
      creator: hookProposal.createdBy,
      startTime: BigInt(Math.floor(hookProposal.startTime || 0)),
      endTime: BigInt(Math.floor(hookProposal.endTime || 0)),
      executed: hookProposal.status === 'executed',
      passed: false,
      // markets are not read by the hook yet; use zero-address fallback
      yesMarket: '0x0000000000000000000000000000000000000000',
      noMarket: '0x0000000000000000000000000000000000000000',
      status: hookProposal.status === 'pending' ? 'pending' : hookProposal.status === 'active' ? 'active' : hookProposal.status === 'executed' ? 'executed' : 'closed',
    }

    setProposal(mapped)
    setError(null)
    setIsLoading(hookLoading)

    // generate mock price data for the proposal view
    setPriceData(generateMockPriceData())
  }, [hookProposal, hookLoading, hookError])

  useEffect(() => {
    // Poll for price updates every 10 seconds
    const interval = setInterval(() => {
      setPriceData((prev) => {
        const newPoint: PricePoint = {
          timestamp: Date.now(),
          yesPrice: Math.max(0.1, Math.min(0.9, 0.5 + (Math.random() - 0.5) * 0.2)),
          noPrice: Math.max(0.1, Math.min(0.9, 0.5 + (Math.random() - 0.5) * 0.2)),
        }
        return [...prev, newPoint].slice(-7 * 24) // Keep last 7 days
      })
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
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
          <PriceChart data={priceData} />
        </div>

        {/* Right Sidebar */}
        <div className="lg:sticky lg:top-4 lg:self-start">
          <TradePanel
            yesMarketAddress={proposal.yesMarket as Address}
            noMarketAddress={proposal.noMarket as Address}
            proposalStatus={proposal.status}
          />
        </div>
      </div>
    </div>
  )
}
