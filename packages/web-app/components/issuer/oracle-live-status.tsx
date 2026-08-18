"use client";

import { Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { InfoTip } from "@/components/ui/info-tip";
import { useLoopingCountdown } from "@/hooks/use-countdown";
import { sleep } from "@/lib/chain/client";
import { updateCadastreStatus } from "@/lib/chain/actions";
import { ORACLE_DEMO } from "@/lib/institutional-demo";
import { explorerTxUrl } from "@/lib/chain/addresses";
import { formatDurationHms, shortHash } from "@/lib/utils";

interface OraclePayload {
  cadastre_id: string;
  encumbrance_status: "CLEAN_PLEDGE" | "ENCUMBERED" | "ARRESTED" | "REVOKED";
  block_number: number;
  inspected_at: string;
  consensus: string;
  tx_hash: `0x${string}`;
}

function buildPayload(txHash: `0x${string}`, blockNumber: number): OraclePayload {
  return {
    cadastre_id: ORACLE_DEMO.cadastreAlias,
    encumbrance_status: ORACLE_DEMO.encumbranceStatus,
    block_number: blockNumber,
    inspected_at: new Date().toISOString(),
    consensus: `${ORACLE_DEMO.syncedNodes}/${ORACLE_DEMO.consensusNodes}`,
    tx_hash: txHash,
  };
}

export function OracleLiveStatus() {
  const { remainingSeconds, ready } = useLoopingCountdown(ORACLE_DEMO.pollPeriodSeconds, ORACLE_DEMO.pollOffsetSeconds);
  const [checking, setChecking] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}`>(ORACLE_DEMO.lastCheckTx);
  const [blockNumber, setBlockNumber] = useState(ORACLE_DEMO.blockNumber);
  const payload = buildPayload(txHash, blockNumber);

  async function triggerManual(): Promise<void> {
    setChecking(true);
    try {
      const [, result] = await Promise.all([sleep(1_200), updateCadastreStatus(ORACLE_DEMO.cadastreAlias)]);
      setBlockNumber(result.blockNumber);
      setTxHash(result.transactionHash);
      toast.success("Gov-Bridge verification complete", {
        description:
          result.mode === "anvil"
            ? `EGKN ${ORACLE_DEMO.encumbranceStatus} · ${shortHash(result.transactionHash, 6)}`
            : `EGKN ${ORACLE_DEMO.encumbranceStatus} · simulated (chain unreachable)`,
      });
    } catch {
      toast.error("Gov-Bridge verification failed", { description: "Anvil RPC call could not be completed." });
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="label-caps text-cyan-400">Gov-Oracle · Smart Bridge</p>
            <p className="mt-1 text-sm font-medium">Live cadastre sync</p>
          </div>
          <Badge variant="success" className="gap-1.5 normal-case tracking-normal">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            Active ({ORACLE_DEMO.syncedNodes}/{ORACLE_DEMO.consensusNodes} Consensus Nodes Synced)
          </Badge>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="min-w-0 rounded-md border border-border/80 bg-card/60 px-3 py-2.5">
            <p className="label-caps">Next automated polling cycle</p>
            <p className="mt-1 font-mono text-sm tabular">
              {ready ? `Next sync with Smart Bridge: in ${formatDurationHms(remainingSeconds)}` : "Syncing clock…"}
            </p>
          </div>
          <div className="min-w-0 rounded-md border border-border/80 bg-card/60 px-3 py-2.5">
            <p className="label-caps">Last check tx hash</p>
            <div className="mt-1 flex items-center gap-1">
              <InfoTip content="Opens the Arbiscan Sepolia explorer for this Gov-Oracle attestation.">
                <a
                  href={explorerTxUrl(txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate font-mono text-sm text-cyan-400 hover:underline"
                  onClick={() => {
                    toast.message("Explorer", {
                      description: `https://sepolia.arbiscan.io · ${payload.encumbrance_status}`,
                    });
                  }}
                >
                  {shortHash(txHash, 4)}
                </a>
              </InfoTip>
              <CopyButton value={txHash} label="Tx hash" />
            </div>
          </div>
          <div className="flex min-w-0 items-end sm:col-span-2 lg:col-span-1">
            <Button type="button" variant="outline" className="w-full" disabled={checking} onClick={() => void triggerManual()}>
              {checking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              {checking ? "Querying EGKN…" : "Trigger Manual Gov-Bridge Verification"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
