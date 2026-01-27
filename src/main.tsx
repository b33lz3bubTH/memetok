import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ClerkProvider } from "@clerk/clerk-react";
import { env } from "@/lib/env";

createRoot(document.getElementById("root")!).render(
  <ClerkProvider publishableKey={env.clerkPublishableKey}>
    <App />
  </ClerkProvider>
);
