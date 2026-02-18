import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { FileDown, Tag } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
    order: any;
    companyName: string;
}

export function OrderResults({ order, companyName }: Props) {
    const [teachForm, setTeachForm] = useState<{ heard: string } | null>(null);
    const [teachMeaning, setTeachMeaning] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const addCorrection = useMutation(api.corrections.addCorrection);

    const items = order.items || [];
    const unmatched = order.unmatched || [];

    let grandTotal = 0;
    for (const item of items) grandTotal += item.catalogPrice * item.quantity;

    const submitTeach = async () => {
        if (!teachForm || !teachMeaning.trim() || submitting) return;
        setSubmitting(true);
        try {
            await addCorrection({
                orderId: order._id,
                type: "teach_term",
                termHeard: teachForm.heard,
                termMeaning: teachMeaning.trim(),
            });
            setTeachForm(null);
            setTeachMeaning("");
            alert("Correction saved! Go to Admin → Apply to update the system prompt.");
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const downloadPDF = () => {
        const doc = new jsPDF({ orientation: "landscape" });
        const date = new Date().toLocaleDateString("en-PK", {
            day: "2-digit", month: "short", year: "numeric",
        });

        doc.setFontSize(16);
        doc.text("Voice Order", 14, 18);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`${companyName} — ${date}`, 14, 25);
        doc.setTextColor(0);

        let pdfTotal = 0;
        const rows = items.map((item: any, i: number) => {
            const lineTotal = item.catalogPrice * item.quantity;
            pdfTotal += lineTotal;
            return [
                i + 1, item.name, item.size, item.quantity, item.unit,
                `Rs ${item.catalogPrice.toLocaleString()}`,
                `Rs ${lineTotal.toLocaleString()}`,
            ];
        });

        autoTable(doc, {
            startY: 32,
            head: [["#", "Product", "Size", "Qty", "Unit", "Unit Price", "Total"]],
            body: rows,
            foot: [["", "", "", "", "", "Grand Total", `Rs ${pdfTotal.toLocaleString()}`]],
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [108, 99, 255], textColor: 255 },
            footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
        });

        doc.save(`order-${companyName.toLowerCase()}-${Date.now()}.pdf`);
    };

    const confidenceBadge = (c: string) => {
        const colors: Record<string, string> = {
            high: "bg-emerald-500/20 text-emerald-400",
            medium: "bg-amber-500/20 text-amber-400",
            low: "bg-red-500/20 text-red-400",
        };
        return (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[c] || colors.low}`}>
                {c}
            </span>
        );
    };

    return (
        <div className="space-y-6">
            {/* Transcript */}
            {order.transcript && (
                <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                        🗣️ Transcript
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {order.transcript}
                    </p>
                </div>
            )}

            {items.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-foreground">
                            Matched Products ({items.length})
                        </h3>
                        <button
                            onClick={downloadPDF}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                            <FileDown className="w-4 h-4" /> PDF
                        </button>
                    </div>
                    {/* Mobile card layout — 3-tier visual hierarchy */}
                    <div className="sm:hidden space-y-2.5">
                        {items.map((item: any, i: number) => {
                            const lineTotal = item.catalogPrice * item.quantity;
                            return (
                                <div key={item._id || i} className="card-accent rounded-lg border border-border/60 bg-card p-3.5 space-y-2">
                                    {/* Tier 1: Product name + badge (F-pattern: left=name, right=badge) */}
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className="text-[15px] font-semibold text-foreground leading-snug min-w-0">
                                            <span className="text-muted-foreground font-normal text-xs mr-1">{i + 1}.</span>
                                            {item.name}
                                        </h4>
                                        {confidenceBadge(item.confidence)}
                                    </div>
                                    {/* Tier 2: Compact metadata tokens (Miller's Law — chunked) */}
                                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/60">{item.size}</span>
                                        <span className="text-border/80">·</span>
                                        <span>{item.quantity} {item.unit}</span>
                                    </div>
                                    {/* Tier 3: Price row (F-pattern: unit price left, total right with primary color) */}
                                    <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
                                        <span className="text-xs text-muted-foreground tabular-nums">₨ {item.catalogPrice.toLocaleString()} × {item.quantity}</span>
                                        <span className="text-sm font-bold text-primary tabular-nums">₨ {lineTotal.toLocaleString()}</span>
                                    </div>
                                    {item.notes && <p className="text-[11px] text-muted-foreground/80 italic">{item.notes}</p>}
                                </div>
                            );
                        })}
                        {/* Grand Total — visually distinct (Peak-End Rule) */}
                        <div className="flex items-center justify-between p-4 rounded-lg bg-primary/15 border border-primary/30">
                            <span className="text-sm font-bold text-foreground">Grand Total</span>
                            <span className="text-lg font-bold text-primary tabular-nums">₨ {grandTotal.toLocaleString()}</span>
                        </div>
                    </div>
                    {/* Desktop table layout */}
                    <div className="hidden sm:block table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>#</th><th>Product</th><th>Size</th><th>Qty</th>
                                    <th>Unit</th><th>Price</th><th>Total</th>
                                    <th>Confidence</th><th>Notes</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item: any, i: number) => {
                                    const lineTotal = item.catalogPrice * item.quantity;
                                    return (
                                        <tr key={item._id || i} className="hover:bg-secondary/30 transition-colors">
                                            <td className="text-muted-foreground">{i + 1}</td>
                                            <td className="font-medium">{item.name}</td>
                                            <td>{item.size}</td>
                                            <td>{item.quantity}</td>
                                            <td>{item.unit}</td>
                                            <td className="tabular-nums">₨ {item.catalogPrice.toLocaleString()}</td>
                                            <td className="tabular-nums font-medium">₨ {lineTotal.toLocaleString()}</td>
                                            <td>{confidenceBadge(item.confidence)}</td>
                                            <td className="text-muted-foreground text-xs">{item.notes || "—"}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={6} className="text-right font-bold">Grand Total</td>
                                    <td className="font-bold tabular-nums">₨ {grandTotal.toLocaleString()}</td>
                                    <td colSpan={2} />
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {unmatched.length > 0 && (
                <div className="rounded-xl border border-border bg-card p-3 sm:p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                        Unmatched Items ({unmatched.length})
                    </h3>
                    <div className="space-y-2">
                        {unmatched.map((u: any, i: number) => (
                            <div
                                key={u._id || i}
                                className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/40 border border-border"
                            >
                                <div className="text-sm">
                                    <span className="font-medium text-foreground">"{u.heard}"</span>
                                    <span className="text-muted-foreground"> — {u.reason}</span>
                                </div>
                                <button
                                    onClick={() => { setTeachForm({ heard: u.heard }); setTeachMeaning(""); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors whitespace-nowrap"
                                >
                                    <Tag className="w-3.5 h-3.5" /> Teach
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Teach Modal */}
            {teachForm && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3" style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
                    <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-md space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
                        <h4 className="text-lg font-semibold text-foreground">
                            Teach: "{teachForm.heard}"
                        </h4>
                        <p className="text-sm text-muted-foreground">
                            What does this term actually mean?
                        </p>
                        <input
                            type="text"
                            value={teachMeaning}
                            onChange={(e) => setTeachMeaning(e.target.value)}
                            placeholder='e.g., "4 inch UPVC SCH-40 pipe"'
                            autoFocus
                            className="w-full bg-secondary border border-border rounded-lg px-4 py-2.5 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                        <div className="flex gap-3 justify-end">
                            <button
                                onClick={() => setTeachForm(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitTeach}
                                disabled={submitting}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${submitting ? "bg-primary/50 cursor-not-allowed" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
                            >
                                {submitting ? "Saving..." : "Save Correction"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
