"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Dot } from "recharts"
import type { AuctionData, UserBalance } from "@/lib/types"
import { formatUnits } from "viem"
import { useEffect, useMemo, useState, useCallback } from "react"
import { Clock } from "lucide-react"
import { useTheme } from "next-themes"
import { useAccount, useReadContract, usePublicClient } from "wagmi"
import { proposal_abi } from "@/contracts/proposal-abi"
import { marketToken_abi } from "@/contracts/marketToken-abi"
import { dutchAuction_abi } from "@/contracts/dutchAuction-abi"
import { treasury_abi } from "@/contracts/treasury-abi"

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
  const publicClient = usePublicClient()
  const isDark = resolvedTheme === "dark"
  const lineColor = isDark ? "#22c55e" : "#000000" // green in dark, black in light
  const textColor = lineColor
  const timeLeft = useCountdown(auctionData.auctionEndTime)
  const totalBids = auctionData.yesTotalBids + auctionData.noTotalBids

  // Onchain token addresses
  const { data: yesTokenAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "yesToken" })
  const { data: noTokenAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "noToken" })
  // Onchain auction addresses (for current on-chain price)
  const { data: yesAuctionAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "yesAuction" })
  const { data: noAuctionAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "noAuction" })
  const { data: treasuryAddr } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "treasury" })
  // Onchain minimum required to open (PyUSD, 6d or 18d per contract). Here it's uint256, represents PyUSD amount.
  const { data: minToOpen } = useReadContract({ address: proposalAddress, abi: proposal_abi, functionName: "minToOpen" })
  const minimumRequired = (typeof minToOpen === "bigint" ? minToOpen : auctionData.minimumRequired)

  // Onchain remaining (cap - totalSupply) and user balances
  const { data: yesCap } = useReadContract({ address: yesTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "cap" })
  const { data: yesSupply } = useReadContract({ address: yesTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "totalSupply" })
  const { data: yesDecimals } = useReadContract({ address: yesTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "decimals" })
  const { data: noCap } = useReadContract({ address: noTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "cap" })
  const { data: noSupply } = useReadContract({ address: noTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "totalSupply" })
  const { data: noDecimals } = useReadContract({ address: noTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "decimals" })
  const { data: yesUserBal } = useReadContract({ address: yesTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "balanceOf", args: [address ?? "0x0000000000000000000000000000000000000000"] })
  const { data: noUserBal } = useReadContract({ address: noTokenAddr as `0x${string}` | undefined, abi: marketToken_abi, functionName: "balanceOf", args: [address ?? "0x0000000000000000000000000000000000000000"] })

  // On-chain raised amounts (PyUSD, 6d) from Treasury
  const { data: potYes } = useReadContract({ address: treasuryAddr as `0x${string}` | undefined, abi: treasury_abi, functionName: "potYes" })
  const { data: potNo } = useReadContract({ address: treasuryAddr as `0x${string}` | undefined, abi: treasury_abi, functionName: "potNo" })

  // On-chain current price (6 decimals) like the trade panel
  const { data: yesPrice6d } = useReadContract({ address: yesAuctionAddr as `0x${string}` | undefined, abi: dutchAuction_abi, functionName: "priceNow" })
  const { data: noPrice6d } = useReadContract({ address: noAuctionAddr as `0x${string}` | undefined, abi: dutchAuction_abi, functionName: "priceNow" })

  // Local overrides to allow instant updates after tx + periodic polling
  const [yesRemOverride, setYesRemOverride] = useState<bigint | undefined>(undefined)
  const [noRemOverride, setNoRemOverride] = useState<bigint | undefined>(undefined)
  const [yesBalOverride, setYesBalOverride] = useState<bigint | undefined>(undefined)
  const [noBalOverride, setNoBalOverride] = useState<bigint | undefined>(undefined)
  const [yesPriceNow, setYesPriceNow] = useState<number>(auctionData.yesCurrentPrice)
  const [noPriceNow, setNoPriceNow] = useState<number>(auctionData.noCurrentPrice)
  const [raisedOverride, setRaisedOverride] = useState<bigint | undefined>(undefined)

  useEffect(() => { if (typeof yesPrice6d === "bigint") setYesPriceNow(Number(yesPrice6d) / 1_000_000) }, [yesPrice6d])
  useEffect(() => { if (typeof noPrice6d === "bigint") setNoPriceNow(Number(noPrice6d) / 1_000_000) }, [noPrice6d])

  // Compute remaining using overrides first, then on-chain read, then fallback to provided auctionData
  const yesRemaining = useMemo(() => {
    if (typeof yesRemOverride === "bigint") return yesRemOverride
    if (typeof yesCap === "bigint" && typeof yesSupply === "bigint") return yesCap - yesSupply
    return auctionData.yesRemainingMintable
  }, [yesRemOverride, yesCap, yesSupply, auctionData.yesRemainingMintable])

  const noRemaining = useMemo(() => {
    if (typeof noRemOverride === "bigint") return noRemOverride
    if (typeof noCap === "bigint" && typeof noSupply === "bigint") return noCap - noSupply
    return auctionData.noRemainingMintable
  }, [noRemOverride, noCap, noSupply, auctionData.noRemainingMintable])

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

  // Manual refetch to update instantly after tx and every 10s
  const refetchNow = useCallback(async () => {
    try {
      if (!publicClient) return
      // Prices
      if (yesAuctionAddr) {
        const p: bigint = await publicClient.readContract({ address: yesAuctionAddr as any, abi: dutchAuction_abi, functionName: "priceNow" })
        setYesPriceNow(Number(p) / 1_000_000)
      }
      if (noAuctionAddr) {
        const p: bigint = await publicClient.readContract({ address: noAuctionAddr as any, abi: dutchAuction_abi, functionName: "priceNow" })
        setNoPriceNow(Number(p) / 1_000_000)
      }
      // Remaining caps
      if (yesTokenAddr) {
        const [capNow, tsNow] = await Promise.all([
          publicClient.readContract({ address: yesTokenAddr as any, abi: marketToken_abi, functionName: "cap" }) as Promise<bigint>,
          publicClient.readContract({ address: yesTokenAddr as any, abi: marketToken_abi, functionName: "totalSupply" }) as Promise<bigint>,
        ])
        setYesRemOverride((capNow ?? 0n) - (tsNow ?? 0n))
      }
      if (noTokenAddr) {
        const [capNow, tsNow] = await Promise.all([
          publicClient.readContract({ address: noTokenAddr as any, abi: marketToken_abi, functionName: "cap" }) as Promise<bigint>,
          publicClient.readContract({ address: noTokenAddr as any, abi: marketToken_abi, functionName: "totalSupply" }) as Promise<bigint>,
        ])
        setNoRemOverride((capNow ?? 0n) - (tsNow ?? 0n))
      }
      // User balances
      if (address && yesTokenAddr) {
        const bal: bigint = await publicClient.readContract({ address: yesTokenAddr as any, abi: marketToken_abi, functionName: "balanceOf", args: [address] })
        setYesBalOverride(bal ?? 0n)
      }
      if (address && noTokenAddr) {
        const bal: bigint = await publicClient.readContract({ address: noTokenAddr as any, abi: marketToken_abi, functionName: "balanceOf", args: [address] })
        setNoBalOverride(bal ?? 0n)
      }
      // Treasury raised (PyUSD 6d)
      if (treasuryAddr) {
        const [py, pn] = await Promise.all([
          publicClient.readContract({ address: treasuryAddr as any, abi: treasury_abi, functionName: "potYes" }) as Promise<bigint>,
          publicClient.readContract({ address: treasuryAddr as any, abi: treasury_abi, functionName: "potNo" }) as Promise<bigint>,
        ])
        setRaisedOverride((py ?? 0n) + (pn ?? 0n))
      }
    } catch {
      // silent
    }
  }, [publicClient, yesAuctionAddr, noAuctionAddr, yesTokenAddr, noTokenAddr, address, treasuryAddr])

  useEffect(() => {
    const onTx = () => { void refetchNow() }
    window.addEventListener("auction:tx", onTx)
    const id = setInterval(() => { void refetchNow() }, 10_000)
    return () => {
      window.removeEventListener("auction:tx", onTx)
      clearInterval(id)
    }
  }, [refetchNow])

  // Keep overrides in sync with baseline reads if they were not set yet
  useEffect(() => { if (yesBalOverride === undefined && typeof yesUserBal === "bigint") setYesBalOverride(yesUserBal) }, [yesBalOverride, yesUserBal])
  useEffect(() => { if (noBalOverride === undefined && typeof noUserBal === "bigint") setNoBalOverride(noUserBal) }, [noBalOverride, noUserBal])

  // Compute total raised (PyUSD 6d) preferring on-chain Treasury values
  const totalRaised = useMemo(() => {
    if (typeof raisedOverride === "bigint") return raisedOverride
    if (typeof potYes === "bigint" || typeof potNo === "bigint") return ((potYes as bigint) ?? 0n) + ((potNo as bigint) ?? 0n)
    // fallback to provided auctionData sums if present (assumed 6d)
    return (auctionData.yesTotalBids ?? 0n) + (auctionData.noTotalBids ?? 0n)
  }, [raisedOverride, potYes, potNo, auctionData.yesTotalBids, auctionData.noTotalBids])
  const isSuccessful = totalRaised >= minimumRequired

  // Percent progress toward minimum required (total raised vs minimum)
  const minProgressPercent = useMemo(() => {
    if ((minimumRequired ?? 0n) <= 0n) return 100
    const pctTimes10 = (totalRaised * 1000n) / minimumRequired // one decimal precision
    const pct = Number(pctTimes10) / 10
    return pct > 100 ? 100 : pct
  }, [totalRaised, minimumRequired])

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
              <p className="text-3xl font-bold text-primary">${yesPriceNow.toFixed(4)}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining Available</span>
                <span className="font-mono text-foreground">{formatUnits(yesRemaining, (yesDecimals as number) ?? 18)}</span>
              </div>
              <Progress value={yesRemainingPercent} className="h-2 bg-primary/20" />
              <p className="text-xs text-muted-foreground text-right">{yesRemainingPercent.toFixed(1)}% remaining</p>
            </div>

            {/* Progress to Minimum */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">To Minimum</span>
                <span className="font-mono text-foreground">{minProgressPercent.toFixed(1)}%</span>
              </div>
              <Progress value={minProgressPercent} className="h-2 bg-primary/20" />
              <p className="text-xs text-muted-foreground text-right">{minProgressPercent.toFixed(1)}% of minimum</p>
            </div>

            <div className="pt-2 border-t border-primary/20">
              <p className="text-xs text-muted-foreground mb-1">Your Balance</p>
              <p className="font-mono text-lg text-foreground">{(Number((yesBalOverride ?? yesUserBal) ?? 0n) / 1e6).toFixed(6)}</p>
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
              <p className="text-3xl font-bold text-destructive">${noPriceNow.toFixed(4)}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Remaining Available</span>
                <span className="font-mono text-foreground">{formatUnits(noRemaining, (noDecimals as number) ?? 18)}</span>
              </div>
              <Progress value={noRemainingPercent} className="h-2 bg-destructive/20 [&>div]:bg-destructive" />
              <p className="text-xs text-muted-foreground text-right">{noRemainingPercent.toFixed(1)}% remaining</p>
            </div>

            {/* Progress to Minimum */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">To Minimum</span>
                <span className="font-mono text-foreground">{minProgressPercent.toFixed(1)}%</span>
              </div>
              <Progress value={minProgressPercent} className="h-2 bg-destructive/20 [&>div]:bg-destructive" />
              <p className="text-xs text-muted-foreground text-right">{minProgressPercent.toFixed(1)}% of minimum</p>
            </div>

            <div className="pt-2 border-t border-destructive/20">
              <p className="text-xs text-muted-foreground mb-1">Your Balance</p>
              <p className="font-mono text-lg text-foreground">{(Number((noBalOverride ?? noUserBal) ?? 0n) / 1e6).toFixed(6)}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
