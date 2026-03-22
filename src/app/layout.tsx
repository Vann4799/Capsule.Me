import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Capsul.Me — Send Encrypted Web3 Messages",
  description: "Time-locked NFT messages. Write now, read later.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <Providers>
          {/* Desktop Only Content */}
          <div className="hidden md:block min-h-screen">
            {children}
          </div>

          {/* Mobile Blocker Warning */}
          <div className="md:hidden fixed inset-0 z-[9999] bg-black text-[#FF5FCF] flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden">
            
            {/* Background Glitch Effects */}
            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,#FF5FCF 2px,#FF5FCF 4px), repeating-linear-gradient(90deg,transparent,transparent 2px,#FF5FCF 2px,#FF5FCF 4px)", backgroundSize: "12px 12px" }}></div>
            
            <div className="relative z-10 border-[4px] border-[#FF5FCF] bg-black p-8 max-w-sm flex flex-col items-center gap-6 shadow-[8px_8px_0_rgba(255,95,207,0.6)]">
              
              <div className="w-16 h-16 bg-[#FF5FCF] flex items-center justify-center animate-pulse shadow-[0_0_20px_#FF5FCF]">
                 <span className="font-black text-black text-4xl leading-none font-mono-code">!</span>
              </div>
              
              <div>
                <h1 className="text-3xl font-black uppercase tracking-tighter leading-none mb-2 text-white">Access Denied</h1>
                <h2 className="font-mono-code text-xs font-bold uppercase tracking-[0.2em] text-[#FF5FCF] opacity-80">Resolution Too Low</h2>
              </div>
              
              <p className="font-mono-code text-sm font-bold text-white/80 leading-relaxed border-t-2 border-[#FF5FCF]/30 pt-4">
                Mobile terminal operations are strictly prohibited by protocol.
              </p>
              
              <div className="bg-[#FF5FCF]/10 border-l-4 border-[#FF5FCF] p-4 text-left w-full">
                <p className="font-mono-code text-[10px] sm:text-xs text-[#FF5FCF] leading-relaxed relative">
                  <span className="animate-[pulse_1s_infinite] absolute -left-2 top-0 opacity-50">▌</span>
                  {'> '}SYS.WARN: Viewport limitation detected.<br/>
                  {'> '}ACTION: Switch to a Desktop IDE or Laptop browser to initialize AES-256 decryption node.
                </p>
              </div>

            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
