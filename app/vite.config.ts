import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Solana wallet-adapter bazı Node global'lerine ihtiyaç duyar (Buffer/process).
export default defineConfig({
  plugins: [react()],
  define: { "process.env": {}, global: "globalThis" },
  resolve: { alias: { "@": "/src" } },
  server: { port: 5173 },
});
