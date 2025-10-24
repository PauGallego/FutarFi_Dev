"use client"

import { useCallback, useMemo, useState, useEffect } from "react"
import { useAccount, useReadContract, useChainId, usePublicClient } from "wagmi"
import { parseUnits } from "viem"
import { ethers } from "ethers"
import { proposal_abi } from "@/contracts/proposal-abi"
import { dutchAuction_abi } from "@/contracts/dutchAuction-abi"
import { marketToken_abi } from "@/contracts/marketToken-abi"
import { getContractAddress } from "@/contracts/constants"

export type AuctionSide = "YES" | "NO"

export function useAuctionBuy({ proposalAddress, side }: { proposalAddress: `0x${string}`; side: AuctionSide }) {
  const { address } = useAccount()
  const chainId = useChainId()
  const publicClient = usePublicClient()
  const [amount, setAmount] = useState<string>("") // USDC amount (6d)
  const [lastHash, setLastHash] = useState<`0x${string}` | undefined>()

  // Read addresses from Proposal
  const { data: treasury } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "treasury" })
  const { data: yesAuctionAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "yesAuction" })
  const { data: noAuctionAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "noAuction" })
  const { data: yesToken } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "yesToken" })
  const { data: noToken } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "noToken" })

  const auctionAddress = useMemo(() => (side === "YES" ? (yesAuctionAddr as `0x${string}`) : (noAuctionAddr as `0x${string}`)), [side, yesAuctionAddr, noAuctionAddr])
  const marketToken = useMemo(() => (side === "YES" ? (yesToken as `0x${string}`) : (noToken as `0x${string}`)), [side, yesToken, noToken])
  const pyusd = useMemo(() => getContractAddress(chainId, 'PYUSD') as `0x${string}` | undefined, [chainId])

  const { data: cap } = useReadContract({ address: marketToken, abi: marketToken_abi, functionName: "cap" })
  const { data: totalSupply } = useReadContract({ address: marketToken, abi: marketToken_abi, functionName: "totalSupply" })
  const { data: userBal } = useReadContract({ address: marketToken, abi: marketToken_abi, functionName: "balanceOf", args: [address ?? "0x0000000000000000000000000000000000000000"] })
  const { data: onchainPrice } = useReadContract({ address: auctionAddress, abi: dutchAuction_abi, functionName: "priceNow" })
  const { data: pyusdBal } = useReadContract({
    address: pyusd,
    abi: marketToken_abi,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
  })

  // Local mirrors to enable instant post-tx updates and real-time polling
  const remainingComputed = useMemo(() => (cap && totalSupply ? (cap as bigint) - (totalSupply as bigint) : 0n), [cap, totalSupply])
  const [remainingState, setRemainingState] = useState<bigint>(0n)
  const [userTokenBalanceState, setUserTokenBalanceState] = useState<bigint>(0n)
  const [pyusdBalanceState, setPyusdBalanceState] = useState<bigint>(0n)

  useEffect(() => { if (typeof remainingComputed === "bigint") setRemainingState(remainingComputed) }, [remainingComputed])
  useEffect(() => { if (typeof userBal === "bigint") setUserTokenBalanceState(userBal) }, [userBal])
  useEffect(() => { if (typeof pyusdBal === "bigint") setPyusdBalanceState(pyusdBal) }, [pyusdBal])

  const [isApproving, setIsApproving] = useState(false)
  const [isBuying, setIsBuying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Helper to refetch balances/remaining after a successful tx or on a timer
  const refetchOnchain = useCallback(async () => {
    try {
      if (!publicClient || !address || !marketToken || !pyusd) return
      const [capNow, tsNow, userNow, pyusdNow] = await Promise.all([
        publicClient.readContract({ address: marketToken as `0x${string}`, abi: marketToken_abi, functionName: 'cap' }) as Promise<bigint>,
        publicClient.readContract({ address: marketToken as `0x${string}`, abi: marketToken_abi, functionName: 'totalSupply' }) as Promise<bigint>,
        publicClient.readContract({ address: marketToken as `0x${string}`, abi: marketToken_abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
        publicClient.readContract({ address: pyusd as `0x${string}`, abi: marketToken_abi, functionName: 'balanceOf', args: [address] }) as Promise<bigint>,
      ])
      setRemainingState((capNow ?? 0n) - (tsNow ?? 0n))
      setUserTokenBalanceState(userNow ?? 0n)
      setPyusdBalanceState(pyusdNow ?? 0n)
    } catch (e) {
      // silent
    }
  }, [publicClient, address, marketToken, pyusd])

  // Lightweight polling to keep remaining up-to-date while auction is live
  useEffect(() => {
    if (!publicClient || !marketToken) return
    const id = setInterval(() => { void refetchOnchain() }, 3000)
    return () => clearInterval(id)
  }, [publicClient, marketToken, refetchOnchain])

  const doApproveAndBuy = useCallback(async () => {
    setError(null)
    if (!address || !pyusd || !treasury || !auctionAddress) return
    const pay = parseUnits(amount || "0", 6)
    if (pay === 0n) return

    // Setup ethers provider/signer
    const anyWindow = window as any
    if (!anyWindow?.ethereum) {
      setError("No wallet found")
      return
    }
    const provider = new ethers.BrowserProvider(anyWindow.ethereum)
    const signer = await provider.getSigner()

    // Optional: ensure network matches UI chainId
    try {
      const net = await provider.getNetwork()
      if (Number(net.chainId) !== chainId) {
        console.warn(`Network mismatch: provider ${Number(net.chainId)} vs UI ${chainId}`)
      }
    } catch {}

    const erc20 = new ethers.Contract(pyusd as string, marketToken_abi as any, signer)
    const auction = new ethers.Contract(auctionAddress as string, dutchAuction_abi as any, signer)

    // Check current allowance and approve if needed
    try {
      const cur: bigint = await erc20.allowance(address, treasury as string)
      if (cur < pay) {
        setIsApproving(true)
        const tx = await erc20.approve(treasury as string, pay)
        setLastHash(tx.hash)
        const rcpt = await tx.wait(1)
        if (!rcpt || (rcpt.status !== 1n && rcpt.status !== 1)) {
          setIsApproving(false)
          setError("Approve failed on-chain")
          return
        }
        setIsApproving(false)
      }
    } catch (e: any) {
      setIsApproving(false)
      setError(e?.shortMessage || e?.message || "Approve failed")
      return
    }

    // Proceed to buy
    try {
      setIsBuying(true)
      const tx2 = await auction.buyLiquidity(pay)
      setLastHash(tx2.hash)
      const rcpt2 = await tx2.wait(1)
      if (!rcpt2 || (rcpt2.status !== 1n && rcpt2.status !== 1)) {
        setError("Buy failed on-chain")
        return
      }
      // Refresh balances immediately after success
      await refetchOnchain()
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || "Buy failed")
      return
    } finally {
      setIsBuying(false)
    }
  }, [address, pyusd, treasury, auctionAddress, amount, chainId, refetchOnchain])

  return {
    amount,
    setAmount,
    approveAndBuy: doApproveAndBuy,
    isApproving,
    isBuying,
    error,
    auctionAddress,
    marketToken,
    remaining: remainingState,
    userTokenBalance: userTokenBalanceState,
    onchainPrice: (onchainPrice as bigint) ?? 0n,
    lastHash,
    pyusd,
    pyusdBalance: pyusdBalanceState,
  }
}
