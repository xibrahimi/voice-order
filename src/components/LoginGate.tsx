import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Lock, LogIn, Eye, EyeOff } from "lucide-react";
import {
    readStoredJSON,
    removeStoredItem,
    writeStoredJSON,
} from "../lib/storage";

interface Props {
    children: React.ReactNode;
}

const SESSION_KEY = "voiceorder_session";

type StoredSession = {
    username: string;
    password: string;
};

function normalizeSession(value: unknown): StoredSession | null {
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (typeof record.username !== "string" || typeof record.password !== "string") {
        return null;
    }
    return { username: record.username, password: record.password };
}

export function LoginGate({ children }: Props) {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [checking, setChecking] = useState(false);
    const [session, setSession] = useState<StoredSession | null>(() =>
        normalizeSession(readStoredJSON<unknown>(SESSION_KEY, null)),
    );
    const [authBootstrapReady, setAuthBootstrapReady] = useState(false);

    // Seed admin on first load
    const seedAdmin = useMutation(api.auth.seedAdmin);
    useEffect(() => {
        let cancelled = false;
        seedAdmin()
            .catch(() => { })
            .finally(() => {
                if (!cancelled) setAuthBootstrapReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [seedAdmin]);

    // Validate session against DB on load
    const shouldCheckSession = Boolean(session) && authBootstrapReady;
    const sessionCheck = useQuery(
        api.auth.login,
        shouldCheckSession
            ? { username: session!.username, password: session!.password }
            : "skip",
    );

    // Finalize the current session attempt after query resolves.
    useEffect(() => {
        if (!session || !authBootstrapReady || sessionCheck === undefined) return;

        if (sessionCheck.success) {
            writeStoredJSON<StoredSession>(SESSION_KEY, session);
            setChecking(false);
            setError("");
            return;
        }

        removeStoredItem(SESSION_KEY);
        setSession(null);
        setChecking(false);
        setError(sessionCheck.error || "Invalid credentials");
    }, [session, authBootstrapReady, sessionCheck]);

    const isRestoringSession =
        Boolean(session) && (!authBootstrapReady || sessionCheck === undefined);

    // If session is valid, show children
    if (session && sessionCheck?.success) {
        return (
            <div>
                {/* Logout bar */}
                <div className="bg-card/80 border-b border-border">
                    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-1.5 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                            Logged in as <strong className="text-foreground">{session.username}</strong>
                        </span>
                        <button
                            onClick={() => {
                                removeStoredItem(SESSION_KEY);
                                setSession(null);
                                setUsername("");
                                setPassword("");
                            }}
                            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </div>
                {children}
            </div>
        );
    }

    if (isRestoringSession) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-4">
                <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground flex items-center gap-3">
                    <div className="spinner" />
                    Restoring session...
                </div>
            </div>
        );
    }

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username.trim() || !password.trim()) {
            setError("Please enter username and password");
            return;
        }

        setChecking(true);
        setError("");

        try {
            const stored = { username: username.trim(), password: password.trim() };
            setSession(stored);
        } catch {
            setError("Something went wrong");
            setChecking(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="w-full max-w-sm">
                {/* Logo / Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-primary/20 mx-auto flex items-center justify-center mb-4">
                        <Lock className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold text-foreground">Voice Order</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Sign in to continue
                    </p>
                </div>

                {/* Login Form */}
                <form onSubmit={handleLogin} className="rounded-xl border border-border bg-card p-6 space-y-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Username
                        </label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => { setUsername(e.target.value); setError(""); }}
                            placeholder="Enter username"
                            autoFocus
                            autoComplete="username"
                            className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-foreground">
                            Password
                        </label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => { setPassword(e.target.value); setError(""); }}
                                placeholder="Enter password"
                                autoComplete="current-password"
                                className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 pr-10 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>

                    {(error || (session && sessionCheck && !sessionCheck.success)) && (
                        <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                            {error || sessionCheck?.error || "Invalid credentials"}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={checking || !authBootstrapReady}
                        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                        <LogIn className="w-4 h-4" />
                        {checking ? "Signing in..." : "Sign In"}
                    </button>
                </form>

                <p className="text-center text-xs text-muted-foreground mt-4">
                    Contact admin for access credentials
                </p>
            </div>
        </div>
    );
}
