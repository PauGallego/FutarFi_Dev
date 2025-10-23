import { useAccount } from 'wagmi'
import { useCallback, useState } from 'react'
import { useWalletAuth } from '@/hooks/use-wallet-auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export type CancelOrderResult = {
  ok: boolean
  status: number
  data: any
}

export function useCancelOrder() {
  const { address, isConnected } = useAccount()
  const { auth, ensureAuth, loading: authLoading } = useWalletAuth()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CancelOrderResult | null>(null)

  const cancelOrder = useCallback(async (orderId: string): Promise<CancelOrderResult | null> => {
    setError(null)
    setResult(null)

    if (!isConnected || !address) {
      setError('Wallet not connected')
      return null
    }

    if (!auth?.signature) {
      await ensureAuth()
    }
    if (!auth?.signature) {
      setError('Missing authentication')
      return null
    }

    setIsLoading(true)
    try {
      const res = await fetch(`${API_BASE}/orderbooks/orders/${orderId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          signature: auth.signature,
          message: auth.message,
          timestamp: auth.timestamp,
        }),
      })

      let data: any
      let responseText = ''
      try {
        responseText = await res.text()
        data = responseText ? JSON.parse(responseText) : { error: 'Empty response from server' }
      } catch (parseError) {
        data = {
          error: 'Invalid response format',
          responseText,
          status: res.status,
          statusText: res.statusText,
        }
      }

      const out: CancelOrderResult = { ok: res.ok, status: res.status, data }
      setResult(out)
      if (!res.ok) setError(data?.error || `Request failed with status ${res.status}`)
      return out
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [address, isConnected, auth?.signature, auth?.message, auth?.timestamp, ensureAuth])

  return { cancelOrder, isLoading: isLoading || authLoading, error, result }
}
