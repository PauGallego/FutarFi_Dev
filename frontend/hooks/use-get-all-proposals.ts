import { useReadContract, useAccount, useChainId, usePublicClient } from 'wagmi'
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

export function useGetAllProposals() {
  const chainId = useChainId()
  const contractAddress = getContractAddress(chainId, 'PROPOSAL_MANAGER')
  const publicClient = usePublicClient()

  // Add debug logging
  console.log('useGetAllProposals - chainId:', chainId)
  console.log('useGetAllProposals - contractAddress:', contractAddress)
  console.log('useGetAllProposals - publicClient:', !!publicClient)

  // Fetch all proposal addresses - this doesn't require user to be connected
  const { data: proposalAddresses, isLoading: isLoadingAddresses, error } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: proposalManager_abi,
    functionName: 'getAllProposals',
    query: {
      enabled: !!contractAddress,
    },
  })

  console.log('useGetAllProposals - proposalAddresses:', proposalAddresses)
  console.log('useGetAllProposals - isLoadingAddresses:', isLoadingAddresses)
  console.log('useGetAllProposals - error:', error)

  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoadingProposals, setIsLoadingProposals] = useState(false)

  useEffect(() => {
    async function fetchProposalDetails() {
      console.log('fetchProposalDetails called with:', { 
        proposalAddresses, 
        proposalAddressesLength: proposalAddresses?.length, 
        publicClient: !!publicClient 
      })
      
      if (!proposalAddresses || proposalAddresses.length === 0 || !publicClient) {
        console.log('Early return - no addresses or client')
        setProposals([])
        return
      }

      setIsLoadingProposals(true)
      console.log('Starting to fetch proposal details...')
      
      try {
        // Process each proposal address with better error handling
        const proposalData: Proposal[] = []
        
        // Use Promise.allSettled to handle individual proposal failures gracefully
        const proposalPromises = (proposalAddresses as string[]).map(async (proposalAddress) => {
          try {
            // Read all required data for this proposal in parallel
            const [
              id,
              admin,
              title,
              description,
              startTime,
              endTime,
              proposalExecuted,
              proposalEnded,
              isActive
            ] = await Promise.all([
              publicClient.readContract({
                address: proposalAddress as `0x${string}`,
                abi: proposal_abi,
                functionName: 'id',
              }),
              publicClient.readContract({
                address: proposalAddress as `0x${string}`,
                abi: proposal_abi,
                functionName: 'admin',
              }),
              publicClient.readContract({
                address: proposalAddress as `0x${string}`,
                abi: proposal_abi,
                functionName: 'title',
              }),
              publicClient.readContract({
                address: proposalAddress as `0x${string}`,
                abi: proposal_abi,
                functionName: 'description',
              }),
              publicClient.readContract({
                address: proposalAddress as `0x${string}`,
                abi: proposal_abi,
                functionName: 'startTime',
              }),
              publicClient.readContract({
                address: proposalAddress as `0x${string}`,
                abi: proposal_abi,
                functionName: 'endTime',
              }),
              publicClient.readContract({
                address: proposalAddress as `0x${string}`,
                abi: proposal_abi,
                functionName: 'proposalExecuted',
              }),
              publicClient.readContract({
                address: proposalAddress as `0x${string}`,
                abi: proposal_abi,
                functionName: 'proposalEnded',
              }),
              publicClient.readContract({
                address: proposalAddress as `0x${string}`,
                abi: proposal_abi,
                functionName: 'isActive',
              }),
            ])

            // Determine status based on contract state
            let status: 'active' | 'pending' | 'executed'
            if (proposalExecuted || proposalEnded) {
              status = 'executed'
            } else if (isActive) {
              status = 'active'
            } else {
              status = 'pending'
            }

            return {
              id: (id as bigint)?.toString() || '0',
              title: (title as string) || 'Untitled Proposal',
              description: (description as string) || 'No description available',
              status,
              createdBy: (admin as string) || '',
              createdAt: startTime ? new Date(Number(startTime as bigint) * 1000).toISOString() : new Date().toISOString(),
              address: proposalAddress,
              endTime: Number((endTime as bigint) || 0),
              startTime: Number((startTime as bigint) || 0),
            }
          } catch (proposalError) {
            console.error(`Error fetching data for proposal ${proposalAddress}:`, proposalError)
            return null // Return null for failed proposals
          }
        })

        // Wait for all proposals to be processed
        const results = await Promise.allSettled(proposalPromises)
        
        // Filter out failed proposals and null results
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value !== null) {
            proposalData.push(result.value)
          }
        })

        setProposals(proposalData)
        console.log('Final proposals set:', proposalData)
      } catch (error) {
        console.error('Error fetching proposal details:', error)
        setProposals([])
      } finally {
        setIsLoadingProposals(false)
      }
    }

    fetchProposalDetails()
  }, [proposalAddresses, publicClient])

  console.log('useGetAllProposals - returning:', { 
    proposals, 
    proposalsLength: proposals.length,
    isLoading: isLoadingAddresses || isLoadingProposals,
    error 
  })

  return {
    proposals,
    isLoading: isLoadingAddresses || isLoadingProposals,
    error,
    refetch: () => {
      // This would trigger a refetch of the proposal addresses
      // The useEffect will handle refetching the details
    }
  }
}
