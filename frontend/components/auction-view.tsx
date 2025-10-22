"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts"
import type { AuctionData, UserBalance } from "@/lib/types"
import { formatUnits } from "viem"

interface AuctionViewProps {
  auctionData: AuctionData
  userBalance: UserBalance
}

export function AuctionView({ auctionData, userBalance }: AuctionViewProps) {
  const totalBids = auctionData.yesTotalBids + auctionData.noTotalBids
  const progressPercent = Number((totalBids * BigInt(100)) / auctionData.minimumRequired)
  const isSuccessful = totalBids >= auctionData.minimumRequired

  const chartData = auctionData.priceHistory.map((point) => ({
    time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    YES: point.yesPrice,
    NO: point.noPrice,
  }))

  return (
    <div className="space-y-6">
      {/* Auction Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Dutch Auction Phase</CardTitle>
            <Badge variant={isSuccessful ? "default" : "secondary"}>
              {isSuccessful ? "Minimum Reached" : "In Progress"}
            </Badge>
          </div>
          <CardDescription>Place bids for YES or NO tokens at current auction prices</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Bids</span>
              <span className="font-mono">
                {formatUnits(totalBids, 6)} / {formatUnits(auctionData.minimumRequired, 6)}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-500"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">{progressPercent.toFixed(1)}% of minimum</p>
          </div>

          {/* Current Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border bg-primary/5 p-4">
              <p className="text-sm text-muted-foreground mb-1">YES Price</p>
              <p className="text-2xl font-bold text-primary">${auctionData.yesCurrentPrice.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatUnits(auctionData.yesTotalBids, 6)} bids</p>
            </div>
            <div className="rounded-lg border bg-destructive/5 p-4">
              <p className="text-sm text-muted-foreground mb-1">NO Price</p>
              <p className="text-2xl font-bold text-destructive">${auctionData.noCurrentPrice.toFixed(4)}</p>
              <p className="text-xs text-muted-foreground mt-1">{formatUnits(auctionData.noTotalBids, 6)} bids</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs text-muted-foreground mb-2">Your Tokens</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-primary">tYES:</span>
                  <span className="font-mono">{formatUnits(userBalance.yesTokens, 18)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-destructive">tNO:</span>
                  <span className="font-mono">{formatUnits(userBalance.noTokens, 18)}</span>
                </div>
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2">Remaining Mintable</p>
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-primary">tYES:</span>
                  <span className="font-mono">{formatUnits(auctionData.yesRemainingMintable, 18)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-destructive">tNO:</span>
                  <span className="font-mono">{formatUnits(auctionData.noRemainingMintable, 18)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Evolution Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Price Evolution</CardTitle>
          <CardDescription>Linear price decrease over auction duration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} domain={[0, 1]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--background))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="YES" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="NO" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
