import { useReadContract, useAccount, useChainId, usePublicClient } from 'wagmi'
import { proposalManager_abi } from '@/contracts/proposalManager-abi'
import { proposal_abi } from '@/contracts/proposal-abi'
import { getContractAddress } from '@/contracts/constants'
import { useEffect, useState } from 'react'
import type { Proposal } from '@/lib/types'


export function useGetAllProposals() {
  const chainId = useChainId()
  const contractAddress = getContractAddress(chainId, 'PROPOSAL_MANAGER')
  const publicClient = usePublicClient()


  // Fetch all proposal addresses - this doesn't require user to be connected
  const { data: proposalAddresses, isLoading: isLoadingAddresses, error } = useReadContract({
    address: contractAddress as `0x${string}`,
    abi: proposalManager_abi,
    functionName: 'getAllProposals',
    query: {
      enabled: !!contractAddress,
    },
  })

  const [proposals, setProposals] = useState<Proposal[]>([])
  const [isLoadingProposals, setIsLoadingProposals] = useState(false)
  const [reloadCounter, setReloadCounter] = useState(0)

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
            // Read functions that actually exist in the frontend ABI
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
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'id' }),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'admin' }),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'title' }),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'description' }),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'state' }),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'auctionStartTime' }).catch(() => 0),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'auctionEndTime' }).catch(() => 0),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'liveStart' }).catch(() => 0),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'liveEnd' }).catch(() => 0),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'liveDuration' }).catch(() => 0),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'subjectToken' }).catch(() => '0x0000000000000000000000000000000000000000'),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'pyUSD' }).catch(() => '0x0000000000000000000000000000000000000000'),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'minToOpen' }).catch(() => 0),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'maxCap' }).catch(() => 0n),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'yesAuction' }).catch(() => '0x0000000000000000000000000000000000000000'),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'noAuction' }).catch(() => '0x0000000000000000000000000000000000000000'),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'yesToken' }).catch(() => '0x0000000000000000000000000000000000000000'),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'noToken' }).catch(() => '0x0000000000000000000000000000000000000000'),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'treasury' }).catch(() => '0x0000000000000000000000000000000000000000'),
            ])

            const stateMap = ['Auction', 'Live', 'Resolved', 'Cancelled'] as const;
            const stateStr = stateMap[Number(stateVal ?? 0)];

            // Convert on-chain seconds to JS milliseconds for Date()
            const auctionStartTimeMs = Number(auctionStartTime ?? 0) * 1000
            const auctionEndTimeMs = Number(auctionEndTime ?? 0) * 1000
            const liveStartMs = Number(liveStart ?? 0) * 1000
            const liveEndMs = Number(liveEnd ?? 0) * 1000

            return {
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
              target: '0x0000000000000000000000000000000000000000' as `0x${string}`,
              data: '0x',
              address: proposalAddress as `0x${string}`,
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
  }, [proposalAddresses, publicClient, reloadCounter])

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
      // Incrementing reloadCounter will trigger the useEffect to run again
      setReloadCounter((r) => r + 1)
    }
  }
}
