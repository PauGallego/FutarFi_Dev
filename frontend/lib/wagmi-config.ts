import { http } from "wagmi"
import { mainnet, sepolia, hedera, hederaTestnet } from "wagmi/chains"
import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { hederaWithIcon, hederaTestnetWithIcon, anvil } from './custom-chains'

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "00000000000000000000000000000000" // 32 character fallback

// Validate projectId length
if (projectId.length !== 32) {
  console.warn('WalletConnect Project ID must be exactly 32 characters long. Please set NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID in your environment variables.')
}


export const config = getDefaultConfig({
  appName: "FutarFi",
  projectId,
  chains: [mainnet, sepolia, hederaWithIcon, hederaTestnetWithIcon, anvil],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),         
    [hederaWithIcon.id]: http(),          
    [hederaTestnetWithIcon.id]: http(),
    [anvil.id]: http(),
  },
  ssr: true,
})
