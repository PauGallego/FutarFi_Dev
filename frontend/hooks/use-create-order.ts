import { useAccount } from 'wagmi'
import { useCallback, useState } from 'react'
import { useWalletAuth } from '@/hooks/use-wallet-auth'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

export type CreateOrderInput = {
  proposalId: string
  side: 'approve' | 'reject'
  orderType: 'buy' | 'sell'
  orderExecution: 'limit' | 'market'
  price: number
  amount: number
}

export type CreateOrderResult = {
  ok: boolean
  status: number
  data: any
}

export function useCreateOrder() {
  const { address, isConnected } = useAccount()
  const { auth, ensureAuth, loading: authLoading } = useWalletAuth()

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CreateOrderResult | null>(null)

  const createOrder = useCallback(async (input: CreateOrderInput): Promise<CreateOrderResult | null> => {
    setError(null)
    setResult(null)

    if (!isConnected || !address) {
      setError('Wallet not connected')
      return null
    }

    // Ensure we have auth
    if (!auth?.signature) {
      await ensureAuth()
    }

    if (!auth?.signature) {
      setError('Missing authentication')
      return null
    }

    setIsLoading(true)
    try {
      const body = {
        address,
        signature: auth.signature,
        message: auth.message,
        timestamp: auth.timestamp,
        orderType: input.orderType,
        orderExecution: input.orderExecution,
        price: input.orderExecution === 'market' ? 0 : Number(input.price || 0),
        amount: Number(input.amount || 0),
      }

      const url = `${API_BASE}/orderbooks/${input.proposalId}/${input.side}/orders`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      // Robust parse like wallet-test
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

      const out: CreateOrderResult = { ok: res.ok, status: res.status, data }
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

  return { createOrder, isLoading: isLoading || authLoading, error, result }
}
