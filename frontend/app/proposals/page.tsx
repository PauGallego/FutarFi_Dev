"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Clock, User, Loader2, AlertCircle } from "lucide-react"
// import { useProposalsByAdmin } from "@/hooks/use-proposals-by-admin"
import { useGetAllProposals } from "@/hooks/use-get-all-proposals"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAccount } from "wagmi"
import { useEffect, useMemo, useState } from "react"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"

const statusStyles = {
  Auction: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  Live: "bg-green-500/10 text-green-500 border-green-500/20",
  Resolved: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  Cancelled: "bg-red-500/10 text-red-500 border-red-500/20",
} as const

const statusLabels = {
  Auction: 'Auction',
  Live: 'Market Live',
  Resolved: 'Resolved',
  Cancelled: 'Cancelled',
} as const

type StatusKey = keyof typeof statusStyles

export default function ProposalsPage() {
  const { proposals, isLoading, error } = useGetAllProposals()
  const { isConnected } = useAccount()

  // Backend proposals when wallet is NOT connected
  const [apiProposals, setApiProposals] = useState<any[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  useEffect(() => {
    if (isConnected) return // use on-chain path when connected

    let cancelled = false
    const fetchApi = async () => {
      setApiLoading(true)
      setApiError(null)
      try {
        const res = await fetch(`${API_BASE}/proposals`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (cancelled) return
        // Map backend shape -> UI shape
        const stateMap: Record<string, 'Auction' | 'Live' | 'Resolved' | 'Cancelled'> = {
          auction: 'Auction',
          live: 'Live',
          resolved: 'Resolved',
          cancelled: 'Cancelled',
        }
        const mapped = Array.isArray(data) ? data.map((p: any) => ({
          id: String(p.id ?? p._id ?? ''),
          title: p.title || 'Untitled Proposal',
          description: p.description || '',
          state: stateMap[(String(p.state || 'auction')).toLowerCase()] || 'Auction',
          admin: p.admin || '',
          auctionStartTime: Number(p.startTime || 0) * 1000,
        })) : []
        setApiProposals(mapped)
      } catch (e) {
        if (!cancelled) setApiError(e instanceof Error ? e.message : 'Failed to fetch proposals')
      } finally {
        if (!cancelled) setApiLoading(false)
      }
    }

    fetchApi()
    return () => { cancelled = true }
  }, [isConnected])

  // Choose source based on connection
  const list = isConnected ? proposals : apiProposals
  const loading = isConnected ? isLoading : apiLoading
  const errorToShow = isConnected ? error : apiError

  // Helper function to format address
  const formatAddress = (addr: string) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }


  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold mb-2">Proposals</h1>
          <p className="text-muted-foreground">Browse and vote on active governance proposals</p>
        </div>
        <Button asChild size="lg">
          <Link href="/proposals/new">
            <Plus className="mr-2 h-5 w-5" />
            Create Proposal
          </Link>
        </Button>
      </div>

      {errorToShow && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load proposals. Please check your connection and try again.
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <Card className="p-12">
          <div className="flex flex-col items-center text-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Loading Proposals</h3>
              <p className="text-muted-foreground">Please wait while we fetch the latest proposals.</p>
            </div>
          </div>
        </Card>
      ) : list.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-full bg-muted">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No proposals yet</h3>
              <p className="text-muted-foreground max-w-md">
                No proposals have been created yet. Be the first to create a proposal.
              </p>
            </div>
            <Button asChild size="lg" className="mt-4">
              <Link href="/proposals/new">Create First Proposal</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="flex flex-col gap-1 space-y-4 ">
          {list.map((proposal: any) => {
            const stateKey = (proposal.state ?? 'Auction') as StatusKey
            return (
            <Link key={proposal.id} href={`/proposals/${proposal.id}`} >

              <Card key={proposal.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-2xl">{proposal.title}</CardTitle>
                        <Badge variant="outline" className={statusStyles[stateKey]}>
                          {statusLabels[stateKey]}
                        </Badge>
                      </div>
                      <CardDescription className="text-base leading-relaxed">{proposal.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      <span>Created by {formatAddress(proposal.admin)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span>{new Date(proposal.auctionStartTime).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
