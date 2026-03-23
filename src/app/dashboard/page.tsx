"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import BrutalistConnectButton from "@/components/BrutalistConnectButton";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
import gsap from "gsap";
import capsulMeArtifact from "@/lib/CapsulMe.json";
import { encryptCapsuleMessage } from "@/lib/lit";
import { uploadToWeb3Storage } from "@/lib/ipfs";

// Requires .env setup, fallback to 0 address prevents crash before contract deploy
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0000000000000000000000000000000000000000";

export default function Dashboard() {
  const { isConnected, address } = useAccount();
  
  // Refs for animations
  const headerRef = useRef(null);
  const heroRef = useRef(null);
  const timelineRef = useRef(null);

  // Core Form Tabs
  const [activeTab, setActiveTab] = useState<"self" | "send" | "pact">("self");

  // Form Fields
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [unlockDurationSecs, setUnlockDurationSecs] = useState<number>(0);
  const [customSecs, setCustomSecs] = useState<string>("");
  const [recipient, setRecipient] = useState("");
  const [ethAmount, setEthAmount] = useState<string>("");
  const [isPublic, setIsPublic] = useState(true);
  
  // Pact Specific Fields
  const [signersStr, setSignersStr] = useState("");
  const [threshold, setThreshold] = useState<number>(2);
  
  // Validation / Exec State
  const [errorMsg, setErrorMsg] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [successToast, setSuccessToast] = useState<{ hash: string } | null>(null);

  // Wagmi Write
  const { data: hash, isPending, writeContract, isError: writeIsError, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: receiptIsError, error: receiptError } = useWaitForTransactionReceipt({ hash });

  // GSAP: Initial Load
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        [headerRef.current, heroRef.current, timelineRef.current],
        { y: 60, opacity: 0 },
        { y: 0, opacity: 1, duration: 1.2, stagger: 0.15, ease: "expo.out" }
      );
    });
    return () => ctx.revert();
  }, []);

  // Form Animation when connected
  useEffect(() => {
    if (isConnected) {
      gsap.fromTo(".stagger-item", 
        { y: 20, opacity: 0 }, 
        { y: 0, opacity: 1, duration: 0.6, stagger: 0.05, ease: "expo.out", overwrite: true }
      );
    }
  }, [isConnected, activeTab]);

  // Mint Handler
  const handleMint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) return;
    setErrorMsg("");
   
    if (!title) return setErrorMsg("Capsule title is required.");
    if (!message) return setErrorMsg("Ciphertext payload cannot be empty.");
    if (unlockDurationSecs === 0) return setErrorMsg("Lock duration must be selected.");
   
    if (activeTab === "send" && !/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
      return setErrorMsg("Invalid EVM recipient address format.");
    }

    let parsedSigners: string[] = [];
    if (activeTab === "pact") {
      if (!signersStr) return setErrorMsg("Signer addresses are required for Pact capsules.");
      parsedSigners = signersStr.split(",").map(s => s.trim()).filter(Boolean);
      parsedSigners.unshift(address); // initiator is implicitly a signer
      // Deduplicate addresses
      parsedSigners = Array.from(new Set(parsedSigners.map(s => s.toLowerCase())));
      if (parsedSigners.length < 2) return setErrorMsg("Pact requires at least 2 unique signers (including you).");
      if (threshold < 2) return setErrorMsg("Threshold must be at least 2.");
      if (threshold > parsedSigners.length) return setErrorMsg("Threshold cannot exceed total number of signers.");
      
      for (const s of parsedSigners) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(s)) return setErrorMsg(`Invalid EVM address: ${s}`);
      }
    }

    // Add 30 seconds buffer to accommodate MetaMask delays and IPFS uploads
    const unlockTimestamp = Math.floor(Date.now() / 1000) + unlockDurationSecs + 30;
   
    try {
      if (CONTRACT_ADDRESS === "0x0000000000000000000000000000000000000000" || !CONTRACT_ADDRESS) {
         throw new Error("Smart Contract is not deployed yet! Update `.env` with a real contract address.");
      }

      setIsProcessing(true);
      const actualRecipient = activeTab === "self" ? address : recipient;

      setStatusText("1/3 ENCRYPTING CYPHERTEXT WITH LIT...");
      const litData = await encryptCapsuleMessage(message, actualRecipient, unlockTimestamp);

      setStatusText("2/3 UPLOADING SECURE PAYLOAD TO IPFS...");
      const cid = await uploadToWeb3Storage(litData);

      setStatusText("3/3 AWAITING SIGNATURE & MINTING ERC-721...");
      const finalTitle = isPublic ? title : `_PRIV_:${title}`;

      if (activeTab === "self") {
         writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: capsulMeArtifact.abi,
            functionName: "mintSelfCapsule",
            args: [cid, BigInt(unlockTimestamp), finalTitle],
            value: ethAmount ? parseEther(ethAmount) : BigInt(0)
         });
      } else if (activeTab === "send") {
         writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: capsulMeArtifact.abi,
            functionName: "mintSendCapsule",
            args: [cid, BigInt(unlockTimestamp), recipient, finalTitle],
            value: ethAmount ? parseEther(ethAmount) : BigInt(0)
         });
      } else if (activeTab === "pact") {
         writeContract({
            address: CONTRACT_ADDRESS as `0x${string}`,
            abi: capsulMeArtifact.abi,
            functionName: "mintPactCapsule",
            args: [cid, parsedSigners, BigInt(threshold), finalTitle],
            value: ethAmount ? parseEther(ethAmount) : BigInt(0)
         });
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Minting protocol execution failed.");
      setIsProcessing(false);
      setStatusText("");
    }
  };

  useEffect(() => {
    if (isConfirmed && hash) {
      setIsProcessing(false);
      setStatusText("");
      setSuccessToast({ hash });
      setTitle(""); setMessage(""); setUnlockDurationSecs(0); setCustomSecs(""); setRecipient(""); setEthAmount(""); setSignersStr(""); setThreshold(2);
    }
  }, [isConfirmed, hash]);

  // Handle Wallet Rejection or Gas Estimation Errors
  useEffect(() => {
    if (writeIsError) {
      setIsProcessing(false);
      setStatusText("");
      const err = writeError as any;
      setErrorMsg(err?.shortMessage || err?.message?.split("reason:\n  ")[1]?.split("\n")[0] || err?.message?.split("\n")[0] || "Transaction rejected or failed.");
    }
  }, [writeIsError, writeError]);

  // Handle On-Chain Reverts
  useEffect(() => {
    if (receiptIsError) {
      setIsProcessing(false);
      setStatusText("");
      const err = receiptError as any;
      setErrorMsg(err?.shortMessage || err?.message?.split("reason:\n  ")[1]?.split("\n")[0] || err?.message?.split("\n")[0] || "Transaction reverted on the blockchain.");
    }
  }, [receiptIsError, receiptError]);

  return (
    <main className="min-h-screen py-10 px-6 max-w-7xl mx-auto flex flex-col gap-16 relative">

      {/* ======= SUCCESS TOAST MODAL ======= */}
      {successToast && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-[#FF5FCF] border-4 border-black shadow-[8px_8px_0_rgba(0,0,0,1)] max-w-md w-full p-8 flex flex-col gap-5 animate-[fadeInUp_0.4s_ease]">
            
            {/* Icon */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-black flex items-center justify-center shrink-0">
                <span className="text-[#FF5FCF] text-2xl font-black">✓</span>
              </div>
              <div>
                <h3 className="font-black uppercase text-2xl tracking-tighter text-black leading-none">Capsule Minted!</h3>
                <p className="font-mono-code text-xs font-bold text-black/70 uppercase tracking-widest mt-1">Transaction confirmed on Base Sepolia</p>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t-2 border-black"></div>

            {/* Tx Hash */}
            <div className="bg-black p-4 flex flex-col gap-2">
              <span className="font-mono-code text-[10px] font-bold text-[#FF5FCF]/60 uppercase tracking-widest">// Transaction Hash</span>
              <span className="font-mono-code text-xs text-[#FF5FCF] break-all font-bold">{successToast.hash}</span>
            </div>

            {/* Links */}
            <div className="flex flex-col gap-3">
              <Link
                href="/mycapsule"
                onClick={() => setSuccessToast(null)}
                className="w-full text-center bg-black text-[#FF5FCF] py-3 font-black uppercase tracking-widest text-sm border-2 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all"
              >
                💊 View My Capsules →
              </Link>
              <div className="flex gap-3">
                <a
                  href={`https://sepolia.basescan.org/tx/${successToast.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-center bg-transparent text-black py-2 font-black uppercase tracking-widest text-xs border-2 border-black hover:bg-black hover:text-[#FF5FCF] transition-colors"
                >
                  BaseScan ↗
                </a>
                <button
                  onClick={() => setSuccessToast(null)}
                  className="flex-1 bg-transparent text-black py-2 font-black uppercase tracking-widest text-xs border-2 border-black hover:bg-black hover:text-[#FF5FCF] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0 opacity-20 hidden md:block">
        <div className="absolute top-1/2 left-1/4 w-[500px] h-[500px] border border-black rounded-full mix-blend-overlay"></div>
        <div className="absolute top-1/4 right-1/4 w-[300px] h-[300px] border border-black mix-blend-overlay rotate-45"></div>
      </div>

      <header ref={headerRef} className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center border-b-2 border-black pb-6 gap-4 w-full">
        <div className="w-full md:w-auto">
          <Link href="/" className="inline-block transition-transform hover:-translate-y-1 hover:drop-shadow-[2px_2px_0_rgba(0,0,0,1)]">
            <h1 className="text-5xl md:text-6xl font-black tracking-tighter uppercase leading-none text-outline-black">
              CAPSUL<span className="text-black" style={{WebkitTextStroke: '0px'}}>.ME</span>
            </h1>
          </Link>
          <p className="font-mono-code text-sm font-bold mt-2 uppercase tracking-widest text-black/70">
            [ Web3 Time-Lock Protocol ]
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <Link
            href="/explore"
            className="flex items-center justify-center gap-2 bg-transparent text-black py-3 sm:py-2 px-4 font-black uppercase tracking-widest text-xs border-2 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] hover:bg-[#FF5FCF] transition-all w-full sm:w-auto text-center"
          >
            [#] Global Feed
          </Link>
          <Link
            href="/mycapsule"
            className="flex items-center justify-center gap-2 bg-black text-[#FF5FCF] py-3 sm:py-2 px-4 font-black uppercase tracking-widest text-xs border-2 border-black hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all w-full sm:w-auto text-center"
          >
            [■] My Vault
          </Link>
          <div className="w-full sm:w-auto flex justify-center sm:block">
            <BrutalistConnectButton />
          </div>
        </div>
      </header>

      <section className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        <div ref={heroRef} className="lg:col-span-6 flex flex-col pt-8">
          <h2 className="text-5xl sm:text-6xl md:text-8xl font-black uppercase tracking-tight leading-[0.85] mb-8 text-transparent [-webkit-text-stroke:1px_#0a0a0a] hover:text-black transition-colors duration-500 break-words">
            Send<br/>Messages<br/>To The<br/>Future.
          </h2>
          <div className="font-mono-code text-sm sm:text-base border-l-4 border-black pl-5 space-y-3 font-semibold text-black/80 max-w-lg blueprint-panel p-6 bg-[#FF5FCF]">
            <p>1 {'>'} Encrypt msg locally via browser</p>
            <p>2 {'>'} Upload ciphertext to IPFS</p>
            <p>3 {'>'} Mint Time-locked ERC-721</p>
            <p className="pt-4 text-black">Only the recipient's private key can decrypt upon block.timestamp condition.</p>
          </div>
        </div>

        <div className="lg:col-span-6 relative">
          
          {!isConnected && (
            <div className="h-full flex flex-col items-center justify-center blueprint-panel p-12 py-24 text-center">
              <div className="w-24 h-24 border-4 border-black rounded-full flex items-center justify-center mb-8 animate-pulse">
                <span className="font-mono-code font-bold text-2xl">0x</span>
              </div>
              <h3 className="text-3xl font-black uppercase mb-4">Awaiting Signal</h3>
              <p className="font-mono-code text-sm font-bold uppercase tracking-widest text-black/70 mb-8">
                Connect Wallet to initialize engine
              </p>
              <BrutalistConnectButton />
            </div>
          )}

          {isConnected && (
            <div className="blueprint-panel p-6 sm:p-8 w-full flex flex-col gap-6 relative overflow-hidden bg-[#FF5FCF]">
              
              {/* Dimmed Overlay when processing */}
              {isProcessing && (
                <div className="absolute inset-0 bg-[rgba(255,95,207,0.9)] backdrop-blur-sm z-50 flex flex-col items-center justify-center p-8 text-center border-4 border-black border-dashed">
                  <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin mb-6"></div>
                  <h3 className="text-xl font-black uppercase tracking-widest mb-2">Executing Task...</h3>
                  <p className="font-mono-code font-bold text-sm tracking-wide bg-black text-[#FF5FCF] px-4 py-2 border-2 border-black">
                    {statusText || "WAITING FOR WALLET..."}
                  </p>
                </div>
              )}

              <div className="border-b-2 border-black pb-2 stagger-item opacity-0 translate-y-4">
                <h3 className="text-2xl font-black uppercase tracking-tighter flex items-center gap-3">
                  <span className="w-3 h-3 bg-black"></span> Create Capsule
                </h3>
              </div>

              {/* Tabs */}
              <div className="flex border-2 border-black stagger-item opacity-0 translate-y-4">
                <button 
                  type="button" 
                  onClick={() => { setActiveTab("self"); setErrorMsg(""); }}
                  disabled={isProcessing}
                  className={`flex-1 py-3 font-black uppercase tracking-widest text-[10px] sm:text-xs border-r-2 border-black transition-colors ${activeTab === 'self' ? 'bg-black text-[#FF5FCF]' : 'bg-transparent text-black/50 hover:bg-black hover:text-[#FF5FCF]'}`}
                >
                  [ Self-Lock ]
                </button>
                <button 
                  type="button" 
                  onClick={() => { setActiveTab("send"); setErrorMsg(""); }}
                  disabled={isProcessing}
                  className={`flex-1 py-3 font-black uppercase tracking-widest text-[10px] sm:text-xs border-r-2 border-black transition-colors ${activeTab === 'send' ? 'bg-black text-[#FF5FCF]' : 'bg-transparent text-black/50 hover:bg-black hover:text-[#FF5FCF]'}`}
                >
                  [ Send Target ]
                </button>
                <button 
                  type="button" 
                  onClick={() => { setActiveTab("pact"); setErrorMsg(""); }}
                  disabled={isProcessing}
                  className={`flex-1 flex flex-col items-center justify-center py-2 font-black uppercase tracking-widest text-[10px] sm:text-xs transition-colors ${activeTab === 'pact' ? 'bg-red-600 border-black text-black shadow-[inset_4px_4px_0_rgba(0,0,0,0.4)]' : 'bg-transparent text-black/50 hover:bg-red-600 hover:text-black hover:border-black'}`}
                >
                  <span>[ Blood Pact ]</span>
                  <span className="text-[7px] tracking-widest opacity-80">(MULTI-SIG)</span>
                </button>
              </div>
              
              <form onSubmit={handleMint} className="flex flex-col gap-5">
                
                {errorMsg && (
                  <div className="bg-red-500 text-white font-mono-code font-bold p-3 border-2 border-black text-xs uppercase tracking-wide">
                    !!! Error: {errorMsg}
                  </div>
                )}

                <div className="flex flex-col gap-2 flex-1 stagger-item opacity-0 translate-y-4">
                  <label className="font-mono-code font-bold text-xs uppercase tracking-widest">
                    // Title
                  </label>
                  <input 
                    type="text"
                    className="blueprint-input w-full p-3 font-mono-code text-sm font-bold"
                    placeholder="e.g. My Next Bullrun Goal"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>

                {activeTab === "send" && (
                  <div className="flex flex-col gap-2 flex-1 stagger-item opacity-0 translate-y-4">
                    <label className="font-mono-code font-bold text-xs uppercase tracking-widest">
                      // Recipient EVM Address
                    </label>
                    <input 
                      type="text"
                      className="blueprint-input w-full p-3 font-mono-code text-sm font-bold"
                      placeholder="0x..."
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      disabled={isProcessing}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-2 stagger-item opacity-0 translate-y-4">
                  <label className="font-mono-code font-bold text-xs uppercase tracking-widest">
                    // Ciphertext Payload (Auto-encrypted locally)
                  </label>
                  <textarea 
                    className="blueprint-input w-full p-4 font-mono-code text-sm resize-none h-32"
                    placeholder="const message = 'The secret seed phrase is...';"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>

                <div className="flex flex-col gap-3 stagger-item opacity-0 translate-y-4">
                  <label className="font-mono-code font-bold text-xs uppercase tracking-widest flex items-center justify-between">
                    <span>// Lock ETH (Optional)</span>
                    <span className="text-[#FF5FCF]">NATIVE CURRENCY</span>
                  </label>
                  <input 
                    type="number"
                    step="0.0001"
                    min="0"
                    className="blueprint-input w-full p-3 font-mono-code text-sm font-bold bg-[#FF5FCF]/10 focus:bg-[#FF5FCF]/30"
                    placeholder="0.00"
                    value={ethAmount}
                    onChange={(e) => setEthAmount(e.target.value)}
                    disabled={isProcessing}
                  />
                </div>

                {activeTab !== "pact" && (
                  <div className="flex flex-col gap-3 stagger-item opacity-0 translate-y-4">
                    <label className="font-mono-code font-bold text-xs uppercase tracking-widest">
                      // Protocol Execution Delay (Lock Duration)
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "1 MIN", value: 60, tier: "DEV", color: "#22d3ee" },
                        { label: "5 MIN", value: 300, tier: "DEV", color: "#22d3ee" },
                        { label: "7 DAYS", value: 7*24*3600, tier: "PINK", color: "#FF5FCF" },
                        { label: "1 MONTH", value: 30*24*3600, tier: "PINK", color: "#FF5FCF" },
                        { label: "6 MONTHS", value: 180*24*3600, tier: "RED", color: "#FF2D55" },
                        { label: "1 YEAR", value: 365*24*3600, tier: "RED", color: "#FF2D55" },
                        { label: "2 YEARS", value: 730*24*3600, tier: "BLACK", color: "#1a1a1a" },
                        { label: "5 YEARS", value: 1825*24*3600, tier: "BLACK", color: "#1a1a1a" },
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => { setUnlockDurationSecs(preset.value); setCustomSecs(""); }}
                          disabled={isProcessing}
                          className={`border-2 border-black p-2 sm:p-3 flex flex-col items-center justify-center transition-all ${
                            unlockDurationSecs === preset.value && customSecs === ""
                              ? "bg-black text-white shadow-[4px_4px_0_rgba(0,0,0,1)] -translate-y-1"
                              : "bg-transparent text-black hover:bg-black/5"
                          }`}
                        >
                          <span className="font-black uppercase text-xs sm:text-sm">{preset.label}</span>
                          <div className="flex items-center gap-1 mt-1 opacity-80">
                            <span className="w-2 h-2 rounded-full border border-current" style={{ backgroundColor: preset.color }}></span>
                            <span className="font-mono-code text-[9px] font-bold">{preset.tier}</span>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Custom seconds input */}
                    <div className="flex gap-2 mt-1 items-center">
                      <input
                        type="number"
                        min="60"
                        placeholder="Custom: seconds (e.g. 120)"
                        className="blueprint-input flex-1 p-3 font-mono-code text-sm font-bold"
                        value={customSecs}
                        disabled={isProcessing}
                        onChange={(e) => {
                          setCustomSecs(e.target.value);
                          const sec = parseInt(e.target.value);
                          if (!isNaN(sec) && sec > 0) setUnlockDurationSecs(sec);
                        }}
                      />
                      <span className="font-mono-code text-xs font-bold uppercase tracking-widest shrink-0">SEC</span>
                    </div>

                    {unlockDurationSecs > 0 && (
                      <div className="mt-1 bg-black text-[#FF5FCF] font-mono-code p-3 text-xs font-bold flex flex-col sm:flex-row justify-between uppercase border-2 border-black tracking-widest">
                        <span>Target Epoch Unlock:</span>
                        <span className="text-white mt-1 sm:mt-0">
                          {new Date(Date.now() + unlockDurationSecs * 1000).toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'short' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "pact" && (
                  <div className="flex flex-col gap-4 stagger-item opacity-0 translate-y-4 blueprint-panel p-4 bg-red-600/10 border-red-600">
                    <div className="flex flex-col gap-2">
                      <label className="font-mono-code font-bold text-xs uppercase tracking-widest text-red-700">
                        // Co-Signers (Comma Separated Addresses)
                      </label>
                      <textarea 
                        className="blueprint-input w-full p-3 font-mono-code text-[10px] sm:text-xs font-bold border-red-600 focus:outline-red-600 resize-none h-20"
                        placeholder="0x123..., 0x456..., 0x789..."
                        value={signersStr}
                        onChange={(e) => setSignersStr(e.target.value)}
                        disabled={isProcessing}
                      />
                      <p className="font-mono-code text-[9px] font-bold opacity-60">
                        Note: You are automatically included as a signer. Add the rest of your pact members here.
                      </p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="font-mono-code font-bold text-xs uppercase tracking-widest text-red-700">
                        // Required Signatures (Threshold)
                      </label>
                      <input 
                        type="number"
                        min="2"
                        className="blueprint-input w-full p-3 font-mono-code text-sm font-bold border-red-600 focus:outline-red-600"
                        placeholder="e.g. 3"
                        value={threshold}
                        onChange={(e) => setThreshold(parseInt(e.target.value) || 2)}
                        disabled={isProcessing}
                      />
                      <p className="font-mono-code text-[9px] font-bold opacity-60">
                        How many signers must agree to unlock? (e.g. 3 out of 5)
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex flex-col gap-4 stagger-item opacity-0 translate-y-4">
                  {/* Visibility Toggle */}
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPublic(!isPublic)}
                      disabled={isProcessing}
                      className={`w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center border-2 border-black transition-colors ${
                        isPublic ? "bg-black text-[#FF5FCF]" : "bg-transparent text-black"
                      }`}
                    >
                      {isPublic && <span className="font-black text-lg pb-1 leading-none">✓</span>}
                    </button>
                    <div className="flex flex-col cursor-pointer" onClick={() => setIsPublic(!isPublic)}>
                      <span className="font-black text-sm sm:text-base uppercase tracking-widest leading-none">
                        Publish to Global Feed
                      </span>
                      <span className="font-mono-code text-[9px] sm:text-[10px] font-bold opacity-80 uppercase mt-1">
                        If checked, metadata appears on the Explorer (Ciphertext remains secure)
                      </span>
                    </div>
                  </div>

                  {/* Submit Exec */}
                  <button 
                    type="submit" 
                    disabled={isProcessing}
                    className="w-full bg-black text-[#FF5FCF] py-4 font-black uppercase tracking-widest text-lg transition-transform hover:-translate-y-1 hover:shadow-[6px_8px_0_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none border-2 border-black disabled:opacity-50"
                  >
                    Execute Protocol
                  </button>
                </div>

              </form>
            </div>
          )}
        </div>
      </section>

      <footer ref={timelineRef} className="relative z-10 font-mono-code text-xs font-bold border-t-2 border-black pt-6 flex flex-col sm:flex-row justify-between uppercase tracking-widest text-black/80">
        <div>Capsul.Me Protocol v1.0.0</div>
        <div className="flex gap-6 mt-4 sm:mt-0">
           {isConnected ? <span>Logged In: {address?.substring(0, 6)}...{address?.slice(-4)}</span> : null}
          <span>Network: Base Sepolia</span>
        </div>
      </footer>
    </main>
  );
}
