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
// Remove guard modal imports
// import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
// import { ConnectWalletButton } from "@/components/connect-wallet-button"
// import { useRouter, usePathname } from "next/navigation"
import { useCreateOrder } from "@/hooks/use-mintPublic"

const API_BASE = process.env.NEXT_PUBLIC_API_URL 
console.log('Using RPC URL:', process.env.NEXT_PUBLIC_API_URL)
  console.log('Using RPC URL:', process.env.NEXT_PUBLIC_RPC_URL)

const statusStyles = {
  Auction: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  Live: "bg-green-500/10 text-green-600 border-green-500/20",
  Resolved: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  Cancelled: "bg-red-500/10 text-red-600 border-red-500/20",
} as const

const statusLabels = {
  Auction: 'Auction',
  Live: 'Live',
  Resolved: 'Resolved',
  Cancelled: 'Cancelled',
} as const

type StatusKey = keyof typeof statusStyles

export default function ProposalsPage() {
  const { proposals, isLoading, error, refetch } = useGetAllProposals()
  const { isConnected } = useAccount()
  // const router = useRouter()
  const { mintPublic, pyUSDBalance, error: mintError, refetchOnchain } = useCreateOrder()

  // Backend proposals when wallet is NOT connected
  const [apiProposals, setApiProposals] = useState<any[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [connectionChecked, setConnectionChecked] = useState(false)
  // Removed guard state
  // const [guardOpen, setGuardOpen] = useState(false)
  // const [targetHref, setTargetHref] = useState<string | null>(null)

  useEffect(() => {
    // Wait for wagmi to determine connection state
    setConnectionChecked(false)
    const timer = setTimeout(() => setConnectionChecked(true), 2000)
    return () => clearTimeout(timer)
  }, [isConnected])

  // If user connects from the guard, continue to the desired proposal
  // useEffect(() => {
  //   if (isConnected && guardOpen && targetHref) {
  //     router.push(targetHref)
  //     setGuardOpen(false)
  //     setTargetHref(null)
  //   }
  // }, [isConnected, guardOpen, targetHref, router])

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

  // Refresh PYUSD balance every 5 seconds if connected
  useEffect(() => {
    if (!isConnected) return;
    refetchOnchain(); // Fetch balance immediately on mount
    const interval = setInterval(() => {
      refetchOnchain();
    }, 5000); // Actualiza cada 5 segundos
    return () => clearInterval(interval);
  }, [isConnected, refetchOnchain]);

  // Ensure proposals are refetched when returning to this page (back navigation, bfcache, or tab visibility)
  useEffect(() => {
    if (!refetch) return

    const onPop = () => {
      try { refetch() } catch (e) { /* ignore */ }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        try { refetch() } catch (e) { /* ignore */ }
      }
    }

    const onPageShow = (ev: PageTransitionEvent) => {
      try {
        // pageshow persisted indicates bfcache navigation restore
        if ((ev as any)?.persisted) refetch()
      } catch (e) { /* ignore */ }
    }

    window.addEventListener('popstate', onPop)
    window.addEventListener('pageshow', onPageShow as EventListener)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('pageshow', onPageShow as EventListener)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [refetch])


  // Listen for explicit refresh events dispatched by detail pages when navigating back
  useEffect(() => {
    if (!refetch) return
    const handler = () => {
      try { refetch() } catch (e) { /* ignore */ }
    }
    window.addEventListener('proposals:refresh', handler as EventListener)
    return () => window.removeEventListener('proposals:refresh', handler as EventListener)
  }, [refetch])

  // Choose source based on connection
  const list = connectionChecked ? (isConnected ? proposals : apiProposals) : []
  const loading = !connectionChecked || (isConnected ? isLoading : apiLoading)
  const errorToShow = connectionChecked ? (isConnected ? error : apiError) : null

  // Filter out proposals with the disallowed title
  const filteredList = useMemo(() => {
    try {
      return (list || []).filter((p: any) => String(p?.title ?? '').trim() !== 'Phat Nickher')
    } catch (e) {
      return list || []
    }
  }, [list])

  // Helper function to format address
  const formatAddress = (addr: string) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }




  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl font-bold mb-2">Proposals</h1>
          <p className="text-muted-foreground break-words w-full">Browse and vote on active governance proposals</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 items-center w-full sm:w-auto">
          {isConnected ? (
            <>
              <p className="text-base text-muted-foreground m-2 break-words w-full sm:w-auto" id="pyusd-balance">
                PYUSD balance: {Number(pyUSDBalance) / 1e6}
              </p>
              <Button size="lg" className="bg-blue-600 w-full sm:w-auto min-w-[180px]" variant="default" onClick={mintPublic}>
                Claim some PYUSD
              </Button>
            </>
          ) : null}
          <Button asChild size="lg" className="w-full sm:w-auto min-w-[180px]">
            <Link href="/proposals/new">
              <Plus className="mr-2 h-5 w-5" />
              Create Proposal
            </Link>
          </Button>
        </div>
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
  ) : filteredList.length === 0 ? (
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
          {/* Removed wallet guard to allow viewing proposals without a connected wallet */}
          {filteredList.map((proposal: any) => {
            const stateKey = (proposal.state ?? 'Auction') as StatusKey
            return (
              <Link
                key={proposal.id}
                href={`/proposals/${proposal.id}`}
              >

                <Card key={proposal.id} className="hover:border-primary/50 transition-colors">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4 overflow-auto">
                      <div className="space-y-2 flex-1 min-w-0">
                        <CardTitle className="text-2xl truncate">{proposal.title}</CardTitle>
                        <CardDescription className="text-base leading-relaxed line-clamp-2">{proposal.description}</CardDescription>
                      </div>
                      <Badge variant="outline" className={statusStyles[stateKey]}>
                        {statusLabels[stateKey]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        <span>Created by {formatAddress(proposal.admin)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Started at: {new Date(proposal.auctionStartTime).toLocaleDateString()}</span>
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
