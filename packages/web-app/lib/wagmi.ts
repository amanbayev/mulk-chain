import { http, createConfig } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const PUBLIC_ROLLUP_RPC = "https://sepolia-rollup.arbitrum.io/rpc";

function resolveRpcUrl(): string {
  const configured = process.env.NEXT_PUBLIC_RPC_URL?.trim();
  if (configured && /^https?:\/\//i.test(configured)) return configured;
  if (typeof window !== "undefined") {
    if (configured?.startsWith("/")) return configured;
    return "/api/rpc";
  }
  return (
    process.env.ARBITRUM_SEPOLIA_RPC_URL ??
    process.env.ARBITRUM_SEPOLIA_RPC_FALLBACK ??
    process.env.ANVIL_RPC_URL ??
    PUBLIC_ROLLUP_RPC
  );
}

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors: [injected({ shimDisconnect: true })],
  ssr: true,
  transports: {
    [arbitrumSepolia.id]: http(resolveRpcUrl()),
  },
});
