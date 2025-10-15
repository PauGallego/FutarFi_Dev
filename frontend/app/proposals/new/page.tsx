"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function NewProposalPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    targetAddress: "",
    calldata: "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!formData.title.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a proposal title.",
        variant: "destructive",
      })
      return
    }

    if (!formData.description.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a proposal description.",
        variant: "destructive",
      })
      return
    }

    setIsSubmitting(true)

    // Simulate submission (no backend yet)
    await new Promise((resolve) => setTimeout(resolve, 1500))

    toast({
      title: "Proposal Created",
      description: "Your proposal has been submitted successfully.",
    })

    setIsSubmitting(false)
    router.push("/proposals")
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Button asChild variant="ghost" className="mb-6">
        <Link href="/proposals">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Proposals
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Create New Proposal</CardTitle>
          <CardDescription className="text-base">
            Submit a proposal for the DAO to vote on. Provide clear details about your proposal and its expected impact.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base">
                Proposal Title *
              </Label>
              <Input
                id="title"
                placeholder="e.g., Increase Treasury Allocation for Development"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="text-base"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">
                Description *
              </Label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description of your proposal, including rationale and expected outcomes..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[150px] text-base"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAddress" className="text-base">
                Target Contract Address
              </Label>
              <Input
                id="targetAddress"
                placeholder="0x..."
                value={formData.targetAddress}
                onChange={(e) => setFormData({ ...formData, targetAddress: e.target.value })}
                className="font-mono text-sm"
              />
              <p className="text-sm text-muted-foreground">
                Optional: The contract address this proposal will interact with
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="calldata" className="text-base">
                Calldata
              </Label>
              <Textarea
                id="calldata"
                placeholder="0x..."
                value={formData.calldata}
                onChange={(e) => setFormData({ ...formData, calldata: e.target.value })}
                className="font-mono text-sm min-h-[100px]"
              />
              <p className="text-sm text-muted-foreground">Optional: The encoded function call data for execution</p>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" size="lg" disabled={isSubmitting} className="flex-1">
                {isSubmitting ? "Creating..." : "Create Proposal"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.push("/proposals")}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
