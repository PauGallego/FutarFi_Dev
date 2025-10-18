"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import {
    useAccount,
    useChainId,
    useSwitchChain,
    useReadContract,
    useWriteContract,
    useWaitForTransactionReceipt,
} from "wagmi"
import { parseUnits, formatUnits, type Address } from "viem"
import { toast } from "sonner"
import { getContracts } from "@/lib/contracts"
import { marketToken_abi } from "@/contracts/marketToken-abi"
import { market_abi } from "@/contracts/market-abi"
import { getContractAddress } from "@/contracts/constants"
import type { MarketOption, TradeAction } from "@/lib/types"


interface TradePanelProps {
    yesMarketAddress: Address
    noMarketAddress: Address
    proposalStatus: string
}

export function TradePanel({ yesMarketAddress, noMarketAddress, proposalStatus }: TradePanelProps) {
    const { address, isConnected } = useAccount()
    const { switchChain } = useSwitchChain()

    const chainId = useChainId()
    const contracts = getContracts(chainId)

    const [selectedMarket, setSelectedMarket] = useState<MarketOption>("YES")
    const [tradeAction, setTradeAction] = useState<TradeAction>("BUY")
    const [amount, setAmount] = useState("")
    const [slippage, setSlippage] = useState("0.5")

    const marketAddress = selectedMarket === "YES" ? yesMarketAddress : noMarketAddress
    const optionIndex = selectedMarket === "YES" ? 0 : 1

    // Read base token balance
    const { data: baseBalance } = useReadContract({
        address: contracts.baseToken as Address,
        abi: marketToken_abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    })

    // Read base token decimals
    const { data: baseDecimals } = useReadContract({
        address: contracts.baseToken as Address,
        abi: marketToken_abi,
        functionName: "decimals",
    })

    // Read market token balance
    const { data: marketBalance } = useReadContract({
        address: marketAddress,
        abi: marketToken_abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    })

    // Read current price
    const { data: currentPrice } = useReadContract({
        address: marketAddress,
        abi: market_abi,
        functionName: "getMarketTypePrice",
        args: [optionIndex],
    })

    // Read allowance for buy action
    const { data: allowance } = useReadContract({
        address: contracts.baseToken as Address,
        abi: marketToken_abi,
        functionName: "allowance",
        args: address ? [address, marketAddress] : undefined,
        query: { enabled: !!address && tradeAction === "BUY" },
    })

    const { writeContract, data: txHash, isPending: isWritePending } = useWriteContract()
    const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })

    const decimals = baseDecimals || 6
    const needsApproval =
        tradeAction === "BUY" && amount && allowance !== undefined && parseUnits(amount, decimals) > allowance

    const isMarketClosed = proposalStatus === "closed" || proposalStatus === "executed"
    const canTrade = isConnected && !isMarketClosed && amount && Number.parseFloat(amount) > 0

    useEffect(() => {
        if (isTxSuccess) {
            toast.success("Transaction successful!", {
                description: "Your trade has been executed.",
                action: {
                    label: "View",
                    onClick: () => window.open(getExplorerTxUrl(chainId, txHash!), "_blank"),
                },
            })
            setAmount("")
        }
    }, [isTxSuccess, chainId, txHash])

    const handleApprove = async () => {
        if (!amount) return

        try {
            writeContract({
                address: contracts.baseToken as Address,
                abi: marketToken_abi,
                functionName: "approve",
                args: [marketAddress, parseUnits(amount, decimals)],
            })
            toast.loading("Approving tokens...")
        } catch (error) {
            toast.error("Approval failed", {
                description: error instanceof Error ? error.message : "Unknown error",
            })
        }
    }

    const handleTrade = async () => {
        if (!amount || !canTrade) return

        try {
            if (tradeAction === "BUY") {
                writeContract({
                    address: marketAddress,
                    abi: market_abi,
                    functionName: "buy",
                    args: [optionIndex, parseUnits(amount, decimals)],
                })
            } else {
                writeContract({
                    address: marketAddress,
                    abi: market_abi,
                    functionName: "sell",
                    args: [optionIndex, parseUnits(amount, 18)],
                })
            }
            toast.loading("Processing transaction...")
        } catch (error) {
            toast.error("Transaction failed", {
                description: error instanceof Error ? error.message : "Unknown error",
            })
        }
    }

    const estimatedReceive =
        amount && currentPrice ? (Number.parseFloat(amount) * Number(formatUnits(currentPrice, 18))).toFixed(4) : "0.00"

    return (
        <div className="space-y-4">

            {/* Market Selector */}
            <div className="space-y-2">
                <Label className="text-sm font-medium">Select Market</Label>
                <div className="relative p-1 rounded-xl bg-muted border-2 border-border">
                    <div
                        className={`
                absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl
                transition-all duration-300 ease-out
                ${selectedMarket === "YES" ? "left-1 bg-primary" : "left-[calc(50%+3px)] bg-destructive"}
                `}
                    />

                    {/* YES Button */}
                    <button
                        onClick={() => setSelectedMarket("YES")}
                        className={`
                relative z-10 w-1/2 px-6 py-3 rounded-xl font-semibold text-sm
                transition-colors duration-300
                ${selectedMarket === "YES" ? "text-black" : "text-muted-foreground hover:text-foreground"}
                `}
                    >
                        YES
                    </button>

                    {/* NO Button */}
                    <button
                        onClick={() => setSelectedMarket("NO")}
                        className={`
                relative z-10 w-1/2 px-6 py-3 rounded-xl font-semibold text-sm
                transition-colors duration-300
                ${selectedMarket === "NO" ? "text-black" : "text-muted-foreground hover:text-foreground"}
                `}
                    >
                        NO
                    </button>
                </div>
            </div>

            {/* Balances */}
            {isConnected && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Balances</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Base Token:</span>
                            <span className="font-mono">{baseBalance ? formatUnits(baseBalance, decimals) : "0.00"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">{selectedMarket} Token:</span>
                            <span className="font-mono">{marketBalance ? formatUnits(marketBalance, 18) : "0.00"}</span>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Trade Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Trade</CardTitle>
                    <CardDescription>Buy or sell {selectedMarket} market tokens</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Tabs value={tradeAction} onValueChange={(v) => setTradeAction(v as TradeAction)}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="BUY">Buy</TabsTrigger>
                            <TabsTrigger value="SELL">Sell</TabsTrigger>
                        </TabsList>
                    </Tabs>

                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount {tradeAction === "BUY" ? "(Base Token)" : "(Market Token)"}</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={!isConnected || isMarketClosed}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="slippage">Slippage Tolerance (%)</Label>
                        <Input
                            id="slippage"
                            type="number"
                            placeholder="0.5"
                            value={slippage}
                            onChange={(e) => setSlippage(e.target.value)}
                            disabled={!isConnected || isMarketClosed}
                        />
                    </div>

                    {/* Quote Panel */}
                    <div className="rounded-lg border bg-muted/50 p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Current Price:</span>
                            <span className="font-mono">${currentPrice ? formatUnits(currentPrice, 18) : "0.00"}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Estimated Receive:</span>
                            <span className="font-mono">{estimatedReceive}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Price Impact:</span>
                            <span className="font-mono text-yellow-500">~0.1%</span>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    {!isConnected ? (
                        <Button className="w-full" disabled>
                            Connect Wallet
                        </Button>
                    ) : isMarketClosed ? (
                        <Button className="w-full" disabled>
                            Market Closed
                        </Button>
                    ) : needsApproval ? (
                        <Button className="w-full" onClick={handleApprove} disabled={isWritePending || isTxPending}>
                            {isWritePending || isTxPending ? "Approving..." : "Approve"}
                        </Button>
                    ) : (
                        <Button className="w-full" onClick={handleTrade} disabled={!canTrade || isWritePending || isTxPending}>
                            {isWritePending || isTxPending ? "Processing..." : tradeAction === "BUY" ? "Buy" : "Sell"}
                        </Button>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

function getExplorerTxUrl(chainId: number, txHash: string): string {
    const explorers: Record<number, string> = {
        1: "https://etherscan.io",
        11155111: "https://sepolia.etherscan.io",
        42161: "https://arbiscan.io",
        421614: "https://sepolia.arbiscan.io",
    }
    const baseUrl = explorers[chainId] || explorers[1]
    return `${baseUrl}/tx/${txHash}`
}
