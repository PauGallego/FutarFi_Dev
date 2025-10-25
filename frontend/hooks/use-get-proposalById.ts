import { useReadContract, useChainId, usePublicClient } from 'wagmi'
import { proposalManager_abi } from '@/contracts/proposalManager-abi'
import { proposal_abi } from '@/contracts/proposal-abi'
import { getContractAddress } from '@/contracts/constants'
import { useEffect, useState, useCallback } from 'react'
import type { Proposal } from '@/lib/types'


export function useGetProposalById(id: string) {
  const chainId = useChainId()
  const contractAddress = getContractAddress(chainId, 'PROPOSAL_MANAGER')
  const publicClient = usePublicClient()

  console.log(`useGetProposalById: Fetching proposal for id=${id} on chainId=${chainId}`)
  // Fetch the proposal address by id. The contract returns a single address for a given id.
  const { data: proposalAddress, isLoading: isLoadingAddress, error, refetch: refetchAddress } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: proposalManager_abi,
    functionName: 'getProposalById',
    args: [id ? BigInt(id) : BigInt(0)],
    query: {
      enabled: !!contractAddress && typeof id !== 'undefined' && id !== '',
    },
  })


  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [isLoadingProposal, setIsLoadingProposal] = useState(false)

  const fetchProposalDetails = useCallback(async (opts?: { background?: boolean }) => {
    if (!proposalAddress || !publicClient) {
      setProposal(null)
      return
    }

    const background = !!opts?.background

    // If the manager returns the zero address it means no proposal found for this id
    const zeroAddress = '0x0000000000000000000000000000000000000000'
    const addresses = Array.isArray(proposalAddress) ? proposalAddress : [proposalAddress]
    const validAddresses = addresses.filter((a) => a && a !== zeroAddress)

    if (validAddresses.length === 0) {
      setProposal(null)
      return
    }

    // Only one proposal expected for a given id - use the first valid address
    const proposalAddr = validAddresses[0] as string

    if (!background) setIsLoadingProposal(true)
    try {
      const [
        id,
        admin,
        title,
        description,
        stateVal,
        auctionStartTime,
        auctionEndTime,
        liveStart,
        liveEnd,
        liveDuration,
        subjectToken,
        pyusd,
        minToOpen,
        maxCap,
        yesAuction,
        noAuction,
        yesToken,
        noToken,
        treasury
      ] = await Promise.all([
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'id' }).catch(() => BigInt(0)),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'admin' }).catch(() => ''),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'title' }).catch(() => ''),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'description' }).catch(() => ''),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'state' }).catch(() => 0),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'auctionStartTime' }).catch(() => 0),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'auctionEndTime' }).catch(() => 0),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'liveStart' }).catch(() => 0),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'liveEnd' }).catch(() => 0),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'liveDuration' }).catch(() => 0),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'subjectToken' }).catch(() => zeroAddress),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'pyUSD' }).catch(() => zeroAddress),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'minToOpen' }).catch(() => BigInt(0)),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'maxCap' }).catch(() => BigInt(0)),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'yesAuction' }).catch(() => zeroAddress),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'noAuction' }).catch(() => zeroAddress),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'yesToken' }).catch(() => zeroAddress),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'noToken' }).catch(() => zeroAddress),
        publicClient.readContract({ address: proposalAddr as `0x${string}`, abi: proposal_abi, functionName: 'treasury' }).catch(() => zeroAddress),
      ])

      const stateMap = ['Auction', 'Live', 'Resolved', 'Cancelled'] as const
      const stateStr = stateMap[Number(stateVal ?? 0)]

      // Convert on-chain seconds to JS milliseconds for Date()
      const auctionStartTimeMs = Number(auctionStartTime ?? 0) * 1000
      const auctionEndTimeMs = Number(auctionEndTime ?? 0) * 1000
      const liveStartMs = Number(liveStart ?? 0) * 1000
      const liveEndMs = Number(liveEnd ?? 0) * 1000

      const proposalObj: Proposal = {
        id: (id as bigint)?.toString() || '0',
        admin: (admin as string) || '',
        title: (title as string) || 'Untitled Proposal',
        description: (description as string) || 'No description available',
        state: stateStr,
        auctionStartTime: auctionStartTimeMs,
        auctionEndTime: auctionEndTimeMs,
        liveStart: liveStartMs,
        liveEnd: liveEndMs,
        liveDuration: Number(liveDuration ?? 0),
        subjectToken: (subjectToken as string) as `0x${string}`,
        pyUSD: (pyusd as string) as `0x${string}`,
        // Convert on-chain uints to strings safely. Fallback to '0' when missing.
        minToOpen: String(minToOpen ?? '0'),
        maxCap: String(maxCap ?? '0'),
        yesAuction: (yesAuction as string) as `0x${string}`,
        noAuction: (noAuction as string) as `0x${string}`,
        yesToken: (yesToken as string) as `0x${string}`,
        noToken: (noToken as string) as `0x${string}`,
        treasury: (treasury as string) as `0x${string}`,
        target: zeroAddress as `0x${string}`,
        data: '0x',
        address: proposalAddr as `0x${string}`,
      }

      setProposal(proposalObj)
    } catch (proposalError) {
      console.error(`Error fetching data for proposal`, proposalError)
      setProposal(null)
    } finally {
      if (!background) setIsLoadingProposal(false)
    }
  }, [proposalAddress, publicClient])

  useEffect(() => {
    void fetchProposalDetails({ background: false })
  }, [fetchProposalDetails])

  // Watch new blocks to auto-refresh proposal details so UI switches states without manual refresh
  useEffect(() => {
    if (!publicClient || !proposalAddress) return

    const unwatch = publicClient.watchBlockNumber({
      poll: true,
      onBlockNumber: () => { void fetchProposalDetails({ background: true }) },
    })

    return () => {
      try { unwatch?.() } catch {}
    }
  }, [publicClient, proposalAddress, fetchProposalDetails])

  return {
    proposal,
    isLoading: isLoadingAddress || isLoadingProposal,
    error,
    refetch: () => {
      // trigger manual refetch of proposal details
      void fetchProposalDetails({ background: false })
      if (typeof refetchAddress === 'function') refetchAddress()
    },
  }
}