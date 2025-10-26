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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConnectWalletButton } from "@/components/connect-wallet-button"
import { useRouter } from "next/navigation"

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"

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
  const { proposals, isLoading, error } = useGetAllProposals()
  const { isConnected } = useAccount()
  const router = useRouter()

  // Backend proposals when wallet is NOT connected
  const [apiProposals, setApiProposals] = useState<any[]>([])
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)
  const [connectionChecked, setConnectionChecked] = useState(false)
  const [guardOpen, setGuardOpen] = useState(false)
  const [targetHref, setTargetHref] = useState<string | null>(null)

  useEffect(() => {
    // Wait for wagmi to determine connection state
    setConnectionChecked(false)
    const timer = setTimeout(() => setConnectionChecked(true), 2000)
    return () => clearTimeout(timer)
  }, [isConnected])

  // If user connects from the guard, continue to the desired proposal
  useEffect(() => {
    if (isConnected && guardOpen && targetHref) {
      router.push(targetHref)
      setGuardOpen(false)
      setTargetHref(null)
    }
  }, [isConnected, guardOpen, targetHref, router])

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
  const list = connectionChecked ? (isConnected ? proposals : apiProposals) : []
  const loading = !connectionChecked || (isConnected ? isLoading : apiLoading)
  const errorToShow = connectionChecked ? (isConnected ? error : apiError) : null

  // Helper function to format address
  const formatAddress = (addr: string) => {
    if (!addr) return ""
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  // Inline component to show quorum shortfall details for Cancelled proposals
  function QuorumShortfall({ proposalAddress, yesAuction, noAuction }: { proposalAddress?: `0x${string}`; yesAuction?: `0x${string}`; noAuction?: `0x${string}` }) {
    // Lazy import hooks to avoid top-level dependency cycles
    // We use wagmi hooks locally; safe in client component
    const { useReadContract } = require('wagmi') as typeof import('wagmi')
    const { dutchAuction_abi } = require('@/contracts/dutchAuction-abi') as typeof import('@/contracts/dutchAuction-abi')
    const { marketToken_abi } = require('@/contracts/marketToken-abi') as typeof import('@/contracts/marketToken-abi')
    const { proposal_abi } = require('@/contracts/proposal-abi') as typeof import('@/contracts/proposal-abi')

    const canReadYes = !!yesAuction
    const canReadNo = !!noAuction
    const canReadProposal = !!proposalAddress

    const { data: minYes } = useReadContract({ address: yesAuction!, abi: dutchAuction_abi, functionName: 'MIN_TO_OPEN', query: { enabled: canReadYes } })
    const { data: minNo }  = useReadContract({ address: noAuction!,  abi: dutchAuction_abi, functionName: 'MIN_TO_OPEN', query: { enabled: canReadNo } })
    // Read PYUSD address from Proposal, then read current balances held by each auction (raised amount)
    const { data: pyusdAddr } = useReadContract({ address: proposalAddress!, abi: proposal_abi, functionName: 'pyUSD', query: { enabled: canReadProposal } })
    const pyusd = pyusdAddr as `0x${string}` | undefined
    const canReadPyusd = !!pyusd
    const { data: yesRaised } = useReadContract({ address: pyusd!, abi: marketToken_abi, functionName: 'balanceOf', args: [yesAuction!], query: { enabled: canReadPyusd && canReadYes } })
    const { data: noRaised }  = useReadContract({ address: pyusd!, abi: marketToken_abi, functionName: 'balanceOf', args: [noAuction!],  query: { enabled: canReadPyusd && canReadNo } })

    const yesMin = Number((minYes as bigint) ?? 0n)
    const noMin  = Number((minNo as bigint) ?? 0n)
    const yesAmt = Number((yesRaised as bigint) ?? 0n)
    const noAmt  = Number((noRaised as bigint) ?? 0n)

    // Values are in 6d PyUSD per other parts of app; compute coverage and missing percent
    const pct = (num: number, den: number) => den > 0 ? Math.min(100, (num / den) * 100) : 0
    const short = (num: number, den: number) => Math.max(0, 100 - pct(num, den))

    const yesShort = short(yesAmt, yesMin)
    const noShort  = short(noAmt, noMin)

    const items: Array<{ label: 'YES' | 'NO'; missing: number }> = []
    if (yesMin > 0 && yesShort > 0.0001) items.push({ label: 'YES', missing: yesShort })
    if (noMin  > 0 && noShort  > 0.0001) items.push({ label: 'NO',  missing: noShort })

    if (items.length === 0) return null

    return (
      <div className="w-full mt-2 text-xs sm:text-sm text-amber-600 dark:text-amber-400">
        <span className="font-medium">Quorum not reached:</span>{' '}
        {items.map((it, idx) => (
          <span key={it.label}>
            {it.label} − {it.missing.toFixed(1)}%
            {idx < items.length - 1 ? ', ' : ''}
          </span>
        ))}
      </div>
    )
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
          {/* Wallet guard modal when trying to enter a proposal without connection */}
          <Dialog open={guardOpen && !isConnected} onOpenChange={setGuardOpen}>
            <DialogContent
              showCloseButton={true}
              className="bg-transparent border border-black/10 dark:border-white/20"
            >
              <DialogHeader>
                <DialogTitle>Connect your wallet</DialogTitle>
                <DialogDescription>
                  To view proposals you need to connect your wallet.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center justify-center pt-2">
                <ConnectWalletButton onBeforeOpen={() => setGuardOpen(false)} />
              </div>
            </DialogContent>
          </Dialog>
          {list.map((proposal: any) => {
            const stateKey = (proposal.state ?? 'Auction') as StatusKey
            return (
            <Link
              key={proposal.id}
              href={`/proposals/${proposal.id}`}
              onClick={(e) => {
                if (!connectionChecked) return
                if (!isConnected) {
                  e.preventDefault()
                  setTargetHref(`/proposals/${proposal.id}`)
                  setGuardOpen(true)
                }
              }}
            >

              <Card key={proposal.id} className="hover:border-primary/50 transition-colors">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
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
                  {stateKey === 'Cancelled' && (
                    <QuorumShortfall proposalAddress={proposal.address} yesAuction={proposal.yesAuction} noAuction={proposal.noAuction} />
                  )}
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
