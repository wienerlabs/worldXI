/**
 * Browser polyfills required by the Solana libraries.
 *
 * @solana/web3.js and Anchor encode instructions with Node's Buffer, which does not exist
 * in the browser. Without this, on-chain actions fail at runtime with "Buffer is not
 * defined". This module must be imported before anything that touches those libraries,
 * so it is the first import in main.tsx.
 */
import { Buffer as NodeBuffer } from "buffer";

// Widen globalThis locally instead of declaring a global Buffer: declaring it would
// reference the ambient Buffer type in its own annotation (TS2502).
const globals = globalThis as typeof globalThis & { Buffer?: typeof NodeBuffer };

if (typeof globals.Buffer === "undefined") {
  globals.Buffer = NodeBuffer;
}
