"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import BrutalistConnectButton from "@/components/BrutalistConnectButton";
import { formatEther } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import gsap from "gsap";
import capsulMeArtifact from "@/lib/CapsulMe.json";
import CapsuleCard, { type CapsuleData } from "@/components/CapsuleCard";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

type Tab = "self" | "sent" | "received";

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ tab }: { tab: Tab }) {
  const messages: Record<Tab, string> = {
    self:     "You haven't created any self-capsules yet.",
    sent:     "You haven't sent any capsules to others yet.",
    received: "You haven't received any capsules yet.",
  };
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-6 text-center">
      <div className="w-24 h-24 border-4 border-black/20 flex items-center justify-center">
        <svg className="w-12 h-12 opacity-20" viewBox="0 0 80 80">
          <rect x="10" y="20" width="60" height="40" rx="20" fill="none" stroke="black" strokeWidth="3"/>
          <rect x="10" y="20" width="30" height="40" rx="20" fill="black" opacity="0.1"/>
        </svg>
      </div>
      <div>
        <h3 className="font-black uppercase text-2xl tracking-tighter text-black/30">No Capsules Found</h3>
        <p className="font-mono-code text-sm font-bold text-black/30 uppercase tracking-widest mt-2">
          {messages[tab]}
        </p>
      </div>
      <Link
        href="/dashboard"
        className="bg-black text-[#FF5FCF] py-3 px-8 font-black uppercase tracking-widest text-sm border-2 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all"
      >
        Create First Capsule →
      </Link>
    </div>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="border-2 border-black/20 animate-pulse">
          <div className="aspect-square bg-black/10" />
          <div className="p-4 space-y-3">
            <div className="h-5 bg-black/10 w-3/4" />
            <div className="h-10 bg-black/10" />
            <div className="h-14 bg-black/10" />
            <div className="h-10 bg-black/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Typewriter Hook ──────────────────────────────────────────────────────────
function useTypewriter(text: string, active: boolean, speed = 18) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) { setDisplayed(""); setDone(false); return; }
    let i = 0;
    setDisplayed("");
    setDone(false);
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { setDone(true); clearInterval(iv); }
    }, speed);
    return () => clearInterval(iv);
  }, [text, active, speed]);

  return { displayed, done };
}

