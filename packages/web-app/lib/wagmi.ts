import { http, createConfig } from "wagmi";
import { foundry } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8545";

export const wagmiConfig = createConfig({
  chains: [foundry],
  connectors: [injected({ shimDisconnect: true })],
  ssr: true,
  transports: {
    [foundry.id]: http(rpcUrl),
  },
});
