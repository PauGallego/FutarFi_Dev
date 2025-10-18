import { useReadContract, useChainId, usePublicClient } from 'wagmi'
import { proposalManager_abi } from '@/contracts/proposalManager-abi'
import { proposal_abi } from '@/contracts/proposal-abi'
import { getContractAddress } from '@/contracts/constants'
import { useEffect, useState } from 'react'

export interface Proposal {
  id: string
  title: string
  description: string
  status: 'active' | 'pending' | 'executed'
  createdBy: string
  createdAt: string
  address: string
  endTime: number
  startTime: number
}

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
          name,
          description,
          startTime,
          endTime,
          proposalExecuted,
          proposalEnded,
          isActive,
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
            functionName: 'name',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'description',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'startTime',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'endTime',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'proposalExecuted',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'proposalEnded',
          }),
          publicClient.readContract({
            address: proposalAddr as `0x${string}`,
            abi: proposal_abi,
            functionName: 'isActive',
          }),
        ])

        let status: 'active' | 'pending' | 'executed'
        if (proposalExecuted || proposalEnded) {
          status = 'executed'
        } else if (isActive) {
          status = 'active'
        } else {
          status = 'pending'
        }

        const proposalObj: Proposal = {
          id: (pid as bigint)?.toString() || '0',
          title: (name as string) || 'Untitled Proposal',
          description: (description as string) || 'No description available',
          status,
          createdBy: (admin as string) || '',
          createdAt: startTime ? new Date(Number(startTime as bigint) * 1000).toISOString() : new Date().toISOString(),
          address: proposalAddr,
          endTime: Number((endTime as bigint) || 0),
          startTime: Number((startTime as bigint) || 0),
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