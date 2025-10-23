"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useAccount, useSignMessage } from "wagmi"

export type WalletAuth = {
  address: `0x${string}` | string
  message: string
  timestamp: number
  signature: string
  verified?: boolean
  verifiedAt?: number
}

const STORAGE_KEY = "futarfi:walletAuth"
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"
// Reverification TTL set to 1 hour
const AUTH_TTL_MS = 60 * 60 * 1000

// Deduplicate concurrent ensureAuth calls across the whole app
let globalEnsureAuthPromise: Promise<WalletAuth | null> | null = null
let globalEnsureAuthForAddr: string | null = null
let lastEnsureAt = 0
const ENSURE_DEBOUNCE_MS = 3000

function readStoredAuth(): WalletAuth | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeStoredAuth(value: WalletAuth | null) {
  if (typeof window === "undefined") return
  try {
    if (!value) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    }
  } catch {}
}

export function useWalletAuth() {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()

  const [auth, setAuth] = useState<WalletAuth | null>(() => readStoredAuth())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentAddr = (address || "").toLowerCase()
  const authAddr = (auth?.address || "").toLowerCase()

  const clearAuth = useCallback(() => {
    writeStoredAuth(null)
    setAuth(null)
  }, [])

  const verifyAuthWithServer = useCallback(async (candidate: WalletAuth) => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: candidate.address,
          signature: candidate.signature,
          message: candidate.message,
          timestamp: candidate.timestamp,
        }),
      })
      const ok = res.ok
      return ok
    } catch {
      return false
    }
  }, [])

  const ensureAuth = useCallback(async () => {
    if (!isConnected || !address) return null

    const addrLc = (address || "").toLowerCase()

    // If there's a global in-flight auth for this same address, wait for it
    if (globalEnsureAuthPromise && globalEnsureAuthForAddr === addrLc) {
      setLoading(true)
      try {
        const res = await globalEnsureAuthPromise
        if (res) setAuth(res)
        return res
      } finally {
        setLoading(false)
      }
    }

    // Small debounce to avoid rapid back-to-back prompts
    if (Date.now() - lastEnsureAt < ENSURE_DEBOUNCE_MS) {
      const stored = readStoredAuth()
      if (stored && (stored.address || "").toLowerCase() === currentAddr) {
        setAuth(stored)
        return stored
      }
    }

    setError(null)
    setLoading(true)

    globalEnsureAuthForAddr = addrLc
    globalEnsureAuthPromise = (async () => {
      try {
        // 1) If we have stored auth for the same address, verify or trust within TTL
        const stored = readStoredAuth()
        if (stored && (stored.address || "").toLowerCase() === currentAddr) {
          // Trust cached auth if verified within the last hour
          if (stored.verified && stored.verifiedAt && Date.now() - stored.verifiedAt < AUTH_TTL_MS) {
            setAuth(stored)
            return stored
          }
          const stillValid = await verifyAuthWithServer(stored)
          if (stillValid) {
            const updated = { ...stored, verified: true, verifiedAt: Date.now() }
            writeStoredAuth(updated)
            setAuth(updated)
            return updated
          }
          // stale/invalid -> clear and recreate
          writeStoredAuth(null)
        }

        // 2) Get message from backend
        const msgRes = await fetch(`${API_BASE}/auth/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        })
        if (!msgRes.ok) throw new Error(`Failed to get auth message (${msgRes.status})`)
        const msgData = await msgRes.json()
        if (!msgData?.message || !msgData?.timestamp) throw new Error("Invalid message payload")

        // 3) Sign message
        const signature = await signMessageAsync({ message: msgData.message })

        const candidate: WalletAuth = {
          address,
          message: msgData.message,
          timestamp: msgData.timestamp,
          signature,
        }

        // 4) Verify with backend (optional but recommended)
        const verified = await verifyAuthWithServer(candidate)
        const final: WalletAuth = {
          ...candidate,
          verified,
          verifiedAt: Date.now(),
        }

        writeStoredAuth(final)
        setAuth(final)
        return final
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error"
        setError(msg)
        return null
      }
    })()

    try {
      const result = await globalEnsureAuthPromise
      return result
    } finally {
      lastEnsureAt = Date.now()
      globalEnsureAuthPromise = null
      globalEnsureAuthForAddr = null
      setLoading(false)
    }
  }, [isConnected, address, currentAddr, signMessageAsync, verifyAuthWithServer])

  // Keep in sync with account changes (do NOT clear on disconnect; only clear if connected and address changes)
  useEffect(() => {
    if (isConnected && address) {
      if (auth && authAddr && authAddr !== currentAddr) {
        clearAuth()
      }
    }
  }, [isConnected, address, currentAddr, auth, authAddr, clearAuth])

  return {
    auth,
    loading,
    error,
    ensureAuth,
    clearAuth,
    setAuth: (val: WalletAuth | null) => {
      writeStoredAuth(val)
      setAuth(val)
    },
  }
}
