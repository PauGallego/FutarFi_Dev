"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { isAddress,  Hex } from "viem"
import { ethers } from "ethers"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

import { getSupportedCollaterals, type Collateral } from "@/lib/collaterals"
import { 
  useChainId,
  useAccount
} from "wagmi"
import { proposalManager_abi } from "@/contracts/proposalManager-abi"
import { getContractAddress } from "@/contracts/constants"

export default function NewProposalPage() {

  const chainId = useChainId()
  const { address: account, isConnected } = useAccount()
  const contractAddress = getContractAddress(chainId, "PROPOSAL_MANAGER")

  const tokenOptions: Collateral[] = React.useMemo(
    () => getSupportedCollaterals(chainId),
    [chainId]
  )

  const byPythID = React.useMemo(
   () => new Map(tokenOptions.map(t => [t.pythID, t])),
    [tokenOptions]    
  )

  const router = useRouter()
  const { toast } = useToast()

  const isUint = (v: string) => /^\d+$/.test(v)

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    auctionDuration: "",
    liveDuration: "",
    subjectToken: "",
    minToOpen: "",
    maxCap: "",
    targetAddress: "",
    calldata: "",
    pythAddress: "",
    pythId: "",
  })

  const [useTarget, setUseTarget] = useState<"YES" | "NO">("NO")

  // Local tx state (ethers based)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const handleSubmit = async (e: React.FormEvent)=>{
    e.preventDefault()

    const fail = (desc: string) => {
      toast({ title: "Validation Error", description: desc, variant: "destructive" })
      return false
    }

    toast({ title: "Submitting", description: "Validating inputs and preparing transaction..." })

    if (!isConnected || !account) {
      return fail("Connect your wallet to submit a proposal.")
    }

    // Strongly encourage using the Anvil chain when developing locally
    if (chainId !== 31337) {
      return fail("Wrong network. Please switch your wallet to Anvil (31337).")
    }

    if (!formData.title.trim()) return fail("Please provide a proposal title.")
    if (!formData.description.trim()) return fail("Please provide a proposal description.")
    if (!formData.auctionDuration || Number(formData.auctionDuration) <= 0 || !isUint(formData.auctionDuration)) return fail("Auction duration must be a positive whole number of days.")
    if (Number(formData.auctionDuration) > 30) return fail("Auction duration cannot exceed 30 days.")
    if (!formData.liveDuration || Number(formData.liveDuration) <= 0 || !isUint(formData.liveDuration)) return fail("Live duration must be a positive whole number of days.")
    if (Number(formData.liveDuration) > 30) return fail("Live duration cannot exceed 30 days.")
    if (!formData.subjectToken ) return fail("Please select a valid collateral token address.")
    if (!formData.minToOpen || Number(formData.minToOpen) <= 0 || !isUint(formData.minToOpen)) return fail("Min to open must be a positive integer greater than 0.")
    if (!formData.maxCap || Number(formData.maxCap) <= 0 || !isUint(formData.maxCap)) return fail("Max cap must be a positive integer.")
    if (Number(formData.maxCap) <= Number(formData.minToOpen)) return fail("Max cap must be greater than Min to open.")

    if (useTarget === "YES") {
      if (!formData.targetAddress.trim() || !isAddress(formData.targetAddress)) {
        return fail("Please provide a valid target contract address.")
      }
    }

    if (!contractAddress) {
      return fail("Contract not found on this network.")
    }

    const targetAddressArg = useTarget === "YES"
      ? (formData.targetAddress as `0x${string}`)
      : "0x0000000000000000000000000000000000000000"

    // Ethers setup
    try {
      setError(null)
      setIsPending(true)

      const anyWindow = window as any
      if (!anyWindow?.ethereum) {
        setIsPending(false)
        return fail("No wallet found. Please open MetaMask or a compatible wallet.")
      }

      const provider = new ethers.BrowserProvider(anyWindow.ethereum)
      const signer = await provider.getSigner()

      const contract = new ethers.Contract(
        contractAddress as `0x${string}`,
        proposalManager_abi,
        signer
      )

      const to18 = (v: string) => (BigInt(v) * (10n ** 18n))

      const tx = await contract.createProposal(
        formData.title,
        formData.description,
        BigInt(formData.auctionDuration) * BigInt(86400),
        BigInt(formData.liveDuration) * BigInt(86400),
        formData.subjectToken,
        to18(formData.minToOpen),
        to18(formData.maxCap),
        targetAddressArg,
        formData.calldata ? (formData.calldata as `0x${string}`) : "0x",
        formData.pythAddress as `0x${string}`,
        `0x${formData.pythId}`
      )

      setTxHash(tx.hash)
      setIsPending(false)
      setIsConfirming(true)

      const receipt = await tx.wait()
      const status = (receipt as any)?.status
      if (status === 1 || status === "1" || status === true) {
        setIsConfirmed(true)
        toast({
          title: "Proposal Created",
          description: "Your proposal has been submitted successfully.",
        })
        router.push("/proposals")
      } else {
        setError(new Error("Transaction failed"))
        toast({ title: "Transaction failed", description: "The transaction was mined but failed.", variant: "destructive" })
      }
    } catch (err: any) {
      setError(err)
      toast({ title: "Transaction Error", description: err?.message || String(err), variant: "destructive" })
    } finally {
      setIsPending(false)
      setIsConfirming(false)
    }
  }

  useEffect(() => {
    // no-op here; navigation handled after receipt above
  }, [])

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
            Submit a proposal to vote on. Provide clear details about your proposal and its expected impact.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-base">Proposal Title *</Label>
              <Input
                id="title"
                placeholder="e.g., Increase Treasury Allocation for Development"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="text-base"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-base">Description *</Label>
              <Textarea
                id="description"
                placeholder="Provide a detailed description..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="min-h-[150px] text-base"
                required
              />
            </div>

            {/* Auction + Live durations */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="auctionDuration" className="text-base">Auction Duration (Days) *</Label>
                <Input
                  id="auctionDuration"
                  type="number"
                  min="1"
                  value={formData.auctionDuration}
                  onChange={(e) => setFormData({ ...formData, auctionDuration: e.target.value })}
                  className="text-base"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="liveDuration" className="text-base">Live Duration (Days) *</Label>
                <Input
                  id="liveDuration"
                  type="number"
                  min="1"
                  value={formData.liveDuration}
                  onChange={(e) => setFormData({ ...formData, liveDuration: e.target.value })}
                  className="text-base"
                  required
                />
              </div>
            </div>

            {/* Collateral token */}
            <div className="space-y-2">
              <Label htmlFor="subjectToken" className="text-base">Collateral Token *</Label>
              <Select
                value={formData.subjectToken}
                onValueChange={(value) =>{
                  const selected = byPythID.get(value);
                  setFormData(prev => ({
                    ...prev,
                    subjectToken: value,
                    pythAddress: selected?.pythAddress ?? "",
                    pythId: selected?.pythID ?? "",
                  }))
                }}
              >
                <SelectTrigger id="subjectToken" className="text-base">
                  <SelectValue placeholder={tokenOptions.length ? "Select a token" : "No tokens for this chain"} />
                </SelectTrigger>
                <SelectContent>
                  {tokenOptions.map((t) => (
                    <SelectItem key={t.pythID} value={t.pythID}>
                      {t.symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* MinToOpen + MaxCap */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minToOpen" className="text-base">Min To Open *</Label>
                <Input
                  id="minToOpen"
                  type="number"
                  min="1"
                  value={formData.minToOpen}
                  onChange={(e) => setFormData({ ...formData, minToOpen: e.target.value })}
                  className="text-base"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxCap" className="text-base">Max Cap *</Label>
                <Input
                  id="maxCap"
                  type="number"
                  min="1"
                  value={formData.maxCap}
                  onChange={(e) => setFormData({ ...formData, maxCap: e.target.value })}
                  className="text-base"
                  required
                />
              </div>
            </div>

            {/* Use target selector */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Use Target Contract</Label>
              <div className="flex items-center gap-1 bg-muted p-0.5 rounded-md w-[220px]">
                <button
                  type="button"
                  onClick={() => setUseTarget("YES")}
                  className={`flex-1 text-center px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-200 ${
                    useTarget === "YES"
                      ? "text-primary border border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setUseTarget("NO")}
                  className={`flex-1 text-center px-3 py-1 rounded-md text-sm font-semibold transition-colors duration-200 ${
                    useTarget === "NO"
                      ? "text-primary border border-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  NO
                </button>
              </div>
            </div>

            {/* Target + Calldata */}
            <div className="space-y-2">
              <Label htmlFor="targetAddress" className="text-base">
                Target Contract Address {useTarget === "YES" ? "*" : ""}
              </Label>
              <Input
                id="targetAddress"
                placeholder={useTarget === "YES" ? "0x..." : "Not using a target contract"}
                value={formData.targetAddress}
                onChange={(e) => setFormData({ ...formData, targetAddress: e.target.value })}
                className="font-mono text-sm"
                required={useTarget === "YES"}
                disabled={useTarget === "NO"}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="calldata" className="text-base">Calldata</Label>
              <Textarea
                id="calldata"
                placeholder={useTarget === "YES" ? "0x..." : "Disabled when not using a target contract"}
                value={formData.calldata}
                onChange={(e) => setFormData({ ...formData, calldata: e.target.value })}
                className={`font-mono text-sm min-h-[100px] ${useTarget === "NO" ? "opacity-60 cursor-not-allowed" : ""}`}
                disabled={useTarget === "NO"}
              />
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-4">
              <Button type="submit" size="lg" disabled={isPending} className="flex-1">
                {isPending ? "Creating..." : "Create Proposal"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => router.push("/proposals")}
                disabled={isPending}
              >
                Cancel
              </Button>
            </div>

            {/* Transaction feedback */}
            {txHash && <div>Transaction Hash: {txHash}</div>}
            {isConfirming && <div>Waiting for confirmation...</div>}
            {isConfirmed && <div>Transaction confirmed.</div>}
            {error && <div>Error: {error.message}</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
