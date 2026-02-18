import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Plus, Rocket, RotateCcw, X, Sprout } from "lucide-react";

export function PromptAdmin() {
    const [manualTerm, setManualTerm] = useState("");
    const [manualMeaning, setManualMeaning] = useState("");
    const [applying, setApplying] = useState(false);
    const [seeding, setSeeding] = useState(false);
    const [rollingBack, setRollingBack] = useState<string | null>(null);

    const activePrompt = useQuery(api.prompts.getActive);
    const promptHistory = useQuery(api.prompts.getHistory);
    const pendingCorrections = useQuery(api.corrections.listPending);
    const activePromptLoading = activePrompt === undefined;
    const promptHistoryLoading = promptHistory === undefined;
    const pendingCorrectionsLoading = pendingCorrections === undefined;

    const addCorrection = useMutation(api.corrections.addCorrection);
    const applyCorrections = useMutation(api.prompts.applyCorrections);
    const rollback = useMutation(api.prompts.rollback);
    const rejectCorrection = useMutation(api.corrections.reject);
    const seedPrompt = useMutation(api.prompts.seed);

    const handleAddManualTerm = async () => {
        if (!manualTerm.trim() || !manualMeaning.trim()) return;
        try {
            await addCorrection({
                type: "manual_term",
                termHeard: manualTerm.trim(),
                termMeaning: manualMeaning.trim(),
            });
            setManualTerm("");
            setManualMeaning("");
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const handleApply = async () => {
        if (applying) return;
        setApplying(true);
        try {
            await applyCorrections();
            alert("Corrections are being applied. The prompt will update shortly.");
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setApplying(false);
        }
    };

    const handleRollback = async (versionId: string) => {
        if (!confirm("Rollback to this version?") || rollingBack) return;
        setRollingBack(versionId);
        try {
            await rollback({ versionId: versionId as any });
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setRollingBack(null);
        }
    };

    const handleSeed = async () => {
        try {
            setSeeding(true);
            await seedPrompt({});
            alert("System prompt seeded (v1)!");
        } catch (err: any) {
            alert(err.message);
        } finally {
            setSeeding(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Active Prompt */}
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                        📝
                    </span>
                    <h2 className="text-lg font-semibold text-foreground">
                        Active System Prompt
                    </h2>
                </div>
                {activePromptLoading ? (
                    <p className="text-sm text-muted-foreground">Loading active prompt...</p>
                ) : activePrompt ? (
                    <>
                        <div className="flex items-center gap-2 mb-3">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-400">
                                v{activePrompt.version}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                                {activePrompt.source}
                            </span>
                            <span className="text-xs text-muted-foreground">
                                {activePrompt.changeDescription}
                            </span>
                        </div>
                        <pre className="prompt-text">{activePrompt.prompt}</pre>
                    </>
                ) : (
                    <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                            No system prompt found. Seed the initial prompt to get started:
                        </p>
                        <button
                            onClick={handleSeed}
                            disabled={seeding}
                            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${seeding ? "bg-emerald-500/10 text-emerald-400/50 cursor-not-allowed" : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"}`}
                        >
                            <Sprout className="w-4 h-4" /> {seeding ? "Seeding..." : "Seed Initial Prompt"}
                        </button>
                    </div>
                )}
            </div>

            {/* Add Terminology */}
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                        📚
                    </span>
                    <h2 className="text-lg font-semibold text-foreground">
                        Add Terminology
                    </h2>
                </div>
                <div className="flex gap-3">
                    <input
                        type="text"
                        placeholder='Local term (e.g., "chooda pipe")'
                        value={manualTerm}
                        onChange={(e) => setManualTerm(e.target.value)}
                        className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <input
                        type="text"
                        placeholder='Meaning (e.g., "4 inch UPVC pipe")'
                        value={manualMeaning}
                        onChange={(e) => setManualMeaning(e.target.value)}
                        className="flex-1 bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <button
                        onClick={handleAddManualTerm}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                    >
                        <Plus className="w-4 h-4" /> Add
                    </button>
                </div>
            </div>

            {/* Pending Corrections */}
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                        🔄
                    </span>
                    <h2 className="text-lg font-semibold text-foreground">
                        Pending Corrections ({pendingCorrectionsLoading ? "..." : pendingCorrections?.length || 0})
                    </h2>
                </div>
                {pendingCorrectionsLoading ? (
                    <p className="text-sm text-muted-foreground">Loading pending corrections...</p>
                ) : pendingCorrections && pendingCorrections.length > 0 ? (
                    <div className="space-y-3">
                        {pendingCorrections.map((c: any) => (
                            <div
                                key={c._id}
                                className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/40 border border-border"
                            >
                                <div className="text-sm">
                                    <span className="font-medium text-foreground">
                                        "{c.termHeard}"
                                    </span>
                                    <span className="text-muted-foreground"> → {c.termMeaning}</span>
                                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-400">
                                        {c.type}
                                    </span>
                                </div>
                                <button
                                    onClick={() => rejectCorrection({ correctionId: c._id })}
                                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                    title="Reject"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={handleApply}
                            disabled={applying}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${applying ? "bg-primary/50 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                        >
                            <Rocket className="w-4 h-4" /> {applying ? "Applying..." : "Apply All Corrections"}
                        </button>
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No pending corrections</p>
                )}
            </div>

            {/* Prompt History */}
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 mb-4">
                    <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                        📜
                    </span>
                    <h2 className="text-lg font-semibold text-foreground">
                        Prompt History
                    </h2>
                </div>
                {promptHistoryLoading ? (
                    <p className="text-sm text-muted-foreground">Loading prompt history...</p>
                ) : promptHistory && promptHistory.length > 0 ? (
                    <div className="space-y-2">
                        {promptHistory.map((v: any) => (
                            <div
                                key={v._id}
                                className={`flex items-center justify-between gap-4 p-3 rounded-lg border transition-colors ${v.status === "active"
                                    ? "bg-primary/5 border-primary/30"
                                    : "bg-secondary/40 border-border"
                                    }`}
                            >
                                <div className="flex items-center gap-2 text-sm">
                                    <span className="font-semibold text-foreground">v{v.version}</span>
                                    <span className="text-muted-foreground">— {v.changeDescription}</span>
                                    <span
                                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${v.status === "active"
                                            ? "bg-emerald-500/20 text-emerald-400"
                                            : "bg-secondary text-muted-foreground"
                                            }`}
                                    >
                                        {v.status}
                                    </span>
                                </div>
                                {v.status !== "active" && (
                                    <button
                                        onClick={() => handleRollback(v._id)}
                                        disabled={rollingBack === v._id}
                                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${rollingBack === v._id ? "bg-secondary/50 cursor-not-allowed opacity-50" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}
                                    >
                                        <RotateCcw className={`w-3.5 h-3.5 ${rollingBack === v._id ? "animate-spin" : ""}`} /> {rollingBack === v._id ? "Rolling back..." : "Rollback"}
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">No prompt versions yet</p>
                )}
            </div>
        </div>
    );
}