// ─── Fullscreen Cinematic Reveal Modal ────────────────────────────────────────
function FullscreenRevealModal({ rawPayload, title, lockedValue, onClose }: { rawPayload: string; title: string; lockedValue: bigint; onClose: () => void }) {
  const [phase, setPhase] = useState<"init" | "glitch" | "reveal">("init");
  const [glitchText, setGlitchText] = useState("");

  // Decoding logic
  let decodedMsg = rawPayload;
  let isEncrypted = false;
  if (rawPayload.startsWith("ENC_")) {
    const parts = rawPayload.split("_");
    if (parts.length >= 4) {
      try {
        decodedMsg = decodeURIComponent(escape(atob(parts.slice(3).join("_"))));
        isEncrypted = true;
      } catch (e) {
        decodedMsg = `[ CORRUPTED PAYLOAD ]\n${rawPayload}`;
      }
    }
  } else {
    decodedMsg = `[ LEGACY PAYLOAD ]\nCID: ${rawPayload}\n(Original text lost in previous update)`;
  }

  let finalReveal = decodedMsg;
  if (lockedValue > BigInt(0)) {
    finalReveal = `[ FUNDS CLAIMED: ${Number(formatEther(lockedValue)).toFixed(4).replace(/\.?0+$/, "")} ETH SECURED ]\n\n` + finalReveal;
  }

  const revealText = isEncrypted 
    ? `[ MESSAGE DECIPHERED ]\n================================\n\n${finalReveal}\n\n================================\n(Decrypted locally. Production relies on Lit Protocol TEEs.)`
    : finalReveal;

  const { displayed, done } = useTypewriter(revealText, phase === "reveal", 20);

  // Timing sequences
  useEffect(() => {
    const t1 = setTimeout(() => setPhase("glitch"), 1000); // init -> glitch
    const t2 = setTimeout(() => setPhase("reveal"), 2800);  // glitch -> reveal after 1.8s
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Chaotic glitch text generator
  useEffect(() => {
    let intv: ReturnType<typeof setInterval>;
    if (phase === "glitch") {
      intv = setInterval(() => {
        setGlitchText(Array.from({ length: 1200 }, () => "█▓▒░▄▀■□▪▫◆◇○●01ΧΨΩ".charAt(Math.floor(Math.random() * 19))).join(""));
      }, 50);
    }
    return () => clearInterval(intv!);
  }, [phase]);

  return (
    <div className="fixed inset-0 z-[9999] bg-black text-[#FF5FCF] flex items-center justify-center p-6 sm:p-12 overflow-hidden backdrop-blur-3xl">
      {/* Background Grid */}
      <div className="absolute inset-0 opacity-10 pointer-events-none"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,#FF5FCF 0,#FF5FCF 1px,transparent 0,transparent 32px), repeating-linear-gradient(90deg,#FF5FCF 0,#FF5FCF 1px,transparent 0,transparent 32px)" }}
      />
      
      {/* ── INIT PHASE ── */}
      {phase === "init" && (
        <div className="relative z-10 flex flex-col items-center gap-6 animate-pulse">
          <div className="w-24 h-24 border-4 border-[#FF5FCF] border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(255,95,207,0.5)]"></div>
          <p className="font-mono-code text-2xl font-black uppercase tracking-widest text-white drop-shadow-[0_0_10px_#FF5FCF]">[ INITIALIZING TEE ENCLAVE ]</p>
        </div>
      )}

      {/* ── GLITCH FAST FORWARD ── */}
      {phase === "glitch" && (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#FF5FCF]/20 select-none">
          <p className="w-full text-center break-all font-mono-code text-[14px] leading-tight text-[#FF5FCF] opacity-70">
            {glitchText}
          </p>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black px-10 py-6 border-4 border-[#FF5FCF] shadow-[10px_10px_0_rgba(255,95,207,0.8)]">
             <p className="font-black text-4xl uppercase animate-bounce drop-shadow-[0_0_20px_white] text-white tracking-widest">DECRYPTING...</p>
          </div>
        </div>
      )}

      {/* ── REVEAL CONSOLE ── */}
      {phase === "reveal" && (
        <div className="relative z-10 w-[95%] sm:w-full max-w-4xl bg-[#111] border-[3px] border-[#FF5FCF] shadow-[8px_8px_0_rgba(255,95,207,0.4)] sm:shadow-[16px_16px_0_rgba(255,95,207,0.4)] animate-[fadeInUp_0.6s_ease-out]">
          
          {/* Top Bar */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b-[3px] border-[#FF5FCF] bg-[#FF5FCF]/10">
            <div className="flex items-center gap-2 sm:gap-3 overflow-hidden">
              <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-red-500 border border-black shadow shrink-0"></span>
              <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-yellow-400 border border-black shadow shrink-0"></span>
              <span className="w-3 h-3 sm:w-4 sm:h-4 rounded-full bg-green-400 border border-black shadow shrink-0"></span>
              <span className="font-mono-code font-bold text-xs sm:text-sm text-[#FF5FCF] ml-2 sm:ml-4 uppercase tracking-[0.2em] truncate">{title.replace(/\s+/g, "_")}.PAY</span>
            </div>
            {done && <button onClick={onClose} className="font-black hover:text-white transition-colors text-xl sm:text-2xl leading-none px-2 shrink-0">[x]</button>}
          </div>

          {/* Typewriter Output */}
          <div className="p-4 sm:p-8 md:p-12 font-mono-code text-base sm:text-xl md:text-2xl leading-relaxed whitespace-pre-wrap min-h-[40vh] max-h-[60vh] overflow-y-auto text-white">
            <span className="text-[#FF5FCF]">root@capsul.me:~$ </span>
            {displayed}
            {!done ? <span className="animate-[pulse_0.4s_ease-in-out_infinite] bg-white text-black ml-1">█</span> : null}
          </div>

          {/* Close Action */}
          {done && (
            <div className="p-4 sm:p-6 border-t-[3px] border-[#FF5FCF] bg-black flex justify-end">
              <button onClick={onClose} className="w-full sm:w-auto bg-[#FF5FCF] text-black font-black uppercase tracking-widest py-3 sm:py-4 px-6 sm:px-10 text-sm sm:text-lg border-2 border-[#FF5FCF] hover:bg-black hover:text-[#FF5FCF] hover:shadow-[0_0_30px_rgba(255,95,207,0.6)] transition-all transform hover:scale-105 active:scale-95">
                DISCONNECT
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MyCapsulePage() {
  const { isConnected, address } = useAccount();
  const [activeTab, setActiveTab] = useState<Tab>("self");
  const [refreshKey, setRefreshKey] = useState(0);
  const [revealData, setRevealData] = useState<{ payload: string; title: string; lockedValue: bigint } | null>(null);
  const headerRef = useRef(null);
  const contentRef = useRef(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo([headerRef.current, contentRef.current],
        { y: 50, opacity: 0 },
        { y: 0, opacity: 1, duration: 1, stagger: 0.1, ease: "expo.out" }
      );
    });
    return () => ctx.revert();
  }, []);

  useEffect(() => {
    gsap.fromTo(".capsule-grid", { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.4, ease: "expo.out" });
  }, [activeTab]);

  const handleRefresh = useCallback(() => setRefreshKey(k => k + 1), []);

  // ── Fetch all IDs ──
  const { data: sentIds, isLoading: sentLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: capsulMeArtifact.abi,
    functionName: "getSentCapsules",
    args: [address!],
    query: { enabled: !!address, refetchInterval: 10000 },
  } as any);

  const { data: receivedIds, isLoading: receivedLoading } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: capsulMeArtifact.abi,
    functionName: "getReceivedCapsules",
    args: [address!],
    query: { enabled: !!address, refetchInterval: 10000 },
  } as any);

  // ── Classify IDs into 3 categories ──
  const { selfIds, sentOnlyIds, receivedOnlyIds } = useMemo(() => {
    const sent    = new Set<string>((sentIds as bigint[] ?? []).map(id => id.toString()));
    const received = new Set<string>((receivedIds as bigint[] ?? []).map(id => id.toString()));

    const selfIds:          bigint[] = [];
    const sentOnlyIds:      bigint[] = [];
    const receivedOnlyIds:  bigint[] = [];

    // Self = in both sent AND received (sender == receiver == me)
    for (const id of (sentIds as bigint[] ?? [])) {
      if (received.has(id.toString())) {
        selfIds.push(id);
      } else {
        sentOnlyIds.push(id);
      }
    }

    // Received-only = in received but NOT in sent (someone else sent it to me)
    for (const id of (receivedIds as bigint[] ?? [])) {
      if (!sent.has(id.toString())) {
        receivedOnlyIds.push(id);
      }
    }

    return { selfIds, sentOnlyIds, receivedOnlyIds };
  }, [sentIds, receivedIds]);

  const activeIds: bigint[] =
    activeTab === "self"     ? selfIds :
    activeTab === "sent"     ? sentOnlyIds :
    receivedOnlyIds;

  // ── Batch fetch capsule data ──
  const capsuleContracts = activeIds.map(id => ({
    address: CONTRACT_ADDRESS,
    abi: capsulMeArtifact.abi,
    functionName: "capsules",
    args: [id],
  }));

  const { data: capsulesRaw, isLoading: capsuleDataLoading, refetch } = useReadContracts({
    contracts: capsuleContracts as any,
    query: { enabled: capsuleContracts.length > 0 },
  });

  useEffect(() => { refetch(); }, [refreshKey]);

  const isLoading = (sentLoading || receivedLoading) || (capsuleContracts.length > 0 && capsuleDataLoading);

  // ── Parse capsule tuples ──
  const capsules: Array<{ id: bigint; data: CapsuleData }> = [];
  if (capsulesRaw) {
    capsulesRaw.forEach((result, idx) => {
      if (result.status === "success" && result.result) {
        const r = result.result as any[];
        capsules.push({
          id: activeIds[idx],
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
          },
        });
      }
    });
  }

  const TABS: Array<{ key: Tab; icon: string; label: string; count: number; desc: string }> = [
    { key: "self",     icon: "[■]", label: "Self",     count: selfIds.length,         desc: "Capsules sent to yourself" },
    { key: "sent",     icon: "[►]", label: "Sent",     count: sentOnlyIds.length,      desc: "Capsules sent to others" },
    { key: "received", icon: "[◄]", label: "Received", count: receivedOnlyIds.length,  desc: "Capsules received from others" },
  ];

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
          <p className="font-mono-code text-sm font-bold mt-1 uppercase tracking-widest text-black/70">
            [ My Capsules — Personal Vault ]
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <Link
            href="/analytics"
            className="flex items-center justify-center gap-2 bg-transparent text-black py-3 sm:py-2 px-4 font-black uppercase tracking-widest text-xs border-2 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] hover:bg-[#FF5FCF] transition-all w-full sm:w-auto text-center"
          >
            [📊] Analytics
          </Link>
          <Link
            href="/explore"
            className="flex items-center justify-center gap-2 bg-transparent text-black py-3 sm:py-2 px-4 font-black uppercase tracking-widest text-xs border-2 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] hover:bg-[#FF5FCF] transition-all w-full sm:w-auto text-center"
          >
            [#] Global Feed
          </Link>
          <div className="w-full sm:w-auto flex justify-center sm:block">
            <BrutalistConnectButton />
          </div>
        </div>
      </header>

      {/* ── Not Connected ── */}
      {!isConnected && (
        <div className="flex flex-col items-center justify-center py-24 gap-6 text-center border-2 border-black border-dashed">
          <div className="w-20 h-20 border-4 border-black rounded-full flex items-center justify-center animate-pulse">
            <span className="font-mono-code font-bold text-2xl">0x</span>
          </div>
          <h3 className="text-3xl font-black uppercase">Connect Wallet</h3>
          <p className="font-mono-code text-sm font-bold uppercase tracking-widest text-black/50">
            Connect your wallet to view your capsules
          </p>
          <BrutalistConnectButton />
        </div>
      )}

      {/* ── Connected ── */}
      {isConnected && (
        <div ref={contentRef} className="flex flex-col gap-6">

          {/* Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Self",     value: selfIds.length,        icon: "[■]" },
              { label: "Sent",     value: sentOnlyIds.length,     icon: "[►]" },
              { label: "Received", value: receivedOnlyIds.length, icon: "[◄]" },
              { label: "Network",  value: "Base Sepolia",         icon: "[❖]" },
            ].map((stat) => (
              <div key={stat.label} className="blueprint-panel p-4 flex flex-col gap-1 border-2 border-black">
                <span className="font-mono-code text-[10px] uppercase tracking-widest text-black/50 font-bold">
                  {stat.icon} {stat.label}
                </span>
                <span className="font-black text-2xl uppercase">{stat.value}</span>
              </div>
            ))}
          </div>

          {/* 3 Tabs */}
          <div className="flex border-2 border-black">
            {TABS.map((tab, i) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex-1 py-4 font-black uppercase tracking-widest text-xs sm:text-sm transition-colors flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-3 border-r-2 last:border-r-0 border-black ${
                  activeTab === tab.key
                    ? "bg-black text-[#FF5FCF]"
                    : "bg-transparent text-black/40 hover:bg-black/5"
                }`}
              >
                <span>{tab.icon} {tab.label}</span>
                <span className={`font-mono-code text-xs font-bold px-2 py-0.5 border ${
                  activeTab === tab.key ? "border-[#FF5FCF] text-[#FF5FCF]" : "border-black/30 text-black/30"
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Tab description */}
          <p className="font-mono-code text-xs font-bold text-black/40 uppercase tracking-widest -mt-4">
            // {TABS.find(t => t.key === activeTab)?.desc}
          </p>

          {/* Grid */}
          <div className="capsule-grid">
            {isLoading ? (
              <LoadingSkeleton />
            ) : capsules.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {capsules.map(({ id, data }) => (
                  <CapsuleCard
                    key={id.toString()}
                    tokenId={id}
                    data={data}
                    onOpened={handleRefresh}
                    onRevealMessage={(payload, title, lockedValue) => setRevealData({ payload, title, lockedValue: lockedValue || BigInt(0) })}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Massive Cinematic Reveal Modal Overlay ── */}
      {revealData && (
        <FullscreenRevealModal 
          rawPayload={revealData.payload} 
          title={revealData.title} 
          lockedValue={revealData.lockedValue}
          onClose={() => setRevealData(null)} 
        />
      )}
    </main>
  );
}
