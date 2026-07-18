/**
 * Browser polyfills required by the Solana libraries.
 *
 * @solana/web3.js and Anchor encode instructions with Node's Buffer, which does not exist
 * in the browser. Without this, on-chain actions fail at runtime with "Buffer is not
 * defined". This module must be imported before anything that touches those libraries,
 * so it is the first import in main.tsx.
 */
import { Buffer } from "buffer";

declare global {
  // eslint-disable-next-line no-var
  var Buffer: typeof import("buffer").Buffer;
}

if (typeof globalThis.Buffer === "undefined") {
  globalThis.Buffer = Buffer;
}
