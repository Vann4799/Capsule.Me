"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { formatEther } from "viem";
import capsulMeArtifact from "@/lib/CapsulMe.json";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

// ─── Tier Config ──────────────────────────────────────────────────────────────
const TIER_CONFIG = {
  0: { name: "PINK", color: "#FF5FCF", darkColor: "#c0628a", label: "< 6 Months" },
  1: { name: "RED",  color: "#FF2D55", darkColor: "#8b1a2a", label: "6mo – 2yr" },
  2: { name: "BLACK", color: "#1a1a1a", darkColor: "#0d0d0d", label: "> 2 Years" },
} as const;

const STATUS_CONFIG = {
  0: { label: "LOCKED",        icon: "[■]", color: "bg-black text-[#FF5FCF]" },
  1: { label: "READY TO OPEN", icon: "[+]", color: "bg-green-500 text-white" },
  2: { label: "OPENED",        icon: "[>]", color: "bg-gray-500 text-white" },
} as const;

// ─── Type ─────────────────────────────────────────────────────────────────────
export interface CapsuleData {
  encryptedCID: string;
  unlockTime: bigint;
  sender: string;
  receiver: string;
  tier: number;
  status: number;
  title: string;
  lockedValue: bigint;
  capsuleType: number;
  pactThreshold: number;
  pactSignCount: number;
}

interface CapsuleCardProps {
  tokenId: bigint;
  data: CapsuleData;
  onOpened?: () => void;
  onRevealMessage?: (payload: string, title: string, lockedValue?: bigint) => void;
}

// ─── Countdown Hook ───────────────────────────────────────────────────────────
function useCountdown(unlockTime: bigint) {
  const getRemaining = () => {
    const now = Math.floor(Date.now() / 1000);
    const diff = Number(unlockTime) - now;
    if (diff <= 0) return null;
    const d = Math.floor(diff / 86400);
    const h = Math.floor((diff % 86400) / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    return { d, h, m, s, total: diff };
  };

  const [remaining, setRemaining] = useState(getRemaining);

  useEffect(() => {
    const timer = setInterval(() => setRemaining(getRemaining()), 1000);
    return () => clearInterval(timer);
  }, [unlockTime]);

  return remaining;
}

// ─── NFT Image Hook ──────────────────────────────────────────────────────────
function useNftImage(tokenId: bigint) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const { data: tokenUri } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: capsulMeArtifact.abi,
    functionName: "tokenURI",
    args: [tokenId],
  } as any);

  useEffect(() => {
    if (!tokenUri) return;
    try {
      const uri = tokenUri as string;
      // Decode base64 JSON from data:application/json;base64,...
      if (uri.startsWith("data:application/json;base64,")) {
        const json = JSON.parse(atob(uri.split(",")[1]));
        setImageUrl(json.image || null);
      } else if (uri.startsWith("http")) {
        fetch(uri).then(r => r.json()).then(json => setImageUrl(json.image || null)).catch(() => {});
      }
    } catch (e) {
      console.warn("Failed to parse tokenURI", e);
    }
  }, [tokenUri]);

  return [imageUrl, setImageUrl] as const;
}

