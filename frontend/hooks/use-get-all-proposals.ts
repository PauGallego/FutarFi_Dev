import { useReadContract, useAccount, useChainId, usePublicClient } from 'wagmi'
import { proposalManager_abi } from '@/contracts/proposalManager-abi'
import { proposal_abi } from '@/contracts/proposal-abi'
import { getContractAddress } from '@/contracts/constants'
import { useEffect, useState } from 'react'

export interface Proposal {
  id: string;
  admin: string;
  title: string;
  description: string;
  state: 'Auction' | 'Live' | 'Resolved' | 'Cancelled';

  // Auction / live times (timestamps in seconds)
  auctionStartTime: number;
  auctionEndTime: number;
  liveStart: number;
  liveEnd: number;
  liveDuration: number;

  // Token / treasury / auctions
  subjectToken: `0x${string}`;
  pyUSD: `0x${string}`;
  minToOpen: string; // uint256 kept as string to avoid precision loss in JS
  maxCap: string;    // uint256 kept as string
  yesAuction: `0x${string}`;
  noAuction: `0x${string}`;
  yesToken: `0x${string}`;
  noToken: `0x${string}`;
  treasury: `0x${string}`;

  // Execution target and calldata
  target: `0x${string}`;
  data: string; // raw bytes (hex string)

  // Contract address (proposal instance)
  address: `0x${string}`;
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
            // Read only functions present in proposal_abi to avoid TS ABI mismatches
            const [
              id,
              admin,
              title,
              description,
              stateVal,
              startTime,
              endTime,
              isActive,
              proposalExecuted,
              proposalEnded
            ] = await Promise.all([
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'id' }),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'admin' }),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'title' }),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'description' }),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'state' }),
              // startTime/endTime exist in the frontend ABI; use them as auction/live fallbacks
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'startTime' }).catch(() => null),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'endTime' }).catch(() => null),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'isActive' }).catch(() => null),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'proposalExecuted' }).catch(() => null),
              publicClient.readContract({ address: proposalAddress as `0x${string}`, abi: proposal_abi, functionName: 'proposalEnded' }).catch(() => null),
            ])

            const stateMap = ['Auction', 'Live', 'Resolved', 'Cancelled'] as const;
            const stateStr = stateMap[Number(stateVal ?? 0)];

            // Fallbacks: use startTime/endTime for auctionStartTime/auctionEndTime, live fields default to 0
            const auctionStartTimeVal = Number((startTime as bigint) || 0)
            const auctionEndTimeVal = Number((endTime as bigint) || 0)

            return {
              id: (id as bigint)?.toString() || '0',
              admin: (admin as string) || '',
              title: (title as string) || 'Untitled Proposal',
              description: (description as string) || 'No description available',
              state: stateStr,
              auctionStartTime: auctionStartTimeVal,
              auctionEndTime: auctionEndTimeVal,
              liveStart: 0,
              liveEnd: 0,
              liveDuration: 0,
              subjectToken: '0x0000000000000000000000000000000000000000' as `0x${string}`,
              pyUSD: '0x0000000000000000000000000000000000000000' as `0x${string}`,
              minToOpen: '0',
              maxCap: '0',
              yesAuction: '0x0000000000000000000000000000000000000000' as `0x${string}`,
              noAuction: '0x0000000000000000000000000000000000000000' as `0x${string}`,
              yesToken: '0x0000000000000000000000000000000000000000' as `0x${string}`,
              noToken: '0x0000000000000000000000000000000000000000' as `0x${string}`,
              treasury: '0x0000000000000000000000000000000000000000' as `0x${string}`,
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
