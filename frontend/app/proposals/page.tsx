import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, Clock, User } from "lucide-react"

// Mock proposal data
const mockProposals = [
  {
    id: "1",
    title: "Increase Treasury Allocation for Development",
    description: "Proposal to allocate 100 ETH from treasury to fund core development team for Q2 2025.",
    status: "active" as const,
    createdBy: "0x742d...5f3a",
    createdAt: "2025-01-10T14:30:00Z",
  },
  {
    id: "2",
    title: "Implement New Governance Token Distribution",
    description: "Adjust token distribution mechanism to reward long-term holders and active participants.",
    status: "pending" as const,
    createdBy: "0x8a3c...2b1d",
    createdAt: "2025-01-08T09:15:00Z",
  },
  {
    id: "3",
    title: "Partnership with DeFi Protocol XYZ",
    description: "Strategic partnership proposal to integrate liquidity pools with Protocol XYZ.",
    status: "executed" as const,
    createdBy: "0x1f9e...7c4b",
    createdAt: "2024-12-28T16:45:00Z",
  },
]

const statusColors = {
  active: "bg-green-500/10 text-green-500 border-green-500/20",
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  executed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
}

export default function ProposalsPage() {
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

      {mockProposals.length === 0 ? (
        <Card className="p-12">
          <div className="flex flex-col items-center text-center space-y-4">
            <div className="p-4 rounded-full bg-muted">
              <Plus className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">No proposals yet</h3>
              <p className="text-muted-foreground max-w-md">
                Be the first to create a proposal and shape the future of this DAO.
              </p>
            </div>
            <Button asChild size="lg" className="mt-4">
              <Link href="/proposals/new">Create First Proposal</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {mockProposals.map((proposal) => (
            <Card key={proposal.id} className="hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <CardTitle className="text-2xl">{proposal.title}</CardTitle>
                      <Badge variant="outline" className={statusColors[proposal.status]}>
                        {proposal.status}
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
                    <span>Created by {proposal.createdBy}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>{new Date(proposal.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
