"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { X } from "lucide-react"
import type { UserOrder } from "@/lib/types"
import { Progress } from "@/components/ui/progress"

interface OrderListProps {
  orders: UserOrder[]
  onCancelOrder: (orderId: string) => void
  error?: string | null
}

export function OrderList({ orders, onCancelOrder, error }: OrderListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Orders</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Error state */}
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : orders.length === 0 ? (
          // Empty state
          <div className="text-sm text-muted-foreground">No orders to display for this market.</div>
        ) : (
          // Show latest first and constrain height to ~4 rows with scroll for more
          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {[...orders].sort((a, b) => b.timestamp - a.timestamp).map((order) => {
              const fillPct = order.amount > 0 ? Math.min(100, Math.max(0, (order.filled / order.amount) * 100)) : 0
              const isFilled = order.status === 'filled' || (order.amount > 0 && order.filled >= order.amount)
              const isPartial = !isFilled && order.filled > 0
              const rowBg = isFilled
                ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200/50'
                : isPartial
                ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200/50'
                : 'bg-card'
              return (
                <div key={order.id} className={`flex items-center justify-between p-3 rounded-lg border min-h-20 ${rowBg} ${order.status === 'cancelled' ? 'opacity-60' : ''}`}>
                  <div className="flex-1 space-y-2 pr-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={order.side === "BUY" ? "default" : "secondary"}>{order.side}</Badge>
                      <Badge variant="outline">{order.type}</Badge>
                      <span className="text-sm font-medium">
                        {order.amount} @ ${order.price.toFixed(4)}
                      </span>
                      {isFilled && <Badge className="bg-emerald-600/15 text-emerald-700 dark:text-emerald-300 border-emerald-400/30">Filled</Badge>}
                      {isPartial && <Badge className="bg-amber-600/15 text-amber-700 dark:text-amber-300 border-amber-400/30">Partial</Badge>}
                      {order.status === 'cancelled' && <Badge variant="destructive">Cancelled</Badge>}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>Filled {order.filled.toFixed(4)} / {order.amount.toFixed(4)}</span>
                        <span>{fillPct.toFixed(0)}%</span>
                      </div>
                      <Progress value={fillPct} className="h-1.5" />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(order.timestamp).toLocaleString()}
                    </div>
                  </div>
                  {order.status === "pending" && (
                    <Button
                      size="sm"
                      variant="destructive"
                      className="hover:opacity-90"
                      onClick={() => onCancelOrder(order.id)}
                      title="Cancel order"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
