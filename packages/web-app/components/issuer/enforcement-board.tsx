"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useAccount } from "wagmi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DEMO_ENFORCEMENT_SIGNERS, ENFORCEMENT_THRESHOLD } from "@/lib/constants";
import type { EnforcementAction, EnforcementRole } from "@/lib/api/types";
import { shortAddress } from "@/lib/utils";

interface Signature {
  role: EnforcementRole;
  address: string;
  at: string;
}

interface Proposal {
  id: number;
  action: EnforcementAction;
  caseRef: string;
  from?: string;
  to?: string;
  amount?: string;
  executed: boolean;
  cancelled: boolean;
  signatures: Signature[];
}

const INITIAL: Proposal[] = [
  {
    id: 14,
    action: "ForcedTransfer",
    caseRef: "AIFC-COURT-2026-014",
    from: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    amount: "400",
    executed: false,
    cancelled: false,
    signatures: [
      { role: "Legal", address: DEMO_ENFORCEMENT_SIGNERS[0].address, at: "2026-08-16T11:10:00+05:00" },
      { role: "Compliance", address: DEMO_ENFORCEMENT_SIGNERS[1].address, at: "2026-08-16T14:22:00+05:00" },
    ],
  },
  {
    id: 15,
    action: "Pause",
    caseRef: "INCIDENT-BRIDGE-OUTAGE",
    executed: false,
    cancelled: false,
    signatures: [
      { role: "Security", address: DEMO_ENFORCEMENT_SIGNERS[2].address, at: "2026-08-17T08:05:00+05:00" },
      { role: "Trustee", address: DEMO_ENFORCEMENT_SIGNERS[3].address, at: "2026-08-17T08:11:00+05:00" },
      { role: "Operations", address: DEMO_ENFORCEMENT_SIGNERS[4].address, at: "2026-08-17T08:18:00+05:00" },
    ],
  },
];

export function EnforcementBoard() {
  const { address } = useAccount();
  const [proposals, setProposals] = useState(INITIAL);
  const connectedRole = DEMO_ENFORCEMENT_SIGNERS.find((signer) => signer.address.toLowerCase() === address?.toLowerCase())?.role;

  function confirm(proposalId: number, role: EnforcementRole) {
    setProposals((current) =>
      current.map((proposal) => {
        if (proposal.id !== proposalId || proposal.executed || proposal.cancelled) return proposal;
        if (proposal.signatures.some((sig) => sig.role === role)) {
          toast.error("This role has already signed");
          return proposal;
        }
        const signer = DEMO_ENFORCEMENT_SIGNERS.find((row) => row.role === role);
        if (!signer) return proposal;
        const next: Proposal = {
          ...proposal,
          signatures: [...proposal.signatures, { role, address: signer.address, at: new Date().toISOString() }],
        };
        toast.success(`${role} confirmed proposal #${proposalId}`);
        return next;
      }),
    );
  }

  function execute(proposalId: number) {
    setProposals((current) =>
      current.map((proposal) => {
        if (proposal.id !== proposalId) return proposal;
        if (proposal.signatures.length < ENFORCEMENT_THRESHOLD) {
          toast.error("Threshold 3-of-5 not met");
          return proposal;
        }
        toast.success(`Proposal #${proposalId} executed`);
        return { ...proposal, executed: true };
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="label-caps">Enforcement controller</p>
          <h1 className="mt-1 text-xl font-medium tracking-tight">3-of-5 multi-sig board</h1>
        </div>
        <p className="text-xs text-muted-foreground">
          {connectedRole ? `Connected as ${connectedRole}` : "Simulation mode — confirm by role"}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-5">
        {DEMO_ENFORCEMENT_SIGNERS.map((signer) => (
          <Card key={signer.role}>
            <CardContent className="p-4">
              <p className="label-caps">{signer.role}</p>
              <p className="mt-2 text-xs tabular text-muted-foreground">{shortAddress(signer.address, 3)}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="space-y-4">
        {proposals.map((proposal) => (
          <ProposalCard
            key={proposal.id}
            proposal={proposal}
            connectedRole={connectedRole}
            onConfirm={confirm}
            onExecute={execute}
          />
        ))}
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  connectedRole,
  onConfirm,
  onExecute,
}: {
  proposal: Proposal;
  connectedRole?: EnforcementRole;
  onConfirm: (id: number, role: EnforcementRole) => void;
  onExecute: (id: number) => void;
}) {
  const count = proposal.signatures.length;
  const ready = count >= ENFORCEMENT_THRESHOLD && !proposal.executed;
  const roles = useMemo(() => DEMO_ENFORCEMENT_SIGNERS.map((row) => row.role), []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <p className="label-caps">Proposal #{proposal.id}</p>
          <CardTitle className="mt-1 text-base">{proposal.action}</CardTitle>
          <p className="mt-1 text-xs tabular text-muted-foreground">caseRef {proposal.caseRef}</p>
          {proposal.action === "ForcedTransfer" ? (
            <p className="mt-2 text-xs text-muted-foreground">
              {shortAddress(proposal.from ?? "")} → {shortAddress(proposal.to ?? "")} · {proposal.amount} tokens
            </p>
          ) : null}
        </div>
        <Badge variant={proposal.executed ? "success" : ready ? "gold" : "outline"}>
          {proposal.executed ? "Executed" : `${count} / ${ENFORCEMENT_THRESHOLD}`}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={(count / 5) * 100} />
        <div className="grid gap-2 sm:grid-cols-5">
          {roles.map((role) => {
            const signed = proposal.signatures.find((sig) => sig.role === role);
            return (
              <div key={role} className="rounded-md border border-border px-3 py-2">
                <p className="text-[11px] font-medium">{role}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{signed ? "Signed" : "Awaiting"}</p>
              </div>
            );
          })}
        </div>
        {!proposal.executed ? (
          <div className="flex flex-wrap gap-2">
            {(connectedRole ? [connectedRole] : roles).map((role) => (
              <Button
                key={role}
                type="button"
                size="sm"
                variant="outline"
                disabled={proposal.signatures.some((sig) => sig.role === role)}
                onClick={() => onConfirm(proposal.id, role)}
              >
                Confirm as {role}
              </Button>
            ))}
            <Button type="button" size="sm" disabled={!ready} onClick={() => onExecute(proposal.id)}>
              Execute
            </Button>
          </div>
        ) : null}
        <p className="text-[11px] text-muted-foreground">
          Officers cannot dual-sign. `forcedTransfer` and emergency pause are reachable only through this controller.
        </p>
      </CardContent>
    </Card>
  );
}
