import { useReadContract, useChainId, usePublicClient } from 'wagmi'
import { proposalManager_abi } from '@/contracts/proposalManager-abi'
import { proposal_abi } from '@/contracts/proposal-abi'
import { getContractAddress } from '@/contracts/constants'
import { useEffect, useState } from 'react'
import type { Proposal } from '@/lib/types'


export function useGetProposalById(id: string) {
  const chainId = useChainId()
  const contractAddress = getContractAddress(chainId, 'PROPOSAL_MANAGER')
  const publicClient = usePublicClient()

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

  useEffect(() => {
    async function fetchProposalDetails() {
      if (!proposalAddress || !publicClient) {
        setProposal(null)
        return
      }

      // If the manager returns the zero address it means no proposal found for this id
      const zeroAddress = '0x0000000000000000000000000000000000000000'
      const addresses = Array.isArray(proposalAddress) ? proposalAddress : [proposalAddress]
      const validAddresses = addresses.filter((a) => a && a !== zeroAddress)

      if (validAddresses.length === 0) {
        setProposal(null)
        return
      }

      // Only one proposal expected for a given id - use the first valid address
      const proposalAddr = validAddresses[0]

      setIsLoadingProposal(true)

      try {
        const [
          pid,
          admin,
          title,
          description,
          auctionStartTime,
          auctionEndTime,
          liveStart,
          liveEnd,
          liveDuration,
          subjectToken,
          pyUSD,
          minToOpen,
          maxCap,
          yesAuction,
          noAuction,
          yesToken,
          noToken,
          treasury,
          target,
          data,
          state,
        ] = await Promise.all([
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'id',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'admin',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'title',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'description',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'auctionStartTime',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'auctionEndTime',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'liveStart',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'liveEnd',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'liveDuration',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'subjectToken',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'pyUSD',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'minToOpen',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'maxCap',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'yesAuction',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'noAuction',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'yesToken',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'noToken',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'treasury',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'target' as any,
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'data' as any,
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'state',
          }),
        ])

        // Map the Solidity enum/state to the frontend `state` string
        const stateNum = Number(state as any)
        const stateStr = stateNum === 0 ? 'Auction' : stateNum === 1 ? 'Live' : stateNum === 2 ? 'Resolved' : 'Cancelled'

        const proposalObj: Proposal = {
          id: (pid as bigint)?.toString() || '0',
          admin: (admin as string) || '0x0000000000000000000000000000000000000000',
          title: (title as string) || 'Untitled Proposal',
          description: (description as string) || 'No description available',

          state: stateStr as 'Auction' | 'Live' | 'Resolved' | 'Cancelled',

          // Auction / live times (timestamps in seconds)
          auctionStartTime: Number((auctionStartTime as bigint) || 0),
          auctionEndTime: Number((auctionEndTime as bigint) || 0),
          liveStart: Number((liveStart as bigint) || 0),
          liveEnd: Number((liveEnd as bigint) || 0),
          liveDuration: Number((liveDuration as bigint) || 0),

          // Token / treasury / auctions
          subjectToken: (subjectToken as `0x${string}`) || '0x0000000000000000000000000000000000000000',
          pyUSD: (pyUSD as `0x${string}`) || '0x0000000000000000000000000000000000000000',
          minToOpen: minToOpen ? String(minToOpen as bigint) : '0',
          maxCap: maxCap ? String(maxCap as bigint) : '0',
          yesAuction: (yesAuction as `0x${string}`) || '0x0000000000000000000000000000000000000000',
          noAuction: (noAuction as `0x${string}`) || '0x0000000000000000000000000000000000000000',
          yesToken: (yesToken as `0x${string}`) || '0x0000000000000000000000000000000000000000',
          noToken: (noToken as `0x${string}`) || '0x0000000000000000000000000000000000000000',
          treasury: (treasury as `0x${string}`) || '0x0000000000000000000000000000000000000000',

          // Execution target and calldata
          target: (target as `0x${string}`) || '0x0000000000000000000000000000000000000000',
          data: (data as string) || '0x',

          // Contract address (proposal instance)
          address: (proposalAddr as `0x${string}`) || '0x0000000000000000000000000000000000000000',
        }

        setProposal(proposalObj)
      } catch (proposalError) {
        console.error(`Error fetching data for proposal ${proposalAddr}:`, proposalError)
        setProposal(null)
      } finally {
        setIsLoadingProposal(false)
      }
    }

    void fetchProposalDetails()
  }, [proposalAddress, publicClient])

  return {
    proposal,
    isLoading: isLoadingAddress || isLoadingProposal,
    error,
    refetch: () => {
      // trigger refetch of address (proposal details will refresh when proposalAddress updates)
      if (typeof refetchAddress === 'function') refetchAddress()
    },
  }
}