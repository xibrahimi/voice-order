import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { AudioInput } from "./components/AudioInput";
import { OrderResults } from "./components/OrderResults";
import { OrderHistory } from "./components/OrderHistory";
import { PromptAdmin } from "./components/PromptAdmin";
import { Settings, ArrowLeft, Plus, Clock } from "lucide-react";

type View = "new" | "history" | "admin";

export default function App() {
    const [companyId, setCompanyId] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [products, setProducts] = useState<any[]>([]);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState<View>("new");

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

    // Load companies and auto-select "Steel X"
    useEffect(() => {
        if (companiesLoaded) return;
        setCompaniesLoaded(true);
        listCompanies()
            .then((list: any[]) => {
                setCompanies(list);
                // Auto-select Steel X (case-insensitive partial match)
                const steelX = list.find((c: any) =>
                    c.name?.toLowerCase().includes("steel"),
                );
                if (steelX) {
                    setCompanyId(steelX._id);
                    setCompanyName(steelX.name);
                    // Load products for auto-selected company
                    listProducts({ companyId: steelX._id })
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
                <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                            🎙️ Voice Order
                        </h1>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {companyName || "Record or upload a voice note to match products"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {view !== "admin" && (
                            <>
                                <button
                                    onClick={() => setView("new")}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "new"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                        }`}
                                >
                                    <Plus className="w-4 h-4" /> New Order
                                </button>
                                <button
                                    onClick={() => setView("history")}
                                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === "history"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                                        }`}
                                >
                                    <Clock className="w-4 h-4" /> History
                                </button>
                            </>
                        )}
                        <button
                            onClick={() =>
                                setView((v) => (v === "admin" ? "new" : "admin"))
                            }
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80"
                        >
                            {view === "admin" ? (
                                <>
                                    <ArrowLeft className="w-4 h-4" /> Back
                                </>
                            ) : (
                                <>
                                    <Settings className="w-4 h-4" /> Admin
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
                {view === "admin" ? (
                    <PromptAdmin />
                ) : view === "history" ? (
                    <>
                        {/* Company selector for history */}
                        <div className="rounded-xl border border-border bg-card p-4">
                            <div className="flex items-center gap-4">
                                <label className="text-sm font-medium text-foreground whitespace-nowrap">
                                    Company:
                                </label>
                                <select
                                    value={companyId}
                                    onChange={(e) => handleCompanyChange(e.target.value)}
                                    className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                        <div className="rounded-xl border border-border bg-card p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                                    1
                                </span>
                                <h2 className="text-lg font-semibold text-foreground">
                                    Select Company
                                </h2>
                            </div>
                            <div className="flex items-center gap-4">
                                <select
                                    value={companyId}
                                    onChange={(e) => handleCompanyChange(e.target.value)}
                                    className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
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
                                    <span className="text-sm text-muted-foreground whitespace-nowrap">
                                        {products.length} products loaded
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Step 2: Audio */}
                        <div className="rounded-xl border border-border bg-card p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                                    2
                                </span>
                                <h2 className="text-lg font-semibold text-foreground">
                                    Voice Input
                                </h2>
                            </div>
                            <AudioInput onAudioReady={handleAudioReady} />
                        </div>

                        {/* Step 3: Processing Status */}
                        <div className="rounded-xl border border-border bg-card p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                                    3
                                </span>
                                <h2 className="text-lg font-semibold text-foreground">
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
