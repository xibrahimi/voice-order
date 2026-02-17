import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import { LoginGate } from "./components/LoginGate";
import "./style.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

createRoot(document.getElementById("app")!).render(
    <StrictMode>
        <ConvexProvider client={convex}>
            <LoginGate>
                <App />
            </LoginGate>
        </ConvexProvider>
    </StrictMode>,
);
