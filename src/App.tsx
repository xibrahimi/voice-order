import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { AudioInput } from "./components/AudioInput";
import { OrderResults } from "./components/OrderResults";
import { OrderHistory } from "./components/OrderHistory";
import { PromptAdmin } from "./components/PromptAdmin";
import { Settings, ArrowLeft, Plus, Clock } from "lucide-react";
import { readStoredJSON, writeStoredJSON } from "./lib/storage";

type View = "new" | "history" | "admin";

type PersistedAppState = {
    companyId: string;
    companyName: string;
    orderId: string | null;
    view: View;
};
type PendingAudio = {
    base64: string;
    mimeType: string;
};

const STORAGE_KEY = "voiceorder_state";

const DEFAULT_PERSISTED_STATE: PersistedAppState = {
    companyId: "",
    companyName: "",
    orderId: null,
    view: "new",
};

function normalizeView(value: unknown): View {
    if (value === "history" || value === "admin" || value === "new") return value;
    return "new";
}

export default function App() {
    const saved = readStoredJSON<Partial<PersistedAppState>>(
        STORAGE_KEY,
        DEFAULT_PERSISTED_STATE,
    );
    const [companyId, setCompanyId] = useState(
        typeof saved.companyId === "string" ? saved.companyId : "",
    );
    const [companyName, setCompanyName] = useState(
        typeof saved.companyName === "string" ? saved.companyName : "",
    );
    const [products, setProducts] = useState<any[]>([]);
    const [orderId, setOrderId] = useState<string | null>(
        typeof saved.orderId === "string" ? saved.orderId : null,
    );
    const [pendingAudio, setPendingAudio] = useState<PendingAudio | null>(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<View>(normalizeView(saved.view));

    const listCompanies = useAction(api.products.listCompanies);
    const listProducts = useAction(api.products.listProducts);
    const generateUploadUrl = useMutation(api.orders.generateUploadUrl);
    const createOrder = useMutation(api.orders.create);

    const order = useQuery(
        api.orders.get,
        orderId ? { orderId: orderId as any } : "skip",
    );
    const isOrderLoading = Boolean(orderId) && order === undefined;
    const isOrderMissing = Boolean(orderId) && order === null;
    const isOrderInFlight =
        Boolean(orderId) && (order === undefined || order?.status === "processing");
    const isAudioInputLocked = loading || isOrderLoading || order?.status === "processing";

    const [companies, setCompanies] = useState<any[]>([]);
    const [companiesLoaded, setCompaniesLoaded] = useState(false);

    // Persist key state to localStorage
    useEffect(() => {
        writeStoredJSON<PersistedAppState>(STORAGE_KEY, {
            orderId: isOrderInFlight ? orderId : null,
            companyId,
            companyName,
            view,
        });
    }, [orderId, companyId, companyName, view, isOrderInFlight]);

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
        setPendingAudio(null);
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

    const handleAudioReady = (base64: string, mimeType: string) => {
        if (!companyId || products.length === 0) {
            alert("Select a company first");
            return;
        }
        setOrderId(null);
        setPendingAudio({ base64, mimeType });
    };

    const handleCreateQuotation = async () => {
        if (!pendingAudio || loading || isOrderLoading || order?.status === "processing") {
            return;
        }
        if (!companyId || products.length === 0) {
            alert("Select a company first");
            return;
        }
        setLoading(true);
        try {
            const uploadUrl = await generateUploadUrl();

            const bytes = atob(pendingAudio.base64);
            const arr = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
            const blob = new Blob([arr], { type: pendingAudio.mimeType });

            const uploadRes = await fetch(uploadUrl, {
                method: "POST",
                headers: { "Content-Type": pendingAudio.mimeType },
                body: blob,
            });
            if (!uploadRes.ok) {
                throw new Error(`Upload failed (${uploadRes.status})`);
            }
            const uploadBody = await uploadRes.json();
            const storageId = uploadBody?.storageId;
            if (!storageId) {
                throw new Error("Upload succeeded but storageId is missing");
            }

            const newOrderId = await createOrder({
                companyId,
                companyName,
                audioStorageId: storageId,
            });
            setPendingAudio(null);
            setOrderId(newOrderId);
        } catch (err: any) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleGoToNew = () => {
        setView("new");
        if (order === null || (order && order.status !== "processing")) {
            setOrderId(null);
        }
    };

    const handleStartNewOrder = () => {
        setOrderId(null);
        setPendingAudio(null);
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
                                    onClick={handleGoToNew}
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
                            <AudioInput
                                onAudioReady={handleAudioReady}
                                disabled={isAudioInputLocked}
                                externalAudioUrl={order?.audioUrl || null}
                                externalFileName={order?.audioUrl ? "uploaded-audio" : ""}
                            />
                            {isAudioInputLocked && (
                                <p className="mt-3 text-xs text-muted-foreground">
                                    Audio input is temporarily disabled while the current order is uploading/processing.
                                </p>
                            )}
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
                            {!loading && !isOrderLoading && !orderId && pendingAudio && (
                                <div className="mb-4 rounded-lg border border-primary/30 bg-primary/10 p-3 flex items-center justify-between gap-3">
                                    <span className="text-sm text-foreground">
                                        Audio is ready. Click to create quotation.
                                    </span>
                                    <button
                                        onClick={handleCreateQuotation}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                                    >
                                        Create Quotation
                                    </button>
                                </div>
                            )}
                            {loading && (
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <div className="spinner" />
                                    <span className="text-sm">Uploading audio...</span>
                                </div>
                            )}
                            {!loading && isOrderLoading && (
                                <div className="flex items-center gap-3 text-muted-foreground">
                                    <div className="spinner" />
                                    <span className="text-sm">Loading order...</span>
                                </div>
                            )}
                            {!loading && isOrderMissing && (
                                <div className="space-y-3">
                                    <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                                        Previous order is no longer available.
                                    </div>
                                    <button
                                        onClick={handleStartNewOrder}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                    >
                                        Start New Order
                                    </button>
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
                            {order?.status === "completed" && (
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-medium">
                                        ✅ Processing complete — {order.items?.length || 0} products matched
                                    </span>
                                    <button
                                        onClick={handleStartNewOrder}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                    >
                                        Start New Order
                                    </button>
                                </div>
                            )}
                            {order?.status === "failed" && (
                                <div className="space-y-3">
                                    <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                                        Error: {order.error}
                                    </div>
                                    <button
                                        onClick={handleStartNewOrder}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                    >
                                        Start New Order
                                    </button>
                                </div>
                            )}
                            {!loading && !orderId && (
                                <p className="text-sm text-muted-foreground">
                                    Record or upload audio above, then click "Create Quotation"
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
