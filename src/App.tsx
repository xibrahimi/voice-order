import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { AudioInput } from "./components/AudioInput";
import { OrderResults } from "./components/OrderResults";
import { OrderHistory } from "./components/OrderHistory";
import { PromptAdmin } from "./components/PromptAdmin";
import { Settings, ArrowLeft, Plus, Clock } from "lucide-react";

type View = "new" | "history" | "admin";

// localStorage helpers
const STORAGE_KEY = "voiceorder_state";
function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}
function saveState(patch: Record<string, any>) {
    try {
        const cur = loadState();
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...patch }));
    } catch { }
}

export default function App() {
    const saved = loadState();
    const [companyId, setCompanyId] = useState(saved.companyId || "");
    const [companyName, setCompanyName] = useState(saved.companyName || "");
    const [products, setProducts] = useState<any[]>([]);
    const [orderId, setOrderId] = useState<string | null>(saved.orderId || null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<View>(saved.view || "new");

    const listCompanies = useAction(api.products.listCompanies);
    const listProducts = useAction(api.products.listProducts);
    const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
    const createOrder = useMutation(api.orders.create);

    const order = useQuery(
        api.orders.get,
        orderId ? { orderId: orderId as any } : "skip",
    );

    const [companies, setCompanies] = useState<any[]>([]);
    const [companiesLoaded, setCompaniesLoaded] = useState(false);

    // Persist key state to localStorage
    useEffect(() => {
        saveState({ orderId, companyId, companyName, view });
    }, [orderId, companyId, companyName, view]);

    // Load companies and auto-select "Steel X"
    useEffect(() => {
        if (companiesLoaded) return;
        setCompaniesLoaded(true);
        listCompanies()
            .then((list: any[]) => {
                setCompanies(list);
                // If we have a saved companyId, load its products
                const target = companyId
                    ? list.find((c: any) => c._id === companyId)
                    : list.find((c: any) => c.name?.toLowerCase().includes("steel"));
                if (target) {
                    setCompanyId(target._id);
                    setCompanyName(target.name);
                    listProducts({ companyId: target._id })
                        .then(setProducts)
                        .catch(console.error);
                }
            })
            .catch(console.error);
    }, [companiesLoaded]);

    const handleCompanyChange = async (id: string) => {
        setCompanyId(id);
        setOrderId(null);
        if (!id) {
            setProducts([]);
            setCompanyName("");
            return;
        }
        const selected = companies.find((c: any) => c._id === id);
        setCompanyName(selected?.name || "");
        try {
            const prods = await listProducts({ companyId: id });
            setProducts(prods);
        } catch (err) {
            console.error(err);
        }
    };

    const handleAudioReady = async (base64: string, mimeType: string) => {
        if (!companyId || products.length === 0) {
            alert("Select a company first");
            return;
        }
        setLoading(true);
        setOrderId(null);

        try {
            const uploadUrl = await generateUploadUrl();

            const bytes = atob(base64);
            const arr = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
            const blob = new Blob([arr], { type: mimeType });

            const uploadRes = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": mimeType },
                body: blob,
            });
            const { storageId } = await uploadRes.json();

            const newOrderId = await createOrder({
                companyId,
                companyName,
                audioStorageId: storageId,
            });
            setOrderId(newOrderId);
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-2xl font-bold text-foreground flex items-center gap-2">
                            🎙️ <span className="truncate">Voice Order</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 truncate">
                            {companyName || "Record a voice note to match products"}
                        </p>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                        {view !== "admin" && (
                            <>
                                <button
                                    onClick={() => setView("new")}
                                    className={`inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${view === "new"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                        }`}
                                >
                                    <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden xs:inline">New</span>
                                    <span className="hidden sm:inline"> Order</span>
                                </button>
                                <button
                                    onClick={() => setView("history")}
                                    className={`inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors ${view === "history"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                        }`}
                                >
                                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">History</span>
                                </button>
                            </>
                        )}
                        <button
                            onClick={() =>
                                setView((v) => (v === "admin" ? "new" : "admin"))
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        >
                            {view === "admin" ? (
                                <>
                                    <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span className="hidden sm:inline">Back</span>
                                </>
                            ) : (
                                <>
                                    <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
                {view === "admin" ? (
                    <PromptAdmin />
                ) : view === "history" ? (
                    <>
                        {/* Company selector for history */}
                        <div className="rounded-xl border border-border bg-card p-3 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                                <label className="text-sm font-medium text-foreground whitespace-nowrap">
                                    Company:
                                </label>
                                <select
                                    value={companyId}
                                    onChange={(e) => handleCompanyChange(e.target.value)}
                                    className="w-full sm:flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">All Companies</option>
                                    {companies.map((c: any) => (
                                        <option key={c._id} value={c._id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <OrderHistory companyId={companyId} companyName={companyName} />
                    </>
                ) : (
                    <>
                        {/* Step 1: Company */}
                        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 text-primary text-xs sm:text-sm font-bold flex items-center justify-center flex-shrink-0">
                                    1
                                </span>
                                <h2 className="text-base sm:text-lg font-semibold text-foreground">
                                    Select Company
                                </h2>
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                                <select
                                    value={companyId}
                                    onChange={(e) => handleCompanyChange(e.target.value)}
                                    className="w-full sm:flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                                >
                                    <option value="">
                                        {companies.length === 0
                                            ? "Loading companies..."
                                            : "Select a company..."}
                                    </option>
                                    {companies.map((c: any) => (
                                        <option key={c._id} value={c._id}>
                                            {c.name}
                                        </option>
                                    ))}
                                </select>
                                {products.length > 0 && (
                                    <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                                        {products.length} products loaded
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Step 2: Audio */}
                        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 text-primary text-xs sm:text-sm font-bold flex items-center justify-center flex-shrink-0">
                                    2
                                </span>
                                <h2 className="text-base sm:text-lg font-semibold text-foreground">
                                    Voice Input
                                </h2>
                            </div>
                            <AudioInput onAudioReady={handleAudioReady} />
                        </div>

                        {/* Step 3: Processing Status */}
                        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 text-primary text-xs sm:text-sm font-bold flex items-center justify-center flex-shrink-0">
                                    3
                                </span>
                                <h2 className="text-base sm:text-lg font-semibold text-foreground">
                                    Match Products
                                </h2>
                            </div>
                            {loading && (
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <div className="spinner" />
                                    <span className="text-sm">Uploading audio...</span>
                                </div>
                            )}
                            {order?.status === "processing" && (
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <div className="spinner" />
                                    <span className="text-sm">
                                        Analyzing audio with Gemini 3 Flash...
                                    </span>
                                </div>
                            )}
                            {order?.status === "failed" && (
                                <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                                    Error: {order.error}
                                </div>
                            )}
                            {!loading && !order && (
                                <p className="text-sm text-muted-foreground">
                                    Record or upload audio above to start processing
                                </p>
                            )}
                        </div>

                        {/* Results */}
                        {order?.status === "completed" && (
                            <OrderResults order={order} companyName={companyName} />
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
