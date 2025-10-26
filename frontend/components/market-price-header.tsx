"use client"

import { useGetTop } from "@/hooks/use-get-top"

export function MarketPriceHeader({ proposalId }: { proposalId: string }) {
  const yes = useGetTop({ proposalId, market: 'YES', auto: true, pollMs: 3000 })
  const no = useGetTop({ proposalId, market: 'NO', auto: true, pollMs: 3000 })

  return (
    <div className="mb-4 relative h-24">
      {/* Top-aligned pills to touch the top edge aligned with chart start */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-4">
        <div className="p-2 rounded-md border w-[48%]">
          <div className="text-xs text-muted-foreground mb-1">tYES</div>
          <div className="text-2xl font-semibold">{yes.mid !== undefined ? `$${yes.mid.toFixed(4)}` : '-'}</div>
          <div className="mt-1 text-xs flex justify-between">
            <span className="text-green-600 dark:text-emerald-400">Bid {yes.bestBid !== undefined ? `$${yes.bestBid.toFixed(4)}` : '-'}</span>
            <span className="text-red-600 dark:text-red-400">Ask {yes.bestAsk !== undefined ? `$${yes.bestAsk.toFixed(4)}` : '-'}</span>
          </div>
        </div>
        <div className="p-2 rounded-md border w-[48%]">
          <div className="text-xs text-muted-foreground mb-1">tNO</div>
          <div className="text-2xl font-semibold">{no.mid !== undefined ? `$${no.mid.toFixed(4)}` : '-'}</div>
          <div className="mt-1 text-xs flex justify-between">
            <span className="text-green-600 dark:text-emerald-400">Bid {no.bestBid !== undefined ? `$${no.bestBid.toFixed(4)}` : '-'}</span>
            <span className="text-red-600 dark:text-red-400">Ask {no.bestAsk !== undefined ? `$${no.bestAsk.toFixed(4)}` : '-'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
