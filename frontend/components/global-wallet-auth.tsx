'use client'

import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useWalletAuth } from '@/hooks/use-wallet-auth'

/**
 * Mounts globally to automatically request, sign and verify
 * a wallet-auth message right after the wallet connects.
 * Stores the result in localStorage for reuse across the app.
 */
export function GlobalWalletAuth() {
  const { address, isConnected } = useAccount()
  const { ensureAuth } = useWalletAuth()

  // Avoid double runs
  const inFlightRef = useRef(false)

  useEffect(() => {
    if (!isConnected || !address) return

    const run = async () => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        await ensureAuth()
      } finally {
        inFlightRef.current = false
      }
    }

    run()
  }, [isConnected, address, ensureAuth])

  return null
}
