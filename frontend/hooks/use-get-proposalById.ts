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

  // Fetch the proposal address by id
  const { data: proposalAddress, isLoading: isLoadingAddress, error, refetch: refetchAddress } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: proposalManager_abi,
    functionName: 'getProposalById',
    args: [id],
    query: {
      enabled: !!contractAddress,
    },
  })

  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoadingProposals, setIsLoadingProposals] = useState(false)

  useEffect(() => {
    async function fetchProposalDetails() {
      if (!proposalAddress || !publicClient) {
        setProposals([])
        return
      }

      setIsLoadingProposals(true)

      try {
        // Normalize to an array (in case contract returns a single address or an array)
        const addresses = Array.isArray(proposalAddress) ? proposalAddress : [proposalAddress]

        const proposalPromises = addresses.map(async (proposalAddr: string) => {
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

            return {
              id: (pid as bigint)?.toString() || '0',
              title: (name as string) || 'Untitled Proposal',
              description: (description as string) || 'No description available',
              status,
              createdBy: (admin as string) || '',
              createdAt: startTime ? new Date(Number(startTime as bigint) * 1000).toISOString() : new Date().toISOString(),
              address: proposalAddr,
              endTime: Number((endTime as bigint) || 0),
              startTime: Number((startTime as bigint) || 0),
            } as Proposal
          } catch (proposalError) {
            console.error(`Error fetching data for proposal ${proposalAddr}:`, proposalError)
            return null
          }
        })

        const settled = await Promise.allSettled(proposalPromises)

        const proposalData: Proposal[] = []
        for (const res of settled) {
          if (res.status === 'fulfilled' && res.value) {
            proposalData.push(res.value)
          }
        }

        setProposals(proposalData)
      } catch (err) {
        console.error('Error fetching proposal details:', err)
        setProposals([])
      } finally {
        setIsLoadingProposals(false)
      }
    }

    void fetchProposalDetails()
  }, [proposalAddress, publicClient])

  return {
    proposals,
    isLoading: isLoadingAddress || isLoadingProposals,
    error,
    refetch: () => {
      // trigger refetch of address then details
      if (typeof refetchAddress === 'function') refetchAddress()
    },
  }
}