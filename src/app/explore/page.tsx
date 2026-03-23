"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { formatEther } from "viem";
import { useReadContracts } from "wagmi";
import BrutalistConnectButton from "@/components/BrutalistConnectButton";
import capsulMeArtifact from "@/lib/CapsulMe.json";

const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;

// Helper hooks inside
function useCountdown(unlockTimeSecs: bigint) {
  const [remaining, setRemaining] = useState<{ d: number; h: number; m: number; s: number } | null>(null);

  useEffect(() => {
    const unlockTime = Number(unlockTimeSecs) * 1000;
    const update = () => {
      const diff = unlockTime - Date.now();
      if (diff <= 0) return setRemaining(null);
      setRemaining({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / 1000 / 60) % 60),
        s: Math.floor((diff / 1000) % 60),
      });
    };
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [unlockTimeSecs]);

  return remaining;
}

export default function ExplorePage() {
  const headerRef = useRef<HTMLElement>(null);
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);

  // We are building an MVP and since 'totalSupply' does not exist on the current version of the contract,
  // we will mass-read the first 100 capsules via multicall! This avoids getting blocked by RPC log limits
  // on free nodes like "query returned more than 10000 results".
  useEffect(() => {
    // We just statically generate exactly 100 IDs to read
    const ids = Array.from({ length: 100 }).map((_, i) => BigInt(i));
    setTokenIds(ids);
  }, []);

  // 2. Batch fetch capsule data
  const capsuleContracts = tokenIds.map(id => ({
    address: CONTRACT_ADDRESS,
    abi: capsulMeArtifact.abi,
    functionName: "capsules",
    args: [id],
  }));

  const { data: capsulesRaw, isLoading: capsuleDataLoading } = useReadContracts({
    contracts: capsuleContracts as any,
    query: { enabled: capsuleContracts.length > 0 },
  });

  const isLoading = (capsuleContracts.length > 0 && capsuleDataLoading);

  const capsules = (capsulesRaw || []).map((res, idx) => {
    if (res.status === "success" && res.result) {
      const r = res.result as any[];
      // If sender is zero address, the capsule hasn't been minted yet!
      if (r[2] === "0x0000000000000000000000000000000000000000") return null;

      // Hide private capsules from the Global Feed!
      if ((r[6] as string).startsWith("_PRIV_:")) return null;
      
      return {
        id: tokenIds[idx],
        data: {
          encryptedCID: r[0],
          unlockTime:   r[1],
          sender:       r[2],
          receiver:     r[3],
          tier:         Number(r[4]),
          status:       Number(r[5]),
          title:        r[6],
          lockedValue:  r[7],
          capsuleType:  Number(r[8]),
          pactThreshold: Number(r[9]),
          pactSignCount: Number(r[10]),
        }
      };
    }
    return null;
  })
  .filter(Boolean)
  .reverse(); // Reverse to show latest first!

  return (
    <main className="min-h-screen py-10 px-6 max-w-7xl mx-auto flex flex-col gap-10">
      
      {/* ── Header ── */}
      <header ref={headerRef} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-black pb-6 w-full">
        <div className="w-full md:w-auto">
          <Link href="/dashboard" className="font-mono-code text-xs font-bold text-black/50 uppercase tracking-widest hover:text-black mb-3 flex items-center gap-2">
            ← Back to Dashboard
          </Link>
          <Link href="/" className="inline-block transition-transform hover:-translate-y-1 hover:drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none">
              CAPSUL<span className="text-black">.ME</span>
            </h1>
          </Link>
          <p className="font-mono-code text-sm font-bold mt-1 uppercase tracking-widest text-black/70 animate-pulse">
            [ Public Global Explorer ]
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <Link href="/mycapsule" className="flex items-center justify-center gap-2 bg-transparent text-black py-3 sm:py-2 px-4 font-black uppercase tracking-widest text-xs border-2 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all text-center">
            [■] My Vault
          </Link>
          <div className="w-full sm:w-auto flex justify-center sm:block">
            <BrutalistConnectButton />
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <div className="flex flex-col gap-8">
        
        {/* Info Banner */}
        <div className="blueprint-panel bg-[#FF5FCF] border-2 border-black p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-[4px_4px_0_rgba(0,0,0,1)] hover:shadow-[6px_6px_0_rgba(0,0,0,1)] transition-shadow">
          <div>
            <h2 className="font-black text-xl uppercase tracking-tighter">Live Network Feed</h2>
            <p className="font-mono-code text-xs font-bold opacity-80 mt-1 uppercase">Monitor all time-locks globally. Ciphertexts remain secure.</p>
          </div>
          <div className="font-mono-code text-[10px] font-bold tracking-widest bg-black text-[#FF5FCF] px-4 py-2 uppercase">
            {capsules.length} CAPSULES INDEXED
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-24 flex flex-col items-center justify-center gap-6 opacity-50">
            <div className="w-16 h-16 border-4 border-black border-t-transparent animate-spin rounded-full"></div>
            <p className="font-mono-code font-bold uppercase tracking-widest animate-pulse">Scanning Global Mempool...</p>
          </div>
        )}

        {/* Global Feed Grid */}
        {!isLoading && capsules.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {capsules.map((cap) => (
              <ExplorerCard key={cap?.id.toString()} data={cap?.data} id={cap?.id!} />
            ))}
          </div>
        )}

      </div>
    </main>
  );
}

