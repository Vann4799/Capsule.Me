"use client";

import { useRef } from "react";
import Link from "next/link";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function LandingPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const capsuleContainerRef = useRef<HTMLDivElement>(null);
  const capsuleTopRef = useRef<HTMLDivElement>(null);
  const capsuleBottomRef = useRef<HTMLDivElement>(null);
  const capsuleCoreRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // 1. Initial Hero Enter Animation
      const introTl = gsap.timeline();
      introTl
        .from(".nav-bar", { y: -50, opacity: 0, duration: 1, ease: "expo.out" })
        .to(".initial-svg-text text", { strokeDashoffset: 0, duration: 2.5, ease: "power3.inOut" }, "-=0.5")
        .to(".solid-me", { fill: "#0a0a0a", duration: 0.8 }, "-=0.5")
        .from(".initial-text", { y: 20, opacity: 0, duration: 1, ease: "expo.out" }, "-=2")
        .from(capsuleContainerRef.current, { scale: 0.5, opacity: 0, duration: 1.5, ease: "elastic.out(1, 0.7)" }, "-=2")
        .from(".scroll-indicator-inner", { opacity: 0, y: -20, duration: 1, repeat: -1, yoyo: true }, "-=1");

      // 2. The Main Scroll Sequence (Scrollytelling)
      const mainTl = gsap.timeline({
        scrollTrigger: {
          trigger: ".scroll-wrapper",
          start: "top top",
          end: "+=350%", // Extended slightly for smoother pacing
          scrub: 1,      
          pin: true,     
        },
      });

      mainTl
        // Sequence A: Move hero text out
        .to(".hero-header-section", { autoAlpha: 0, yPercent: -50, scale: 0.9, duration: 0.8 }, 0)
        .to(".scroll-indicator", { opacity: 0, duration: 0.1 }, 0)
        .to(capsuleContainerRef.current, { scale: window.innerWidth < 640 ? 0.8 : 1.2, duration: 1, y: window.innerWidth < 640 ? -40 : 0 }, 0)
        
        // Sequence B: Split the Capsule dynamically with responsive percentage offsets
        .to(capsuleTopRef.current, { yPercent: -150, rotationX: 10, duration: 1.5 }, "+=0.2")
        .to(capsuleBottomRef.current, { yPercent: 150, rotationX: -10, duration: 1.5 }, "<")
        
        // Sequence C: Emerge the glowing ciphertext core fully centered
        .to(capsuleCoreRef.current, { opacity: 1, scale: 1, rotationY: 360, duration: 1.5, ease: "back.out(1.2)" }, "<0.2")
        
        // Sequence D: Text panels from edges, preventing overlap
        .fromTo(".panel-1", { x: -100, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, "+=0.3")
        .fromTo(".panel-2", { x: 100, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, "<0.2")
        .fromTo(".panel-3", { x: -100, opacity: 0 }, { x: 0, opacity: 1, duration: 1 }, "<0.2")
        
        // Sequence E: Second CTA button fades in below core
        .fromTo(".scroll-cta", { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 1, ease: "elastic.out(1, 0.5)" }, "+=0.2");

    },
    { scope: containerRef }
  );

  const gridItems = Array.from({ length: 96 });

  return (
    <main ref={containerRef} className="text-black overflow-hidden m-0 p-0 relative min-h-screen">
      
      {/* Fixed Sticky Navbar */}
      <nav className="nav-bar fixed top-0 w-full p-4 sm:p-6 flex justify-between items-center z-50 pointer-events-none">
         <div className="font-black text-xl sm:text-2xl tracking-tighter mix-blend-difference text-[var(--color-bg-pink)]">
           CAPSUL.ME
         </div>
      </nav>

      <div className="scroll-wrapper w-full h-screen relative flex flex-col items-center justify-center">

        {/* ========================================================== */}
        {/* UPPER HERO SECTION (Text)                                  */}
        {/* ========================================================== */}
        <div className="hero-header-section absolute top-[10%] lg:top-[8%] w-full flex flex-col items-center text-center z-10 px-4">
          
          <svg className="initial-svg-text w-full max-w-[90vw] sm:max-w-4xl h-16 sm:h-24 md:h-32 mb-0 overflow-visible z-20" viewBox="0 0 800 150" preserveAspectRatio="xMidYMid meet">
            <text 
              x="50%" y="60%" textAnchor="middle" dominantBaseline="middle"
              className="font-black uppercase tracking-tighter"
              style={{ fontSize: '130px', fill: 'transparent', stroke: '#0a0a0a', strokeWidth: '2px', strokeDasharray: '2500', strokeDashoffset: '2500', strokeLinecap: 'round', strokeLinejoin: 'round' }}
            >
              CAPSUL
              <tspan className="solid-me" style={{ fill: 'transparent', strokeWidth: '0px' }}>.ME</tspan>
            </text>
          </svg>

          <p className="initial-text mt-[-5px] sm:mt-[-10px] z-20 font-mono-code bg-black text-[#FF5FCF] px-4 py-1 sm:px-6 sm:py-2 font-bold tracking-widest border-2 border-black text-[10px] sm:text-sm shadow-[4px_4px_0_rgba(255,100,210,1)] relative">
            DECENTRALIZED TIME-LOCK PROTOCOL
          </p>
        </div>

        {/* ========================================================== */}
        {/* CENTRAL CAPSULE SVG (Interactive 3D Look)                  */}
        {/* ========================================================== */}
        {/* Container has NO global drop-shadow now! */}
        <div className="absolute top-[52%] lg:top-[55%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-full flex items-center justify-center z-10 pointer-events-none perspective-1000">
          
          <div ref={capsuleContainerRef} className="relative w-28 h-56 sm:w-40 sm:h-80 transform-style-3d">
            
            {/* Top Shell (Individual Shadow applied here) */}
            <div ref={capsuleTopRef} className="absolute top-0 w-full h-[50.5%] border-[5px] sm:border-[8px] border-black bg-black rounded-t-full flex items-end justify-center pb-6 sm:pb-8 z-30 transform origin-bottom border-b-0 shadow-[10px_10px_0_rgba(0,0,0,0.8)]">
               <span className="text-[#FF5FCF] font-black text-xl sm:text-3xl tracking-widest rotate-90 ml-1 mb-2">TIME</span>
               <div className="absolute top-[10%] right-[15%] w-[15%] h-[70%] bg-white/20 rounded-full blur-sm"></div>
            </div>

            {/* Sub-Shell/Core (The Encrypted Payload) */}
            <div ref={capsuleCoreRef} className="absolute top-[20%] left-[-15%] w-[130%] h-[60%] bg-[#0a0a0a] border-[4px] sm:border-[5px] border-[#FF5FCF] flex flex-col z-20 opacity-0 scale-50 shadow-[0_0_50px_rgba(255,95,207,0.8),inset_0_0_20px_rgba(255,95,207,0.4)] overflow-hidden">
               {/* Glitch Grid Background */}
               <div className="absolute inset-0 opacity-20 mix-blend-screen" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,#FF5FCF 2px,#FF5FCF 4px), repeating-linear-gradient(90deg,transparent,transparent 2px,#FF5FCF 2px,#FF5FCF 4px)", backgroundSize: "8px 8px" }}></div>
               
               <div className="relative z-10 p-2 sm:p-3 flex flex-col h-full justify-between">
                 {/* Top Header */}
                 <div className="flex justify-between items-center border-b-[2px] border-[#FF5FCF] pb-1 sm:pb-2">
                   <div className="flex items-center gap-1 sm:gap-2">
                     <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-[#FF5FCF] border border-transparent outline outline-1 outline-[#FF5FCF]/50 outline-offset-1 animate-pulse"></span>
                     <span className="font-black text-[9px] sm:text-[11px] text-[#FF5FCF] tracking-[0.2em] uppercase">Ciphertext</span>
                   </div>
                   <span className="font-mono-code text-[#FF5FCF] text-[7px] sm:text-[9px] font-bold tracking-wider opacity-80">[AES-256]</span>
                 </div>
                 
                 {/* Center Hex Dump Fake */}
                 <div className="font-mono-code text-[8px] sm:text-[10px] text-[#FF5FCF] break-words leading-tight mt-1 mb-1 flex-1 flex flex-col justify-center">
                    <span className="animate-[pulse_1.5s_ease-in-out_infinite_alternate]">0x1A <span className="opacity-50">4F B2</span> 99 <span className="opacity-50">C0</span></span>
                    <span>D4 <span className="text-white mix-blend-difference">████</span> 8A <span className="text-white mix-blend-difference">██</span> 11</span>
                    <span className="opacity-50 tracking-widest mt-1">[ PAYLOAD ]</span>
                 </div>

                 {/* Bottom Bar progress */}
                 <div className="flex gap-1.5 items-end mt-auto">
                   <div className="flex-1 h-3 border border-[#FF5FCF] p-[1px] bg-black">
                     <div className="w-full h-full bg-[#FF5FCF] animate-[pulse_1s_ease-in-out_infinite_alternate] shadow-[0_0_10px_#FF5FCF]"></div>
                   </div>
                   <span className="text-[#FF5FCF] font-black text-[9px] sm:text-[11px] leading-none uppercase tracking-widest">LOCKED</span>
                 </div>
               </div>
            </div>

            {/* Bottom Shell (Individual Shadow applied here) */}
            <div ref={capsuleBottomRef} className="absolute bottom-0 w-full h-[50.5%] border-[5px] sm:border-[8px] border-black border-t-[3px] bg-[#FF5FCF] rounded-b-full flex items-start justify-center pt-6 sm:pt-8 z-30 transform origin-top shadow-[10px_10px_0_rgba(0,0,0,0.8)]">
               <span className="text-black font-black text-xl sm:text-3xl tracking-widest rotate-90 mt-2 sm:mt-4 ml-1">LOCK</span>
               <div className="absolute bottom-[10%] right-[15%] w-[15%] h-[70%] bg-black/10 rounded-full blur-sm"></div>
            </div>
            
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="scroll-indicator absolute bottom-[5%] w-full flex flex-col items-center z-10 pointer-events-none">
           <div className="scroll-indicator-inner w-8 h-12 border-2 border-black rounded-full flex justify-center p-1">
             <div className="w-1 h-3 bg-black rounded-full mt-1"></div>
           </div>
        </div>

        {/* ========================================================== */}
        {/* NARRATIVE FEATURE PANELS (Placed specifically to avoid overlap) */}
        {/* ========================================================== */}
        <div className="absolute inset-0 p-4 sm:p-8 w-full h-full max-w-[1400px] mx-auto pointer-events-none z-10">
           
           <div className="panel-1 absolute left-4 lg:left-12 top-[15%] lg:top-[25%] max-w-[260px] sm:max-w-xs blueprint-panel p-4 border-2 border-black bg-[#FF5FCF] shadow-[6px_6px_0_rgba(0,0,0,1)] opacity-0 hidden sm:block">
             <div className="w-full border-b-2 border-black mb-2 pb-1 font-black text-sm sm:text-lg uppercase">1. Write & Encrypt</div>
             <p className="font-mono-code text-[10px] sm:text-xs font-bold text-black/80">Message is encrypted strictly on the client browser using the recipient's public key. Zero plaintext exits your machine.</p>
           </div>

           <div className="panel-2 absolute right-4 lg:right-12 top-[40%] lg:top-[35%] max-w-[260px] sm:max-w-xs blueprint-panel p-4 border-2 border-black bg-[#FF5FCF] shadow-[6px_6px_0_rgba(0,0,0,1)] opacity-0 hidden sm:block">
             <div className="w-full border-b-2 border-black mb-2 pb-1 font-black text-sm sm:text-lg uppercase flex justify-between">
                <span>2. On-chain Lock</span>
             </div>
             <p className="font-mono-code text-[10px] sm:text-xs font-bold text-black/80">The encrypted IPFS CID is mapped securely to an ERC-721 Token. A rigid `block.timestamp` lock denies early decryption requests.</p>
           </div>
           
           <div className="panel-3 absolute left-4 right-4 sm:right-auto lg:left-12 bottom-[25%] sm:bottom-[25%] max-w-none sm:max-w-xs blueprint-panel p-4 border-2 border-black bg-[#FF5FCF] shadow-[4px_4px_0_rgba(0,0,0,1)] sm:shadow-[6px_6px_0_rgba(0,0,0,1)] opacity-0">
             <div className="w-full border-b-2 border-black mb-2 pb-1 font-black text-sm sm:text-lg uppercase flex justify-between">
                <span>3. Decrypt & Read</span>
                <span className="text-black">●</span>
             </div>
             <p className="font-mono-code text-[10px] sm:text-xs font-bold text-black/70">When conditions are met, the recipient uses their connected wallet (signature auth) to decrypt the payload seamlessly.</p>
           </div>

           {/* Right CTA / Call to action */}
           <div className="scroll-cta absolute left-4 right-4 sm:left-auto sm:right-4 lg:right-12 bottom-[8%] sm:bottom-[15%] lg:bottom-[20%] z-50 pointer-events-auto opacity-0 scale-0">
              <Link href="/dashboard" className="w-full block text-center sm:inline-block bg-black text-[#FF5FCF] py-4 px-8 font-black uppercase tracking-widest text-base sm:text-xl transition-all hover:-translate-y-2 hover:shadow-[6px_8px_0_rgba(0,0,0,0.5)] active:translate-y-0 active:shadow-none border-2 border-black">
                Enter Protocol
              </Link>
           </div>
        </div>

      </div>
    </main>
  );
}
