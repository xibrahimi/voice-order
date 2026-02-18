import { useState, useEffect } from "react";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
    const stored = localStorage.getItem("voice-order-theme");
    if (stored === "light" || stored === "dark") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(getInitialTheme);

    useEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("dark", theme === "dark");

        // Update mobile browser chrome color
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) {
            meta.setAttribute(
                "content",
                theme === "dark" ? "#0c0f14" : "#f5f3ee"
            );
        }

        localStorage.setItem("voice-order-theme", theme);
    }, [theme]);

    const toggleTheme = () =>
        setTheme((t) => (t === "dark" ? "light" : "dark"));

    return { theme, toggleTheme } as const;
}
