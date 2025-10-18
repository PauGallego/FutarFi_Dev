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

interface PageProps {
  params: { id: string }
}

// // Mock data generator for development
// function generateMockProposal(id: string): Proposal {
//   const now = Date.now()
//   return {
//     id,
//     title: "Increase Treasury Allocation for Development",
//     description:
//       "This proposal seeks to allocate 100 ETH from the treasury to fund the core development team for Q2 2025. The funds will be used for hiring additional developers, conducting security audits, and improving infrastructure.",
//     creator: "0x742d35Cc6634C0532925a3b844Bc9e7595f5f3a" as Address,
//     startTime: BigInt(Math.floor((now - 2 * 24 * 60 * 60 * 1000) / 1000)),
//     endTime: BigInt(Math.floor((now + 5 * 24 * 60 * 60 * 1000) / 1000)),
//     executed: false,
//     passed: false,
//     yesMarket: "0x1234567890123456789012345678901234567890" as Address,
//     noMarket: "0x0987654321098765432109876543210987654321" as Address,
//     status: "active",
//   }
// }

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
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [priceData, setPriceData] = useState<PricePoint[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Simulate loading proposal data
    const loadProposal = async () => {
      try {
        setIsLoading(true)
        // In production, replace with actual contract reads:
        const data = await readContract({
          address: contracts.proposalManager,
          abi: PROPOSAL_MANAGER_ABI,
          functionName: 'getProposalById',
          args: [BigInt(id)]
        })

        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, 1000))

        const mockProposal = data as Proposal
        const mockPrices = generateMockPriceData()

        setProposal(mockProposal)
        setPriceData(mockPrices)
        setError(null)
      } catch (err) {
        console.error("[v0] Error loading proposal:", err)
        setError("Failed to load proposal data")
      } finally {
        setIsLoading(false)
      }
    }

    loadProposal()

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
  }, [id])

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
