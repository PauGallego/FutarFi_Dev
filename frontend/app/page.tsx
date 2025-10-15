import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ArrowRight, TrendingUp, Vote, Zap } from "lucide-react"

export default function HomePage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <section className="flex flex-col items-center text-center space-y-8 py-16">
        <div className="space-y-4 max-w-3xl">
          <h1 className="text-5xl md:text-6xl font-bold text-balance">Futarchy for Everyone</h1>
          <p className="text-xl text-muted-foreground text-balance leading-relaxed">
            Create proposals, open prediction markets, and execute outcomes trustlessly. Let markets decide the future
            of your organization through decentralized governance.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 pt-4">
          <Button asChild size="lg" className="text-lg px-8">
            <Link href="/proposals/new">
              Create Proposal
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="text-lg px-8 bg-transparent">
            <Link href="/proposals">View Proposals</Link>
          </Button>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6 py-16">
        <Card className="p-6 space-y-3 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Vote className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Decentralized Voting</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Token holders vote on proposals through transparent on-chain mechanisms.
          </p>
        </Card>

        <Card className="p-6 space-y-3 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Prediction Markets</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Market-driven decision making reveals collective wisdom and expected outcomes.
          </p>
        </Card>

        <Card className="p-6 space-y-3 hover:border-primary/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Trustless Execution</h3>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Smart contracts automatically execute approved proposals without intermediaries.
          </p>
        </Card>
      </section>
    </div>
  )
}
