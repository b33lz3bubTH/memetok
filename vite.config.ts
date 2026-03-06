import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: true, // Binds to all interfaces (0.0.0.0), allowing access via localhost:8080 AND external tunnels
    port: 8080,
    allowedHosts: [
      // Allow localhost/local access (already default, but explicit for clarity)
      "localhost",
      "127.0.0.1",
      // Allow Cloudflare tunnel hosts (use wildcard for flexibility during dev)
      ".trycloudflare.com",
      // Add specific tunnel if needed: "your-specific-subdomain.trycloudflare.com"
    ],
    hmr: {
      overlay: false,
      // Optional: Explicitly set HMR host to support tunnel (Vite will auto-detect, but this ensures it)
      host: true, // or "localhost" if you prefer local-only HMR
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));