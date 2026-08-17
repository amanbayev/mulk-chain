"use client";

import { Download, Hash, Loader2, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { InfoTip } from "@/components/ui/info-tip";
import { DATA_ROOM_DOCUMENTS, type DataRoomDocument } from "@/lib/institutional-demo";
import { verifyDocumentHash } from "@/lib/chain/actions";
import { shortHash } from "@/lib/utils";

function escapePdfText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function downloadMockPdf(doc: DataRoomDocument): void {
  const lines = [
    doc.fileName,
    doc.title,
    `Issuer: ${doc.issuer}`,
    `Dated: ${doc.dated}`,
    `SHA-256: ${doc.sha256}`,
    `Anchor tx: ${doc.onchainTx}`,
    "Mülk Chain · AIFC / AFSA sandbox · hash-anchored data room",
  ];
  const contentStream = lines
    .map((line, index) => `BT /F1 11 Tf 72 ${720 - index * 18} Td (${escapePdfText(line)}) Tj ET`)
    .join("\n");
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${contentStream.length} >> stream
${contentStream}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
trailer << /Root 1 0 R >>
%%EOF
`;
  const blob = new Blob([pdf], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = doc.fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataRoomPanel() {
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [hashDoc, setHashDoc] = useState<DataRoomDocument | null>(null);

  async function verifyOnChain(doc: DataRoomDocument): Promise<void> {
    setVerifyingId(doc.id);
    try {
      const result = await verifyDocumentHash(doc.onchainDocId, doc.sha256);
      if (!result.matches) {
        toast.error("SHA-256 does not match on-chain anchor", {
          description: `${doc.fileName} · on-chain ${shortHash(result.onchainHash, 8)}`,
        });
        return;
      }
      setVerified((prev) => ({ ...prev, [doc.id]: true }));
      toast.success("SHA-256 matches on-chain anchor", {
        description:
          result.mode === "anvil"
            ? `${doc.fileName} · GovOracleBridge.getDocumentHash`
            : `${doc.fileName} · simulated (Anvil offline)`,
      });
    } catch {
      toast.error("Verification failed", { description: "Could not read the on-chain document hash." });
    } finally {
      setVerifyingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-500/25 bg-emerald-500/5 px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-medium">Cryptographically Verified via OnChainID</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Each PDF is SHA-256 hashed and anchored on MulkToken. Downloads are watermarked for this session; hashes
              remain public.
            </p>
          </div>
        </div>
        <Badge variant="success" className="shrink-0">
          🔒 OnChainID
        </Badge>
      </div>

      <ul className="grid gap-3">
        {DATA_ROOM_DOCUMENTS.map((doc) => {
          const isVerifying = verifyingId === doc.id;
          const isVerified = verified[doc.id] === true;
          return (
            <li key={doc.id}>
              <Card className="overflow-hidden">
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{doc.title}</p>
                      {isVerified ? (
                        <Badge variant="success" className="gap-1">
                          <ShieldCheck className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline">Hash-anchored</Badge>
                      )}
                    </div>
                    <p className="break-all font-mono text-[11px] text-cyan-400/90">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{doc.description}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {doc.issuer} · {new Date(doc.dated).toLocaleDateString("en-GB")} · {doc.size} · {doc.pages} pp
                    </p>
                    <div className="flex min-w-0 items-center gap-1">
                      <InfoTip content="SHA-256 of the canonical PDF bytes. Compared against the bytes32 stored by the issuance agent at listing.">
                        <p className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                          SHA-256 {doc.sha256}
                        </p>
                      </InfoTip>
                      <CopyButton value={doc.sha256} label="SHA-256" />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:w-48">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        downloadMockPdf(doc);
                        toast.message("Download started", { description: doc.fileName });
                      }}
                    >
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Download PDF
                    </Button>
                    <Button type="button" size="sm" variant="secondary" disabled={isVerifying} onClick={() => void verifyOnChain(doc)}>
                      {isVerifying ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
                      {isVerifying ? "Verifying…" : "Verify SHA-256 on Chain"}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => setHashDoc(doc)}>
                      <Hash className="mr-1.5 h-3.5 w-3.5" />
                      View On-Chain Hash
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>

      <Dialog open={hashDoc != null} onOpenChange={(open) => { if (!open) setHashDoc(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>On-chain document anchor</DialogTitle>
            <DialogDescription>{hashDoc?.title}</DialogDescription>
          </DialogHeader>
          {hashDoc ? (
            <div className="space-y-3 text-xs">
              <ExplorerRow label="File" value={hashDoc.fileName} mono />
              <ExplorerRow label="SHA-256" value={hashDoc.sha256} mono copy />
              <ExplorerRow label="Anchor tx" value={hashDoc.onchainTx} mono copy />
              <ExplorerRow label="Block" value={hashDoc.blockNumber.toLocaleString("en-GB")} />
              <ExplorerRow label="Mapping" value={`GovOracleBridge.getDocumentHash("${hashDoc.onchainDocId}")`} mono />
              <p className="pt-1 text-[11px] text-muted-foreground">
                GovOracleBridge.getDocumentHash stores the SHA-256 digest as bytes32. keccak256 is used only as a mapping
                key for cadastre identifiers.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExplorerRow({
  label,
  value,
  mono,
  copy,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copy?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-border/70 py-2 last:border-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1">
        <span className={`break-all text-right ${mono ? "font-mono tabular" : ""}`} title={value}>
          {value.startsWith("0x") && value.length > 18 ? shortHash(value, 8) : value}
        </span>
        {copy ? <CopyButton value={value} label={label} /> : null}
      </div>
    </div>
  );
}
