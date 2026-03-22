/**
 * Capsul.Me — Encryption Layer
 * 
 * For testnet development, we use a mock encryption that simulates
 * the Lit Protocol flow. The real time-lock security is enforced
 * by the smart contract's block.timestamp check on openCapsule().
 * 
 * For production: replace mock with real Lit Protocol v6 encrypt() call.
 * Docs: https://developer.litprotocol.com/sdk/access-control/encryption
 */

export interface EncryptedPayload {
  ciphertext: string;
  dataToEncryptHash: string;
  accessControlConditions: object[];
}

export const encryptCapsuleMessage = async (
  message: string,
  recipientAddress: string,
  unlockTimestamp: number
): Promise<EncryptedPayload> => {
  
  // Build Access Control Conditions (for future real Lit integration)
  const accessControlConditions = [
    {
      contractAddress: "",
      standardContractType: "",
      chain: "baseSepolia",
      method: "",
      parameters: [":userAddress"],
      returnValueTest: {
        comparator: "=",
        value: recipientAddress,
      },
    },
  ];

  try {
    // ─── Production Lit Protocol v6 (uncomment when ready) ───────────────
    // import { LitNodeClient, encryptString } from "@lit-protocol/lit-node-client";
    // const client = new LitNodeClient({ litNetwork: "datil", debug: false });
    // await client.connect();
    // const { ciphertext, dataToEncryptHash } = await encryptString(
    //   { accessControlConditions, dataToEncrypt: message },
    //   client
    // );
    // await client.disconnect();
    // return { ciphertext, dataToEncryptHash, accessControlConditions };
    // ─────────────────────────────────────────────────────────────────────

    // ─── Testnet Mock Encryption ─────────────────────────────────────────
    // Simulates encryption pipeline for testnet development.
    // The actual capsule lock is enforced on-chain via block.timestamp.
    await new Promise(r => setTimeout(r, 800)); // simulate async work
    
    const encoded = btoa(unescape(encodeURIComponent(message)));
    const timestamp = Date.now().toString(36);
    const recipientSlug = recipientAddress.slice(2, 8).toLowerCase();
    
    return {
      ciphertext: `ENC_${recipientSlug}_${timestamp}_${encoded}`,
      dataToEncryptHash: `HASH_${unlockTimestamp}_${timestamp}`,
      accessControlConditions,
    };
    // ─────────────────────────────────────────────────────────────────────

  } catch (error) {
    console.error("Encryption error:", error);
    throw new Error("Failed to encrypt message payload.");
  }
};
