import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, ExternalLink, User, Clock } from "lucide-react"
import type { Proposal } from "@/lib/types"

interface ProposalHeaderProps {
  proposal: Proposal
  chainId: number
}

const statusColors = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  closed: "bg-muted text-muted-foreground border-border",
  executed: "bg-primary/10 text-primary border-primary/20",
}

export function ProposalHeader({ proposal, chainId }: ProposalHeaderProps) {
  const explorerUrl = getExplorerUrl(chainId, proposal.creator)

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/proposals">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Proposals
        </Link>
      </Button>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-4xl font-bold text-balance">{proposal.title}</h1>
          <Badge variant="outline" className={statusColors[proposal.status]}>
            {proposal.status}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span>Creator:</span>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-1"
            >
              {formatAddress(proposal.creator)}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            <span>
              {formatDate(proposal.startTime)} - {formatDate(proposal.endTime)}
            </span>
          </div>
        </div>

        <div className="prose prose-invert max-w-none">
          <p className="text-muted-foreground leading-relaxed">{proposal.description}</p>
        </div>
      </div>
    </div>
  )
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function formatDate(timestamp: bigint): string {
  return new Date(Number(timestamp) * 1000).toLocaleDateString()
}

function getExplorerUrl(chainId: number, address: string): string {
  const explorers: Record<number, string> = {
    1: "https://etherscan.io",
    11155111: "https://sepolia.etherscan.io",
    42161: "https://arbiscan.io",
    421614: "https://sepolia.arbiscan.io",
  }
  const baseUrl = explorers[chainId] || explorers[1]
  return `${baseUrl}/address/${address}`
}