// ── Minimal Card for Explorer ──
function ExplorerCard({ data, id }: { data: any, id: bigint }) {
  const remaining = useCountdown(data.unlockTime);
  const isReady = remaining === null;
  const isOpened = data.status === 2;
  const unlockDate = new Date(Number(data.unlockTime) * 1000);

  return (
    <div className="border-2 border-black flex flex-col overflow-hidden bg-white shadow-[4px_4px_0_rgba(0,0,0,1)] hover:-translate-y-1 transition-transform group">
      
      {/* Header */}
      <div className="bg-black text-[#FF5FCF] flex justify-between px-3 py-2 font-mono-code text-[10px] font-bold uppercase">
         <span>Capsule #{id.toString()}</span>
         <span className="opacity-70">{isOpened ? "[ EXECUTED ]" : isReady ? "[ UNLOCKED ]" : "[ SECURED ]"}</span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        {/* Title */}
        <h3 className="font-black uppercase tracking-tight text-xl leading-tight truncate">
          {data.title || "Untitled Fragment"}
        </h3>

        {/* Addresses */}
        <div className="flex flex-col gap-2 font-mono-code text-[10px] border-l-[3px] border-black/10 pl-3">
           <div className="flex justify-between w-full">
             <span className="opacity-40 font-bold uppercase">From:</span>
             <span className="font-bold">{data.sender.substring(0,6)}...{data.sender.slice(-4)}</span>
           </div>
           <div className="flex justify-between w-full">
             <span className="opacity-40 font-bold uppercase">To:</span>
             <span className="font-bold">{data.receiver.substring(0,6)}...{data.receiver.slice(-4)}</span>
           </div>
        </div>

        <hr className="border-black/10" />

        {/* Timestamp */}
        <div className="flex items-center justify-between font-mono-code">
           <span className="text-[10px] uppercase font-bold opacity-40">Unlock Event:</span>
           <span className={`text-xs font-bold ${isOpened ? "text-green-600" : isReady ? "text-yellow-600 animate-pulse" : "text-black"}`}>
             {unlockDate.toLocaleDateString("en-US", { dateStyle: "medium" })}
           </span>
        </div>

        {/* Values */}
        {!!data.lockedValue && data.lockedValue > 0n && (
          <div className="bg-black/5 border border-black p-2 flex justify-between items-center mt-2 group-hover:bg-[#FF5FCF] group-hover:text-black transition-colors">
            <span className="font-mono-code text-[9px] uppercase font-bold">ETH Payload</span>
            <span className="font-black text-xs">◈ {Number(formatEther(data.lockedValue)).toFixed(4).replace(/\.?0+$/, "")} ETH</span>
          </div>
        )}
      </div>
    </div>
  );
}
