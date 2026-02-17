import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Plus, Rocket, RotateCcw, X, Sprout } from "lucide-react";

export function PromptAdmin() {
    const [manualTerm, setManualTerm] = useState("");
    const [manualMeaning, setManualMeaning] = useState("");

    const activePrompt = useQuery(api.prompts.getActive);
    const promptHistory = useQuery(api.prompts.getHistory);
    const pendingCorrections = useQuery(api.corrections.listPending);

    const addCorrection = useMutation(api.corrections.addCorrection);
    const applyCorrections = useMutation(api.prompts.applyCorrections);
    const rollback = useMutation(api.prompts.rollback);
    const rejectCorrection = useMutation(api.corrections.reject);
    const seedPrompt = useMutation(api.prompts.seed);

    const handleAddManualTerm = async () => {
        if (!manualTerm.trim() || !manualMeaning.trim()) return;
        await addCorrection({
            type: "manual_term",
            termHeard: manualTerm.trim(),
            termMeaning: manualMeaning.trim(),
        });
        setManualTerm("");
        setManualMeaning("");
    };

    const handleApply = async () => {
        try {
            await applyCorrections();
            alert("Corrections are being applied. The prompt will update shortly.");
        } catch (err: any) {
            alert("Error: " + err.message);
        }
    };

    const handleRollback = async (versionId: string) => {
        if (!confirm("Rollback to this version?")) return;
        await rollback({ versionId: versionId as any });
    };

    const handleSeed = async () => {
        const defaultPrompt = `You are a plumbing product order assistant for a Pakistani building materials distributor.
You receive a voice note (audio) and a product catalog. The speaker uses Urdu, Hindi, English, or a mix.

Extract every product request and match against the catalog (pipe-delimited: name|size|price).

Domain knowledge:
- 1 naali = 6 meters (pipe length). "adad" = pieces.
- aadha=1/2", pauna=3/4", dedh=1-1/2", dhai=2-1/2"
- elbow/L/moad, tee/T, socket/jodd, union, adapter/V.socket, end cap, reducer bush, P-trap, P-elbow, P-tee, Y-tee, floor trap, clean insert
- "gond"/"solution" = Weld-On solvent cement
- SCH-40 (schedule chalees), SCH-80 (schedule assi), SDR ratings
- Reducer bushes have dual sizes: "do inch se ek inch" = 2" X 1"
- If speaker doesn't specify material (UPVC/CPVC) or schedule, default to UPVC SCH-40 and note the assumption.
- ONLY return products from the catalog. Never invent.

JSON response format:
{"items":[{"name":"exact catalog name","size":"catalog size","price":number,"quantity":number,"unit":"naali or adad","confidence":"high|medium|low","notes":"any assumption"}],"unmatched":[{"heard":"what was said","reason":"why no match"}]}`;

        try {
            await seedPrompt({ prompt: defaultPrompt });
            alert("System prompt seeded (v1)!");
        } catch (err: any) {
            alert(err.message);
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
                {activePrompt ? (
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
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                        >
                            <Sprout className="w-4 h-4" /> Seed Initial Prompt
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
                        Pending Corrections ({pendingCorrections?.length || 0})
                    </h2>
                </div>
                {pendingCorrections && pendingCorrections.length > 0 ? (
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
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <Rocket className="w-4 h-4" /> Apply All Corrections
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
                {promptHistory && promptHistory.length > 0 ? (
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
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Rollback
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
