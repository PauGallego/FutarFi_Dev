"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot } from "recharts"
import type { AuctionData, UserBalance } from "@/lib/types"
import { formatUnits } from "viem"
import { useEffect, useMemo, useState } from "react"
import { Clock } from "lucide-react"
import { useTheme } from "next-themes"
import { useAccount, useReadContract } from "wagmi"
import { proposal_abi } from "@/contracts/proposal-abi"
import { marketToken_abi } from "@/contracts/marketToken-abi"

interface AuctionViewProps {
  auctionData: AuctionData
  userBalance: UserBalance
  proposalAddress?: `0x${string}`
}

const AnimatedDot = (props: any) => {
  const { cx, cy, color } = props
  return (
    <g>
      <circle cx={cx} cy={cy} r={8} fill={color} className="animate-pulse" opacity={0.6} />
      <circle cx={cx} cy={cy} r={5} fill={color} />
      <circle cx={cx} cy={cy} r={2} fill="hsl(var(--background))" />
    </g>
  )
}

function useCountdown(endTime: bigint) {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = Math.floor(Date.now() / 1000)
      const end = Number(endTime)
      const difference = end - now

      if (difference > 0) {
        const days = Math.floor(difference / (60 * 60 * 24))
        const hours = Math.floor((difference % (60 * 60 * 24)) / (60 * 60))
        const minutes = Math.floor((difference % (60 * 60)) / 60)
        const seconds = Math.floor(difference % 60)
        setTimeLeft({ days, hours, minutes, seconds })
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      }
    }

    calculateTimeLeft()
    const interval = setInterval(calculateTimeLeft, 1000)

    return () => clearInterval(interval)
  }, [endTime])

  return timeLeft
}

