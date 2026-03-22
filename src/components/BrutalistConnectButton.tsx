"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function BrutalistConnectButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openAccountModal,
        openChainModal,
        openConnectModal,
        authenticationStatus,
        mounted,
      }) => {
        const ready = mounted && authenticationStatus !== "loading";
        const connected =
          ready &&
          account &&
          chain &&
          (!authenticationStatus ||
            authenticationStatus === "authenticated");

        return (
          <div
            {...(!ready && {
              "aria-hidden": true,
              style: {
                opacity: 0,
                pointerEvents: "none",
                userSelect: "none",
              },
            })}
            className="w-full sm:w-auto"
          >
            {(() => {
              if (!connected) {
                return (
                  <button
                    onClick={openConnectModal}
                    type="button"
                    className="bg-black text-[#FF5FCF] px-4 py-3 sm:py-2 border-2 border-black font-black uppercase tracking-widest text-xs hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none transition-all w-full sm:w-auto flex justify-center items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 bg-[#FF5FCF] rounded-full animate-ping"></div>
                    Connect Node
                  </button>
                );
              }

              if (chain.unsupported) {
                return (
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="bg-red-500 text-white px-4 py-3 sm:py-2 border-2 border-black font-black uppercase tracking-widest text-xs hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none transition-all w-full sm:w-auto flex justify-center items-center gap-2"
                  >
                    <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    Critical Error: Wrong Network
                  </button>
                );
              }

              return (
                <div className="flex gap-2 w-full sm:w-auto flex-col sm:flex-row">
                  <button
                    onClick={openChainModal}
                    type="button"
                    className="hidden sm:flex items-center justify-center bg-white text-black px-3 py-2 border-2 border-black font-black uppercase tracking-widest text-xs hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none transition-all"
                  >
                    {chain.hasIcon && (
                      <div
                        className="mr-2 w-4 h-4 rounded-full overflow-hidden border border-black"
                        style={{ background: chain.iconBackground }}
                      >
                        {chain.iconUrl && (
                          <img
                            alt={chain.name ?? "Chain icon"}
                            src={chain.iconUrl}
                            className="w-4 h-4"
                          />
                        )}
                      </div>
                    )}
                    {chain.name}
                  </button>

                  <button
                    onClick={openAccountModal}
                    type="button"
                    className="flex flex-1 sm:flex-initial items-center justify-center bg-[#FF5FCF] text-black px-4 py-3 sm:py-2 border-2 border-black font-black uppercase tracking-widest text-xs hover:-translate-y-1 hover:shadow-[4px_4px_0_rgba(0,0,0,1)] active:translate-y-0 active:shadow-none transition-all gap-2"
                  >
                    <div className="w-1.5 h-1.5 bg-black rounded-full animate-pulse border border-[#FF5FCF]"></div>
                    {account.displayBalance ? <span className="opacity-80 font-mono-code">{account.displayBalance}</span> : ""}
                    <span className="opacity-40 font-mono-code">/</span>
                    <span className="font-mono-code uppercase">{account.displayName}</span>
                  </button>
                </div>
              );
            })()}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
