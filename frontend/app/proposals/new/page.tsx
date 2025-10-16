"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
    duration: "",
    collateralToken: "",
    maxSupply: "",
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

    if (!formData.duration || Number(formData.duration) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please provide a valid duration in days.",
        variant: "destructive",
      })
      return
    }

    if (!formData.collateralToken) {
      toast({
        title: "Validation Error",
        description: "Please select a collateral token.",
        variant: "destructive",
      })
      return
    }

    if (!formData.maxSupply || Number(formData.maxSupply) <= 0) {
      toast({
        title: "Validation Error",
        description: "Please provide a valid max supply.",
        variant: "destructive",
      })
      return
    }

    if (!formData.targetAddress.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a target contract address.",
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
              <Label htmlFor="duration" className="text-base">
                Duration (Days) *
              </Label>
              <Input
                id="duration"
                type="number"
                min="1"
                placeholder="e.g., 7"
                value={formData.duration}
                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                className="text-base"
                required
              />
              <p className="text-sm text-muted-foreground">How many days the proposal will be open for voting</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="collateralToken" className="text-base">
                Collateral Token *
              </Label>
              <Select
                value={formData.collateralToken}
                onValueChange={(value) => setFormData({ ...formData, collateralToken: value })}
                required
              >
                <SelectTrigger id="collateralToken" className="text-base">
                  <SelectValue placeholder="Select a token" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PYUSD">PYUSD</SelectItem>
                  <SelectItem value="USDC">USDC</SelectItem>
                  <SelectItem value="DAI">DAI</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">The stablecoin token used as collateral for this proposal</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxSupply" className="text-base">
                Max Supply *
              </Label>
              <Input
                id="maxSupply"
                type="number"
                min="1"
                placeholder="e.g., 1000000"
                value={formData.maxSupply}
                onChange={(e) => setFormData({ ...formData, maxSupply: e.target.value })}
                className="text-base"
                required
              />
              <p className="text-sm text-muted-foreground">Maximum supply for the market (in token units)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetAddress" className="text-base">
                Target Contract Address *
              </Label>
              <Input
                id="targetAddress"
                placeholder="0x..."
                value={formData.targetAddress}
                onChange={(e) => setFormData({ ...formData, targetAddress: e.target.value })}
                className="font-mono text-sm"
                required
              />
              <p className="text-sm text-muted-foreground">The contract address this proposal will interact with</p>
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