// ─── CapsuleCard Component ────────────────────────────────────────────────────
export default function CapsuleCard({ tokenId, data, onOpened, onRevealMessage }: CapsuleCardProps) {
  const { address } = useAccount();
  const tierCfg = TIER_CONFIG[data.tier as keyof typeof TIER_CONFIG];
  const statusCfg = STATUS_CONFIG[data.status as keyof typeof STATUS_CONFIG];
  const remaining = useCountdown(data.unlockTime);
  const [localOpened, setLocalOpened] = useState(false);
  
  const isReady = remaining === null;
  const isOpened = data.status === 2 || localOpened;
  const canOpen = isReady && !isOpened;
  const isOwner = address?.toLowerCase() === data.receiver.toLowerCase();

  const [errorMsg, setErrorMsg] = useState("");
  const [nftImageUrl, setImageUrl] = useNftImage(tokenId);

  const rawPayload = data.encryptedCID;
  const rawTitle = data.title || "Untitled Capsule";
  const isPrivate = rawTitle.startsWith("_PRIV_:");
  const displayTitle = isPrivate ? rawTitle.substring(7) : rawTitle;

  const { data: hash, isPending, writeContract, isError, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (isConfirmed) {
      setLocalOpened(true);
      onOpened?.();
      // Auto-trigger the cinematic modal directly after a successful open execution
      setTimeout(() => {
        if (onRevealMessage) onRevealMessage(rawPayload, displayTitle, data.lockedValue);
      }, 500);
    }
  }, [isConfirmed]);

  useEffect(() => {
    if (isError) setErrorMsg(error?.message?.split("\n")[0] || "Failed to open capsule.");
  }, [isError, error]);

  const isPact = data.capsuleType === 1;

  const handleOpen = () => {
    setErrorMsg("");
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: capsulMeArtifact.abi,
      functionName: isPact ? "signPact" : "openCapsule",
      args: [tokenId],
    });
  };

  const unlockDate = new Date(Number(data.unlockTime) * 1000);

  return (
    <div className="border-2 border-black flex flex-col overflow-hidden shadow-[4px_4px_0_rgba(0,0,0,1)] hover:-translate-y-1 hover:shadow-[6px_6px_0_rgba(0,0,0,1)] transition-all duration-200 bg-[#fdf0f8]">

      {/* ── NFT Image Header ── */}
      <div
        className="relative w-full aspect-square flex items-center justify-center overflow-hidden"
        style={{ backgroundColor: tierCfg.darkColor }}
      >
        {/* Blueprint grid */}
        <div className="absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: "repeating-linear-gradient(0deg,#fff 0,#fff 1px,transparent 0,transparent 24px), repeating-linear-gradient(90deg,#fff 0,#fff 1px,transparent 0,transparent 24px)" }}
        />

        {/* NFT Image or Loading Fallback */}
        {nftImageUrl && !nftImageUrl.includes("QmPlaceholderIfEmpty") ? (
          <img
            src={nftImageUrl.replace("ipfs://", "https://gateway.pinata.cloud/ipfs/")}
            alt={data.title}
            className="absolute inset-0 w-full h-full object-cover opacity-90 mix-blend-overlay"
            onError={() => setImageUrl(null)}
          />
        ) : (
          /* Glow + Capsule SVG while loading or if no image */
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-28 h-28 rounded-full opacity-30 blur-2xl" style={{ backgroundColor: tierCfg.color }} />
            </div>
            <svg className="relative z-10 drop-shadow-2xl" width="72" height="130" viewBox="0 0 72 130">
              <defs>
                <linearGradient id={`capTop-${tokenId}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={tierCfg.color}/>
                  <stop offset="100%" stopColor={tierCfg.darkColor}/>
                </linearGradient>
              </defs>
              <path d="M6,65 L6,36 Q6,6 36,6 Q66,6 66,36 L66,65 Z" fill={`url(#capTop-${tokenId})`} stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
              <path d="M6,65 L6,94 Q6,124 36,124 Q66,124 66,94 L66,65 Z" fill="rgba(0,0,0,0.75)" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"/>
              <line x1="6" y1="65" x2="66" y2="65" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
              <path d="M14,20 Q20,12 36,10 Q50,12 56,22" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="3" strokeLinecap="round"/>
              {isPact ? (
                <>
                  <text x="36" y="48" textAnchor="middle" fill="rgba(0,0,0,0.8)" fontSize="8" fontWeight="900" fontFamily="monospace" letterSpacing="1">BLOOD</text>
                  <text x="36" y="88" textAnchor="middle" fill={tierCfg.color} fontSize="8" fontWeight="900" fontFamily="monospace" letterSpacing="1">PACT</text>
                </>
              ) : (
                <>
                  <text x="36" y="48" textAnchor="middle" fill="rgba(0,0,0,0.8)" fontSize="8" fontWeight="900" fontFamily="monospace" letterSpacing="1">TIME</text>
                  <text x="36" y="88" textAnchor="middle" fill={tierCfg.color} fontSize="8" fontWeight="900" fontFamily="monospace" letterSpacing="1">LOCK</text>
                </>
              )}
            </svg>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin"></div>
            </div>
          </>
        )}

        {/* Overlay gradient so badges are readable on top of image */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

        {/* Token ID Badge */}
        <div className="absolute top-2 left-2 bg-black text-[#FF5FCF] font-mono-code font-bold text-[10px] px-2 py-1 border border-[#FF5FCF]/50">
          #{tokenId.toString()}
        </div>

        {/* Tier Badge */}
        <div
          className="absolute top-2 right-2 font-mono-code font-bold text-[10px] px-2 py-1 border-2 border-white/40 text-white"
          style={{ backgroundColor: tierCfg.color + "90" }}
        >
          ◆ {tierCfg.name}
        </div>

        {/* Status Badge */}
        <div className={`absolute bottom-2 left-1/2 -translate-x-1/2 font-mono-code font-bold text-[10px] px-3 py-1 border-2 border-black whitespace-nowrap ${statusCfg.color}`}>
          {statusCfg.icon} {statusCfg.label}
        </div>

        {/* Locked Asset Badge */}
        {data.lockedValue > BigInt(0) && (
          <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${isOpened ? "bg-green-400" : "bg-yellow-400"} text-black font-black uppercase text-xs px-3 py-2 border-4 border-black shadow-[4px_4px_0_rgba(0,0,0,1)] -rotate-6 ${!isOpened ? "animate-pulse" : ""} z-20 pointer-events-none`}>
            ◈ {Number(formatEther(data.lockedValue)).toFixed(4).replace(/\.?0+$/, "")} ETH {isOpened ? "CLAIMED" : "LOCKED"}
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="p-4 flex flex-col gap-3 flex-1">

        {/* Title */}
        <div className="flex justify-between items-start gap-2">
          <h3 className="font-black uppercase tracking-tight text-lg leading-tight line-clamp-2">
            {displayTitle}
          </h3>
          {isPrivate && (
            <span className="font-mono-code font-bold text-[9px] bg-black text-[#FF5FCF] px-1.5 py-0.5 mt-1 border border-[#FF5FCF] shrink-0">
              PRIVATE
            </span>
          )}
        </div>

        {/* Countdown, Date, or Pact Status */}
        <div className="bg-black text-[#FF5FCF] p-2 font-mono-code text-xs">
          {isPact ? (
            <div className="flex gap-2 items-center justify-between">
              <span className="text-[#FF5FCF]/60 uppercase tracking-widest text-[9px]">Signatures</span>
              <span className="font-bold text-white tracking-widest">{data.pactSignCount} / {data.pactThreshold}</span>
            </div>
          ) : isOpened ? (
            <span className="text-green-400 font-bold">✓ OPENED — Payload Revealed</span>
          ) : isReady ? (
            <span className="text-yellow-400 font-bold animate-pulse">⚡ UNLOCKED — Ready to open!</span>
          ) : remaining ? (
            <div className="flex gap-2 items-center">
              <span className="text-[#FF5FCF]/60 uppercase tracking-widest text-[9px] mr-1">UNLOCK IN</span>
              {remaining.d > 0 && <span><b className="text-white">{remaining.d}</b>d</span>}
              <span><b className="text-white">{String(remaining.h).padStart(2,"0")}</b>h</span>
              <span><b className="text-white">{String(remaining.m).padStart(2,"0")}</b>m</span>
              <span><b className="text-white">{String(remaining.s).padStart(2,"0")}</b>s</span>
            </div>
          ) : (
            <span>Secured.</span>
          )}
        </div>
        <div className="font-mono-code text-[10px] text-black/50 space-y-1 border-l-2 border-black/20 pl-2">
          <p>UNLOCK: {unlockDate.toLocaleDateString("en-US", { dateStyle: "medium" })}</p>
          <p>FROM: {data.sender.substring(0, 6)}...{data.sender.slice(-4)}</p>
          <p>TO: {data.receiver.substring(0, 6)}...{data.receiver.slice(-4)}</p>
        </div>

        {/* Error */}
        {errorMsg && (
          <p className="font-mono-code text-[10px] text-red-600 font-bold border-2 border-red-500 p-2">
            !! {errorMsg}
          </p>
        )}

        {/* ── CTA Section ── */}
        <div className="mt-auto pt-1 flex flex-col gap-2">
          
          {!isOwner ? (
            <div className={`w-full py-3 font-black uppercase tracking-widest text-sm border-2 text-center transition-all ${isOpened ? "bg-[#FF5FCF] border-transparent text-black shadow-[4px_4px_0_rgba(0,0,0,1)]" : "bg-black/5 border-black/20 text-black/40"}`}>
              {isOpened ? "[✓] OPENED BY RECEIVER" : "[?] AWAITING RECEIVER"}
            </div>
          ) : (
            <>
              {/* PENDING tx */}
              {(isPending || isConfirming) && (
                <button disabled className="w-full py-3 font-black uppercase tracking-widest text-sm border-2 border-black bg-black text-[#FF5FCF] cursor-wait">
                  <span className="inline-block animate-spin mr-2">⟳</span> OPENING...
                </button>
              )}

              {isPact && !isOpened && (
                <button
                  onClick={handleOpen}
                  disabled={isPending}
                  className={`w-full py-3 font-black uppercase text-xs tracking-widest transition-all ${
                    isPending ? "bg-black/20 text-black/40" : "bg-red-600 text-black border-2 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)]"
                  }`}
                >
                  {isPending ? "SIGNING..." : "✍ SIGN PACT"}
                </button>
              )}

              {!isPact && canOpen && isOwner && (
                <button 
                  onClick={handleOpen}
                  disabled={isPending}
                  className={`w-full py-3 font-black uppercase text-xs tracking-widest border-2 border-black transition-all ${
                    isPending ? "bg-black/5 text-black/30" : "bg-black text-[#FF5FCF] hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] hover:bg-[#FF5FCF] hover:text-black hover:border-black"
                  }`}
                >
                  {isPending ? "DECRYPTING..." : "DECRYPT & OPEN"}
                </button>
              )}

              {(!canOpen || !isOwner) && !isOpened && !isPact && (
                <div className="flex flex-col gap-2">
                  <button disabled className="w-full py-3 bg-black/5 text-black/30 font-black uppercase text-xs tracking-widest border-2 border-black/10">
                    LOCKED BY SMART CONTRACT
                  </button>
                  {address && data.sender.toLowerCase() === address.toLowerCase() && (
                    <a 
                      href={`https://testnets.opensea.io/assets/base-sepolia/${CONTRACT_ADDRESS}/${tokenId}`}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full mt-1 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-widest text-[10px] py-1 text-center decoration-none"
                    >
                      ⇋ Trade on OpenSea
                    </a>
                  )}
                </div>
              )}

              {/* OPENED — CTA to trigger modal */}
              {isOpened && (
                <button
                  onClick={() => onRevealMessage && onRevealMessage(rawPayload, displayTitle, data.lockedValue)}
                  className="w-full py-3 font-black uppercase tracking-widest text-sm border-2 border-[#FF5FCF] bg-[#FF5FCF] text-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(255,95,207,0.5)] transition-all animate-pulse"
                >
                  [+] REVEAL MESSAGE
                </button>
              )}

              {/* ── Zero-Coupon Bond: Trade Section ── */}
              {!isOpened && (
                <a
                  href={`https://testnets.opensea.io/assets/base-sepolia/${CONTRACT_ADDRESS}/${tokenId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-2 font-black uppercase tracking-widest text-[10px] border border-black/20 text-black/40 hover:border-black hover:text-black hover:bg-[#FF5FCF] transition-all flex items-center justify-center gap-2 group"
                >
                  <span className="font-mono-code">[◈]</span>
                  <span>Trade on OpenSea</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[8px]">↗</span>
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
