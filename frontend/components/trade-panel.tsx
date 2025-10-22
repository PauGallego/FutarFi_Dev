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
import type { MarketOption, TradeAction } from "@/lib/types"


interface TradePanelProps {
    marketAddress: Address
    proposalStatus: string
}

export function TradePanel({ marketAddress, proposalStatus }: TradePanelProps) {
    const { address, isConnected } = useAccount()
    const { switchChain } = useSwitchChain()

    const chainId = useChainId()
    const contracts = getContracts(chainId)

    const [selectedMarket, setSelectedMarket] = useState<MarketOption>("YES")
    const [tradeAction, setTradeAction] = useState<TradeAction>("BUY")
    const [amount, setAmount] = useState("")
    const [slippage, setSlippage] = useState("0.5")

    const optionIndex: bigint = selectedMarket === "YES" ? BigInt(0) : BigInt(1)
    const optionBool = selectedMarket === "YES" ? true : false

    // Determine which market contract to interact with based on selection
º
    // Read proposal market collateral token address
    const { data: collateralAddress } = useReadContract({
        address: marketAddress,
        abi: market_abi,
        functionName: "collateralToken",
        query: { enabled: !!marketAddress },
    })

    // Read selected market option details (marketType) — 0 for YES, 1 for NO
    const { data: marketTypeData } = useReadContract({
        address: marketAddress,
        abi: market_abi,
        functionName: "marketType",
        args: [optionIndex],
        query: { enabled: !!marketAddress },
    })

    // Derive current price from marketTypeData (marketType returns: asset_price, totalCollateral, totalSupply)
    const currentPrice = marketTypeData
        ? (Array.isArray(marketTypeData) ? marketTypeData[0] : (marketTypeData as any).asset_price)
        : undefined

    // Read collateral token balance (the token this market accepts)
    const { data: collateralBalance } = useReadContract({
        address: collateralAddress as Address,
        abi: marketToken_abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address && !!collateralAddress },
    })

    // Read collateral token decimals
    const { data: collateralDecimals } = useReadContract({
        address: collateralAddress as Address,
        abi: marketToken_abi,
        functionName: "decimals",
        query: { enabled: !!collateralAddress },
    })

    // Read market token balance
    const { data: marketBalance } = useReadContract({
        address: marketAddress,
        abi: marketToken_abi,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: { enabled: !!address },
    })

    // Read allowance for buy action (on the collateral token)
    const { data: allowance } = useReadContract({
        address: collateralAddress as Address,
        abi: marketToken_abi,
        functionName: "allowance",
        args: address ? [address, marketAddress] : undefined,
        query: { enabled: !!address && !!collateralAddress && tradeAction === "BUY" },
    })

    const { writeContract, data: txHash, isPending: isWritePending } = useWriteContract()
    const { isLoading: isTxPending, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({ hash: txHash })

    const decimals = collateralDecimals || 6
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
                address: collateralAddress as Address,
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
                    args: [optionBool, parseUnits(amount, decimals)],
                })
            } else {
                writeContract({
                    address: marketAddress,
                    abi: market_abi,
                    functionName: "sell",
                    args: [optionBool, parseUnits(amount, 18)],
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
                            <span className="text-muted-foreground">Collateral Token:</span>
                            <span className="font-mono">{collateralBalance ? formatUnits(collateralBalance, decimals) : "0.00"}</span>
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