export function AuctionView({ auctionData, userBalance, proposalAddress }: AuctionViewProps) {
  const { resolvedTheme } = useTheme()
  const { address } = useAccount()
  const isDark = resolvedTheme === "dark"
  const lineColor = isDark ? "#22c55e" : "#000000" // green in dark, black in light
  const textColor = lineColor
  const timeLeft = useCountdown(auctionData.auctionEndTime)
  const totalBids = auctionData.yesTotalBids + auctionData.noTotalBids
  const isSuccessful = totalBids >= auctionData.minimumRequired

  // Onchain token addresses
  const { data: yesTokenAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "yesToken" })
  const { data: noTokenAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "noToken" })

  // Onchain remaining (cap - totalSupply) and user balances
  const { data: yesCap } = useReadContract({ address: yesTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "cap" })
  const { data: yesSupply } = useReadContract({ address: yesTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "totalSupply" })
  const { data: yesDecimals } = useReadContract({ address: yesTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "decimals" })
  const { data: noCap } = useReadContract({ address: noTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "cap" })
  const { data: noSupply } = useReadContract({ address: noTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "totalSupply" })
  const { data: noDecimals } = useReadContract({ address: noTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "decimals" })
  const { data: yesUserBal } = useReadContract({ address: yesTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "balanceOf", args: [address ?? "0x0000000000000000000000000000000000000000"] })
  const { data: noUserBal } = useReadContract({ address: noTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "balanceOf", args: [address ?? "0x0000000000000000000000000000000000000000"] })

  console.log("yesCap", yesCap)
  console.log("yesSupply", yesSupply)
  console.log("noCap", noCap)
  console.log("noSupply", noSupply)

  const yesRemaining = useMemo(() => {
    if (typeof yesCap === "bigint" && typeof yesSupply === "bigint") return yesCap - yesSupply
    return auctionData.yesRemainingMintable
  }, [yesCap, yesSupply, auctionData.yesRemainingMintable])
  const noRemaining = useMemo(() => {
    if (typeof noCap === "bigint" && typeof noSupply === "bigint") return noCap - noSupply
    return auctionData.noRemainingMintable
  }, [noCap, noSupply, auctionData.noRemainingMintable])

  const yesRemainingPercent = useMemo(() => {
    if (typeof yesCap === "bigint" && yesCap > 0n) return Number((yesRemaining * 100n) / yesCap)
    return Number((yesRemaining * 100n) / (auctionData.yesRemainingMintable + auctionData.yesTotalBids))
  }, [yesCap, yesRemaining, auctionData.yesRemainingMintable, auctionData.yesTotalBids])
  const noRemainingPercent = useMemo(() => {
    if (typeof noCap === "bigint" && noCap > 0n) return Number((noRemaining * 100n) / noCap)
    return Number((noRemaining * 100n) / (auctionData.noRemainingMintable + auctionData.noTotalBids))
  }, [noCap, noRemaining, auctionData.noRemainingMintable, auctionData.noTotalBids])

  const startPrice = 1.0
  const endPrice = 0.0
  const chartData = auctionData.priceHistory.map((point, index) => {
    const progress = index / (auctionData.priceHistory.length - 1)
    return {
      time: new Date(point.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      price: startPrice - progress * (startPrice - endPrice),
      isCurrent: false,
    }
  })

  // Add current price point with flashing dot
  const currentProgress = chartData.length / (chartData.length + 1)
  const currentPoint = {
    time: "Now",
    price: startPrice - currentProgress * (startPrice - endPrice),
    isCurrent: true,
  }
  const chartDataWithCurrent = [...chartData, currentPoint]

  return (
    <div className="space-y-6">
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Auction Price Evolution</CardTitle>
              <CardDescription>Linear price decrease over time</CardDescription>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-foreground">
                  {timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m
                </span>
              </div>
              <Badge
                variant={isSuccessful ? "default" : "secondary"}
                className="bg-primary/10 text-primary border-primary/20"
              >
                {isSuccessful ? "Minimum Reached" : "In Progress"}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartDataWithCurrent} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="time"
                  stroke={textColor}
                  fontSize={12}
                  tick={{ fill: textColor }}
                />
                <YAxis
                  stroke={textColor}
                  fontSize={12}
                  domain={[0, 1]}
                  tick={{ fill: textColor }}
                  label={{ value: "Price", angle: -90, position: "insideLeft", fill: textColor }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: textColor,
                  }}
                  formatter={(value: any) => [`$${value.toFixed(4)}`, "Price"]}
                />
                <Line
                  type="linear"
                  dataKey="price"
                  stroke={lineColor}
                  strokeWidth={2}
                  dot={(dotProps: any) => {
                    if (dotProps.payload.isCurrent) {
                      return <AnimatedDot {...dotProps} color={lineColor} key={`animated-${dotProps.index}`} />
                    }
                    return <Dot {...dotProps} r={0} key={`dot-${dotProps.index}`} />
                  }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Token Prices and Remaining Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* YES Token Card */}
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-primary">tYES Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Price</p>
              <p className="text-3xl font-bold text-primary">${auctionData.yesCurrentPrice.toFixed(4)}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining Available</span>
                <span className="font-mono text-foreground">{formatUnits(yesRemaining, (yesDecimals as number) ?? 18)}</span>
              </div>
              <Progress value={yesRemainingPercent} className="h-2 bg-primary/20" />
              <p className="text-xs text-muted-foreground text-right">{yesRemainingPercent.toFixed(1)}% remaining</p>
            </div>

            <div className="pt-2 border-t border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Your Balance</p>
              <p className="font-mono text-lg text-foreground">{formatUnits((yesUserBal as bigint) ?? userBalance.yesTokens, (yesDecimals as number) ?? 18)}</p>
            </div>
          </CardContent>
        </Card>

        {/* NO Token Card */}
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg text-destructive">tNO Token</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Current Price</p>
              <p className="text-3xl font-bold text-destructive">${auctionData.noCurrentPrice.toFixed(4)}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining Available</span>
                <span className="font-mono text-foreground">{formatUnits(noRemaining, (noDecimals as number) ?? 18)}</span>
              </div>
              <Progress value={noRemainingPercent} className="h-2 bg-destructive/20 [&>div]:bg-destructive" />
              <p className="text-xs text-muted-foreground text-right">{noRemainingPercent.toFixed(1)}% remaining</p>
            </div>

            <div className="pt-2 border-t border-destructive/20">
              <p className="text-xs text-muted-foreground mb-1">Your Balance</p>
              <p className="font-mono text-lg text-foreground">{formatUnits((noUserBal as bigint) ?? userBalance.noTokens, (noDecimals as number) ?? 18)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
