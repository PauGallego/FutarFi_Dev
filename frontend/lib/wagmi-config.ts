import { http } from "wagmi"
import { mainnet, sepolia, hedera, hederaTestnet } from "wagmi/chains"
import { getDefaultConfig } from "@rainbow-me/rainbowkit"
import { hederaWithIcon, hederaTestnetWithIcon, anvil } from './custom-chains'

const projectId = process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || "demo-project-id"


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
