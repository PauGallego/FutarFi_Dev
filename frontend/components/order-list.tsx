"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X } from "lucide-react"
import type { UserOrder } from "@/lib/types"

interface OrderListProps {
  orders: UserOrder[]
  onCancelOrder: (orderId: string) => void
}

export function OrderList({ orders, onCancelOrder }: OrderListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Orders</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {orders.map((order) => (
            <div key={order.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant={order.side === "BUY" ? "default" : "secondary"}>{order.side}</Badge>
                  <Badge variant="outline">{order.type}</Badge>
                  <span className="text-sm font-medium">
                    {order.amount} @ ${order.price.toFixed(4)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Filled: {((order.filled / order.amount) * 100).toFixed(0)}%</span>
                  <span>{new Date(order.timestamp).toLocaleString()}</span>
                </div>
              </div>
              {order.status === "pending" && (
                <Button size="sm" variant="ghost" onClick={() => onCancelOrder(order.id)}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
