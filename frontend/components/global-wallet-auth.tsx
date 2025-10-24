'use client'

import { useEffect, useRef } from 'react'
import { useAccount } from 'wagmi'
import { useWalletAuth } from '@/hooks/use-wallet-auth'

/**
 * Mounts globally to automatically request, sign and verify
 * a wallet-auth message right after the wallet connects.
 * Stores the result in localStorage for reuse across the app.
 * Also re-verifies every 59 minutes while connected.
 */
export function GlobalWalletAuth() {
  const { address, isConnected } = useAccount()
  const { auth, ensureAuth } = useWalletAuth()

  // Avoid double runs
  const inFlightRef = useRef(false)
  const timeoutRef = useRef<number | null>(null)

  const TTL_MS = 59 * 60 * 1000

  // Kick once on connect/address change (no force, reuse if valid)
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

  // Schedule a precise re-auth based on the last verified time
  useEffect(() => {
    if (!isConnected || !address) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    const last = auth?.verifiedAt ?? 0
    const elapsed = Date.now() - last
    const delay = Math.max(0, TTL_MS - elapsed)

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // If never verified or already expired, trigger immediately
    if (!last || elapsed >= TTL_MS) {
      ensureAuth()
      // schedule the next renewal exactly in TTL
      timeoutRef.current = window.setTimeout(() => ensureAuth(), TTL_MS)
    } else {
      // schedule to renew when TTL hits
      timeoutRef.current = window.setTimeout(() => ensureAuth(), delay)
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [isConnected, address, auth?.verifiedAt, ensureAuth])

  // When the tab gains focus or becomes visible, ensure auth if TTL expired while inactive
  useEffect(() => {
    if (!isConnected) return

    const onWake = () => {
      const last = auth?.verifiedAt ?? 0
      if (!last || Date.now() - last >= TTL_MS) {
        ensureAuth()
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onWake()
    }

    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isConnected, auth?.verifiedAt, ensureAuth])

  return null
}
