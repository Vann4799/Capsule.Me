"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import BrutalistConnectButton from "@/components/BrutalistConnectButton";
import capsulMeArtifact from "@/lib/CapsulMe.json";

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`;

// ─── Donut Chart ──────────────────────────────────────────────────────────────
function DonutChart({ segments, label }: { segments: { value: number; color: string; name: string }[]; label: string }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-32 h-32 rounded-full border-4 border-black/10 flex items-center justify-center">
        <span className="font-mono-code text-xs text-black/30 font-bold uppercase">No Data</span>
      </div>
      <span className="font-mono-code text-[10px] font-bold uppercase tracking-widest opacity-50">{label}</span>
    </div>
  );

  let cumulative = 0;
  const r = 54;
  const cx = 64, cy = 64;
  const circumference = 2 * Math.PI * r;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width="128" height="128" viewBox="0 0 128 128">
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const dash = fraction * circumference;
          const gap = circumference - dash;
          const offset = -cumulative * circumference;
          cumulative += fraction;
          return (
            <circle
              key={i}
              cx={cx} cy={cy} r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="16"
              strokeDasharray={`${dash} ${gap}`}
              strokeDashoffset={offset - circumference * 0.25}
              style={{ transition: "stroke-dasharray 0.6s ease" }}
            />
          );
        })}
        <text x={cx} y={cy - 6} textAnchor="middle" className="font-black" fontSize="20" fontFamily="monospace" fontWeight="900" fill="black">{total}</text>
        <text x={cx} y={cy + 12} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="rgba(0,0,0,0.4)" fontWeight="700">TOTAL</text>
      </svg>
      <span className="font-mono-code text-[10px] font-bold uppercase tracking-widest text-black/60">{label}</span>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {segments.map((seg, i) => (
          <span key={i} className="font-mono-code text-[9px] font-bold flex items-center gap-1">
            <span className="w-2 h-2 rounded-full inline-block border border-black/20" style={{ backgroundColor: seg.color }} />
            {seg.name} ({seg.value})
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ bars, label }: { bars: { name: string; value: number; color: string }[]; label: string }) {
  const max = Math.max(...bars.map(b => b.value), 1);
  return (
    <div className="flex flex-col gap-2 w-full">
      <span className="font-mono-code text-[10px] font-bold uppercase tracking-widest text-black/60">{label}</span>
      <div className="flex items-end gap-2 h-28">
        {bars.map((bar, i) => (
          <div key={i} className="flex flex-col items-center flex-1 gap-1">
            <span className="font-mono-code text-[10px] font-black">{bar.value}</span>
            <div
              className="w-full border-2 border-black transition-all duration-700"
              style={{ height: `${Math.max((bar.value / max) * 88, bar.value > 0 ? 6 : 0)}px`, backgroundColor: bar.color }}
            />
            <span className="font-mono-code text-[9px] font-bold uppercase text-center leading-tight opacity-60">{bar.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, accent }: { icon: string; label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className={`blueprint-panel border-2 border-black p-4 flex flex-col gap-1 shadow-[4px_4px_0_rgba(0,0,0,1)]`} style={accent ? { borderLeftColor: accent, borderLeftWidth: 6 } : {}}>
      <span className="font-mono-code text-[10px] uppercase tracking-widest text-black/50 font-bold">{icon} {label}</span>
      <span className="font-black text-2xl uppercase tracking-tight leading-none">{value}</span>
      {sub && <span className="font-mono-code text-[10px] text-black/40 font-bold uppercase">{sub}</span>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ icon, title, desc, unlocked }: { icon: string; title: string; desc: string; unlocked: boolean }) {
  return (
    <div className={`border-2 border-black p-3 flex flex-col items-center gap-1 text-center transition-all ${unlocked ? "bg-[#FF5FCF] shadow-[4px_4px_0_rgba(0,0,0,1)]" : "bg-black/5 opacity-40 grayscale"}`}>
      <span className="text-2xl">{icon}</span>
      <span className="font-black uppercase text-xs tracking-tight leading-tight">{title}</span>
      <span className="font-mono-code text-[9px] font-bold opacity-70 uppercase leading-tight">{desc}</span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const { address, isConnected } = useAccount();
  const now = Math.floor(Date.now() / 1000);

  const { data: sentIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: capsulMeArtifact.abi,
    functionName: "getSentCapsules",
    args: [address!],
    query: { enabled: !!address },
  } as any);

  const { data: receivedIds } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: capsulMeArtifact.abi,
    functionName: "getReceivedCapsules",
    args: [address!],
    query: { enabled: !!address },
  } as any);

  // Combine all unique IDs
  const allIds = useMemo(() => {
    const sent = (sentIds as bigint[] ?? []);
    const received = (receivedIds as bigint[] ?? []);
    const map = new Map<string, bigint>();
    [...sent, ...received].forEach(id => map.set(id.toString(), id));
    return Array.from(map.values());
  }, [sentIds, receivedIds]);

  const capsuleContracts = allIds.map(id => ({
    address: CONTRACT_ADDRESS,
    abi: capsulMeArtifact.abi,
    functionName: "capsules",
    args: [id],
  }));

  const { data: capsulesRaw, isLoading } = useReadContracts({
    contracts: capsuleContracts as any,
    query: { enabled: capsuleContracts.length > 0 },
  });

  const capsules = useMemo(() => {
    if (!capsulesRaw) return [];
    return capsulesRaw.map((res, idx) => {
      if (res.status !== "success" || !res.result) return null;
      const r = res.result as any[];
      if (r[2] === "0x0000000000000000000000000000000000000000") return null;
      return {
        id: allIds[idx],
        encryptedCID: r[0] as string,
        unlockTime:   Number(r[1]),
        sender:       r[2] as string,
        receiver:     r[3] as string,
        tier:         Number(r[4]),       // 0=Pink, 1=Red, 2=Black
        status:       Number(r[5]),       // 0=Locked, 1=Unlocked, 2=Opened
        title:        r[6] as string,
        lockedValue:  r[7] as bigint,
        capsuleType:  Number(r[8]),       // 0=TimeLocked, 1=Pact
        pactThreshold: Number(r[9]),
        pactSignCount: Number(r[10]),
      };
    }).filter(Boolean) as any[];
  }, [capsulesRaw, allIds]);

  // ─── Stats Computation ──────────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!capsules.length) return null;

    const sentSet = new Set((sentIds as bigint[] ?? []).map(id => id.toString()));
    const recvSet = new Set((receivedIds as bigint[] ?? []).map(id => id.toString()));

    const myCreated = capsules.filter(c => sentSet.has(c.id.toString()));
    const myReceived = capsules.filter(c => recvSet.has(c.id.toString()) && !sentSet.has(c.id.toString()));
    const selfCaps  = capsules.filter(c => sentSet.has(c.id.toString()) && recvSet.has(c.id.toString()));

    const totalLocked   = capsules.reduce((acc, c) => acc + (c.lockedValue || 0n), 0n);
    const totalClaimed  = capsules.filter(c => c.status === 2).reduce((acc, c) => acc + (c.lockedValue || 0n), 0n);

    // Tier counts
    const tierCounts = [0, 0, 0]; // Pink, Red, Black
    capsules.forEach(c => { tierCounts[c.tier] = (tierCounts[c.tier] || 0) + 1; });

    // Status counts
    const statusCounts = [0, 0, 0]; // Locked, Unlocked, Opened
    capsules.forEach(c => { statusCounts[c.status] = (statusCounts[c.status] || 0) + 1; });

    // Type counts
    const timeLocked = capsules.filter(c => c.capsuleType === 0).length;
    const pact       = capsules.filter(c => c.capsuleType === 1).length;

    // Longest lock still alive
    const longest = capsules
      .filter(c => c.status !== 2 && c.unlockTime > 0)
      .sort((a, b) => b.unlockTime - a.unlockTime)[0];

    // Most recent
    const mostRecent = [...capsules].sort((a, b) => Number(b.id) - Number(a.id))[0];

    // Top senders
    const senderMap = new Map<string, number>();
    myReceived.forEach(c => senderMap.set(c.sender, (senderMap.get(c.sender) || 0) + 1));
    const topSenders = Array.from(senderMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Active locked ETH (not Opened)
    const activeLocked = capsules.filter(c => c.status !== 2).reduce((acc, c) => acc + (c.lockedValue || 0n), 0n);

    return {
      total: capsules.length,
      created: myCreated.length,
      received: myReceived.length,
      self: selfCaps.length,
      totalLocked,
      totalClaimed,
      activeLocked,
      tierCounts,
      statusCounts,
      timeLocked,
      pact,
      longest,
      mostRecent,
      topSenders,
    };
  }, [capsules, sentIds, receivedIds]);

  // ─── Milestones ─────────────────────────────────────────────────────────────
  const milestones = useMemo(() => {
    const s = stats;
    return [
      { icon: "🧬", title: "Capsule Pioneer", desc: "Created first capsule", unlocked: (s?.created ?? 0) >= 1 },
      { icon: "📦", title: "Hoarder",         desc: "5+ capsules total",      unlocked: (s?.total ?? 0) >= 5 },
      { icon: "💸", title: "Value Locker",    desc: "Locked 0.01+ ETH",       unlocked: (s?.totalLocked ?? 0n) >= BigInt("10000000000000000") },
      { icon: "🤝", title: "Pact Maker",      desc: "Created a Blood Pact",   unlocked: (s?.pact ?? 0) >= 1 },
      { icon: "📬", title: "Gift Giver",      desc: "Sent capsule to others", unlocked: (s?.created ?? 0) - (s?.self ?? 0) > 0 },
      { icon: "⏳", title: "Time Warrior",    desc: "2+ year lock",           unlocked: !!(s?.longest && (s.longest.unlockTime - now) > 60 * 60 * 24 * 365 * 2) },
      { icon: "🏆", title: "Collector",       desc: "Received 3+ capsules",   unlocked: (s?.received ?? 0) >= 3 },
      { icon: "🔓", title: "Redeemer",        desc: "Opened a capsule",       unlocked: (s?.statusCounts[2] ?? 0) >= 1 },
    ];
  }, [stats, now]);

  const longestDays = stats?.longest
    ? Math.max(0, Math.floor((stats.longest.unlockTime - now) / 86400))
    : 0;

  return (
    <main className="min-h-screen py-10 px-6 max-w-7xl mx-auto flex flex-col gap-10">

      {/* ── Header ── */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b-2 border-black pb-6 w-full">
        <div className="w-full md:w-auto">
          <Link href="/mycapsule" className="font-mono-code text-xs font-bold text-black/50 uppercase tracking-widest hover:text-black mb-3 flex items-center gap-2">
            ← Back to My Vault
          </Link>
          <Link href="/" className="inline-block transition-transform hover:-translate-y-1">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none">
              CAPSUL<span className="text-black">.ME</span>
            </h1>
          </Link>
          <p className="font-mono-code text-sm font-bold mt-1 uppercase tracking-widest text-black/70">
            [ On-Chain Analytics Dashboard ]
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <Link href="/explore" className="flex items-center justify-center gap-2 bg-transparent text-black py-3 sm:py-2 px-4 font-black uppercase tracking-widest text-xs border-2 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all text-center">
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
            Connect your wallet to see your analytics
          </p>
          <BrutalistConnectButton />
        </div>
      )}

      {/* ── Loading ── */}
      {isConnected && isLoading && (
        <div className="py-24 flex flex-col items-center justify-center gap-6 opacity-50">
          <div className="w-16 h-16 border-4 border-black border-t-transparent animate-spin rounded-full" />
          <p className="font-mono-code font-bold uppercase tracking-widest animate-pulse">Querying Chain...</p>
        </div>
      )}

      {/* ── Connected but no data ── */}
      {isConnected && !isLoading && !stats && (
        <div className="flex flex-col items-center justify-center py-24 gap-4 text-center border-2 border-black border-dashed">
          <h3 className="text-3xl font-black uppercase text-black/30">No Capsules Found</h3>
          <p className="font-mono-code text-sm font-bold uppercase tracking-widest text-black/30">Create your first capsule to unlock analytics.</p>
          <Link href="/dashboard" className="bg-black text-[#FF5FCF] py-3 px-8 font-black uppercase tracking-widest text-sm border-2 border-black hover:-translate-y-1 transition-all">
            Create Capsule →
          </Link>
        </div>
      )}

      {/* ── Main Content ── */}
      {isConnected && stats && (
        <div className="flex flex-col gap-10">

          {/* Overview Stats */}
          <section>
            <h2 className="font-black uppercase text-2xl tracking-tighter mb-4 flex items-center gap-3">
              <span className="font-mono-code text-sm text-black/40">[01]</span> Overview
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard icon="📦" label="Total"    value={stats.total}    accent="#FF5FCF" />
              <StatCard icon="✍️" label="Created"  value={stats.created}  />
              <StatCard icon="📬" label="Received" value={stats.received} />
              <StatCard icon="🔒" label="Locked"   value={stats.statusCounts[0]} />
              <StatCard icon="⚡" label="Unlocked" value={stats.statusCounts[1]} />
              <StatCard icon="✅" label="Opened"   value={stats.statusCounts[2]} />
            </div>
          </section>

          {/* ETH Stats */}
          <section>
            <h2 className="font-black uppercase text-2xl tracking-tighter mb-4 flex items-center gap-3">
              <span className="font-mono-code text-sm text-black/40">[02]</span> Value Summary
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatCard
                icon="💰" label="Total ETH Locked (All Time)"
                value={`${parseFloat(formatEther(stats.totalLocked)).toFixed(4)} ETH`}
                accent="#FF5FCF"
              />
              <StatCard
                icon="🏦" label="ETH Still In Vaults"
                value={`${parseFloat(formatEther(stats.activeLocked)).toFixed(4)} ETH`}
                accent="#FF2D55"
              />
              <StatCard
                icon="🎉" label="ETH Claimed"
                value={`${parseFloat(formatEther(stats.totalClaimed)).toFixed(4)} ETH`}
                accent="#22c55e"
              />
            </div>
          </section>

          {/* Charts */}
          <section>
            <h2 className="font-black uppercase text-2xl tracking-tighter mb-4 flex items-center gap-3">
              <span className="font-mono-code text-sm text-black/40">[03]</span> Distribution
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 border-2 border-black p-6 shadow-[4px_4px_0_rgba(0,0,0,1)]">
              <DonutChart
                label="By Tier"
                segments={[
                  { name: "Pink",  value: stats.tierCounts[0], color: "#FF5FCF" },
                  { name: "Red",   value: stats.tierCounts[1], color: "#FF2D55" },
                  { name: "Black", value: stats.tierCounts[2], color: "#1a1a1a" },
                ]}
              />
              <DonutChart
                label="By Status"
                segments={[
                  { name: "Locked",   value: stats.statusCounts[0], color: "#1a1a1a" },
                  { name: "Unlocked", value: stats.statusCounts[1], color: "#f59e0b" },
                  { name: "Opened",   value: stats.statusCounts[2], color: "#22c55e" },
                ]}
              />
              <DonutChart
                label="By Type"
                segments={[
                  { name: "TimeLocked", value: stats.timeLocked, color: "#FF5FCF" },
                  { name: "Pact",       value: stats.pact,       color: "#7c3aed" },
                ]}
              />
            </div>
          </section>

          {/* Highlights */}
          <section>
            <h2 className="font-black uppercase text-2xl tracking-tighter mb-4 flex items-center gap-3">
              <span className="font-mono-code text-sm text-black/40">[04]</span> Highlights
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stats.longest && (
                <div className="border-2 border-black p-4 shadow-[4px_4px_0_rgba(0,0,0,1)] flex flex-col gap-1">
                  <span className="font-mono-code text-[10px] uppercase tracking-widest text-black/50 font-bold">⏱ Longest Active Lock</span>
                  <span className="font-black uppercase text-xl tracking-tight truncate">{stats.longest.title || "Untitled"}</span>
                  <span className="font-mono-code text-sm font-bold text-black/70">{longestDays} days remaining</span>
                  <span className="font-mono-code text-[10px] font-bold text-black/40">Unlocks {new Date(stats.longest.unlockTime * 1000).toLocaleDateString("en-US", { dateStyle: "long" })}</span>
                </div>
              )}
              {stats.mostRecent && (
                <div className="border-2 border-black p-4 shadow-[4px_4px_0_rgba(0,0,0,1)] flex flex-col gap-1">
                  <span className="font-mono-code text-[10px] uppercase tracking-widest text-black/50 font-bold">🆕 Most Recent Capsule</span>
                  <span className="font-black uppercase text-xl tracking-tight truncate">{stats.mostRecent.title || "Untitled"}</span>
                  <span className="font-mono-code text-sm font-bold text-black/70">Capsule #{stats.mostRecent.id.toString()}</span>
                  <span className="font-mono-code text-[10px] font-bold text-black/40">{["TimeLocked", "Pact"][stats.mostRecent.capsuleType]}</span>
                </div>
              )}
            </div>
          </section>

          {/* Top Senders */}
          {stats.topSenders.length > 0 && (
            <section>
              <h2 className="font-black uppercase text-2xl tracking-tighter mb-4 flex items-center gap-3">
                <span className="font-mono-code text-sm text-black/40">[05]</span> Top Senders To You
              </h2>
              <div className="flex flex-col gap-2 border-2 border-black p-4 shadow-[4px_4px_0_rgba(0,0,0,1)]">
                {stats.topSenders.map(([addr, count], i) => (
                  <div key={addr} className="flex items-center justify-between border-b border-black/10 pb-2 last:border-0 last:pb-0">
                    <div className="flex items-center gap-3">
                      <span className="font-mono-code text-xs font-black text-black/40">#{i + 1}</span>
                      <span className="font-mono-code text-sm font-bold">{addr.slice(0, 8)}...{addr.slice(-6)}</span>
                    </div>
                    <span className="font-black text-sm bg-black text-[#FF5FCF] px-3 py-1">{count} sent</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Milestone Badges */}
          <section>
            <h2 className="font-black uppercase text-2xl tracking-tighter mb-4 flex items-center gap-3">
              <span className="font-mono-code text-sm text-black/40">[06]</span> Milestone Badges
              <span className="font-mono-code text-xs font-bold text-black/40">({milestones.filter(m => m.unlocked).length}/{milestones.length} Unlocked)</span>
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {milestones.map((m, i) => (
                <Badge key={i} {...m} />
              ))}
            </div>
          </section>

        </div>
      )}
    </main>
  );
}
