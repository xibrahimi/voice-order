import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import {
    ChevronDown,
    ChevronUp,
    FileDown,
    Tag,
    Clock,
    CheckCircle,
    XCircle,
    Loader2,
    Volume2,
    Code,
    MessageSquareText,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface Props {
    companyId: string;
    companyName: string;
}

export function OrderHistory({ companyId, companyName }: Props) {
    const orders = useQuery(
        api.orders.listWithDetails,
        companyId ? { companyId } : {},
    );
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [showJsonId, setShowJsonId] = useState<string | null>(null);
    const [showTranscriptId, setShowTranscriptId] = useState<string | null>(null);
    const [teachForm, setTeachForm] = useState<{
        heard: string;
        orderId: string;
    } | null>(null);
    const [teachMeaning, setTeachMeaning] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const addCorrection = useMutation(api.corrections.addCorrection);

    const toggle = (id: string) =>
        setExpandedId((prev) => (prev === id ? null : id));

    const submitTeach = async () => {
        if (!teachForm || !teachMeaning.trim() || submitting) return;
        setSubmitting(true);
        try {
            await addCorrection({
                orderId: teachForm.orderId as any,
                type: "teach_term",
                termHeard: teachForm.heard,
                termMeaning: teachMeaning.trim(),
            });
            setTeachForm(null);
            setTeachMeaning("");
            alert("Correction saved!");
        } catch (err: any) {
            alert("Error: " + err.message);
        } finally {
            setSubmitting(false);
        }
    };

    const formatDate = (ts: number) =>
        new Date(ts).toLocaleString("en-PK", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });

    const statusIcon = (status: string) => {
        switch (status) {
            case "completed":
                return <CheckCircle className="w-4 h-4 text-emerald-400" />;
            case "failed":
                return <XCircle className="w-4 h-4 text-red-400" />;
            case "processing":
                return <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />;
            default:
                return <Clock className="w-4 h-4 text-muted-foreground" />;
        }
    };

    const statusLabel = (status: string) => {
        const styles: Record<string, string> = {
            completed: "bg-emerald-500/20 text-emerald-400",
            failed: "bg-red-500/20 text-red-400",
            processing: "bg-amber-500/20 text-amber-400",
        };
        return (
            <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || "bg-secondary text-muted-foreground"}`}
            >
                {status}
            </span>
        );
    };

    const confidenceBadge = (c: string) => {
        const colors: Record<string, string> = {
            high: "bg-emerald-500/20 text-emerald-400",
            medium: "bg-amber-500/20 text-amber-400",
            low: "bg-red-500/20 text-red-400",
        };
        return (
            <span
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[c] || colors.low}`}
            >
                {c}
            </span>
        );
    };

    const downloadPDF = (order: any) => {
        const doc = new jsPDF({ orientation: "landscape" });
        const date = formatDate(order._creationTime);

        doc.setFontSize(16);
        doc.text("Voice Order Quotation", 14, 18);
        doc.setFontSize(10);
        doc.setTextColor(100);
        doc.text(`${order.companyName || companyName} — ${date}`, 14, 25);
        doc.setTextColor(0);

        const items = order.items || [];
        let pdfTotal = 0;
        const rows = items.map((item: any, i: number) => {
            const lineTotal = item.catalogPrice * item.quantity;
            pdfTotal += lineTotal;
            return [
                i + 1,
                item.name,
                item.size,
                item.quantity,
                item.unit,
                `Rs ${item.catalogPrice.toLocaleString()}`,
                `Rs ${lineTotal.toLocaleString()}`,
            ];
        });

        autoTable(doc, {
            startY: 32,
            head: [["#", "Product", "Size", "Qty", "Unit", "Unit Price", "Total"]],
            body: rows,
            foot: [
                [
                    "",
                    "",
                    "",
                    "",
                    "",
                    "Grand Total",
                    `Rs ${pdfTotal.toLocaleString()}`,
                ],
            ],
            styles: { fontSize: 9, cellPadding: 3 },
            headStyles: { fillColor: [108, 99, 255], textColor: 255 },
            footStyles: {
                fillColor: [240, 240, 240],
                textColor: 0,
                fontStyle: "bold",
            },
        });

        if (order.unmatched?.length > 0) {
            const finalY = (doc as any).lastAutoTable.finalY || 50;
            doc.setFontSize(11);
            doc.text("Unmatched Items:", 14, finalY + 10);
            doc.setFontSize(9);
            order.unmatched.forEach((u: any, i: number) => {
                doc.text(
                    `${i + 1}. "${u.heard}" — ${u.reason}`,
                    14,
                    finalY + 18 + i * 6,
                );
            });
        }

        doc.save(
            `quotation-${(order.companyName || companyName).toLowerCase().replace(/\s+/g, "-")}-${Date.now()}.pdf`,
        );
    };

    if (!orders) {
        return (
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                    <div className="spinner" />
                    <span className="text-sm">Loading order history...</span>
                </div>
            </div>
        );
    }

    if (orders.length === 0) {
        return (
            <div className="rounded-xl border border-border bg-card p-6">
                <p className="text-sm text-muted-foreground">
                    No orders yet. Record a voice note above to create your first
                    quotation.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-foreground">
                    📋 Order History ({orders.length})
                </h3>
            </div>

            {orders.map((order: any) => {
                const isExpanded = expandedId === order._id;
                const items = order.items || [];
                const unmatched = order.unmatched || [];
                let total = 0;
                for (const item of items)
                    total += (item.catalogPrice || 0) * (item.quantity || 0);

                return (
                    <div
                        key={order._id}
                        className="rounded-xl border border-border bg-card overflow-hidden transition-all"
                    >
                        {/* Summary row */}
                        <button
                            onClick={() => toggle(order._id)}
                            className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
                        >
                            <div className="flex items-center gap-2">
                                {statusIcon(order.status)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-medium text-foreground text-sm">
                                        {order.companyName || "Unknown"}
                                    </span>
                                    {statusLabel(order.status)}
                                    {items.length > 0 && (
                                        <span className="text-xs text-muted-foreground">
                                            {items.length} items
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        {formatDate(order._creationTime)}
                                    </span>
                                    {total > 0 && (
                                        <span className="font-medium text-foreground">
                                            ₨ {total.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {order.status === "completed" && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            downloadPDF(order);
                                        }}
                                        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                                        title="Download PDF"
                                    >
                                        <FileDown className="w-4 h-4" />
                                    </button>
                                )}
                                {isExpanded ? (
                                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                            </div>
                        </button>

                        {/* Expanded details */}
                        {isExpanded && (
                            <div className="border-t border-border px-5 py-4 space-y-4">
                                {/* Audio Player */}
                                {order.audioUrl && (
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <Volume2 className="w-3.5 h-3.5" />
                                            <span>Original Audio</span>
                                        </div>
                                        <audio
                                            src={order.audioUrl}
                                            controls
                                            className="w-full h-10"
                                        />
                                    </div>
                                )}

                                {/* Transcript */}
                                {order.transcript && (
                                    <div>
                                        <button
                                            onClick={() => setShowTranscriptId(showTranscriptId === order._id ? null : order._id)}
                                            className="flex items-center gap-2 text-sm font-semibold text-foreground hover:text-primary transition-colors"
                                        >
                                            <MessageSquareText className="w-4 h-4" />
                                            Transcript
                                            {showTranscriptId === order._id ? (
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            ) : (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                        {showTranscriptId === order._id && (
                                            <div className="mt-2 p-3 rounded-lg bg-secondary/40 border border-border text-sm text-foreground leading-relaxed">
                                                {order.transcript}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Error message */}
                                {order.status === "failed" && order.error && (
                                    <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                                        Error: {order.error}
                                    </div>
                                )}

                                {/* Matched Items Table */}
                                {items.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-foreground mb-2">
                                            Matched Products ({items.length})
                                        </h4>
                                        <div className="table-wrap">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>#</th>
                                                        <th>Product</th>
                                                        <th>Size</th>
                                                        <th>Qty</th>
                                                        <th>Unit</th>
                                                        <th>Price</th>
                                                        <th>Total</th>
                                                        <th>Conf.</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((item: any, i: number) => {
                                                        const lineTotal =
                                                            (item.catalogPrice || 0) * (item.quantity || 0);
                                                        return (
                                                            <tr
                                                                key={item._id || i}
                                                                className="hover:bg-secondary/30 transition-colors"
                                                            >
                                                                <td className="text-muted-foreground">
                                                                    {i + 1}
                                                                </td>
                                                                <td className="font-medium">{item.name}</td>
                                                                <td>{item.size}</td>
                                                                <td>{item.quantity}</td>
                                                                <td>{item.unit}</td>
                                                                <td className="tabular-nums">
                                                                    ₨ {(item.catalogPrice || 0).toLocaleString()}
                                                                </td>
                                                                <td className="tabular-nums font-medium">
                                                                    ₨ {lineTotal.toLocaleString()}
                                                                </td>
                                                                <td>{confidenceBadge(item.confidence)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot>
                                                    <tr>
                                                        <td colSpan={6} className="text-right font-bold">
                                                            Grand Total
                                                        </td>
                                                        <td className="font-bold tabular-nums">
                                                            ₨ {total.toLocaleString()}
                                                        </td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Unmatched Items */}
                                {unmatched.length > 0 && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-foreground mb-2">
                                            Unmatched Items ({unmatched.length})
                                        </h4>
                                        <div className="space-y-2">
                                            {unmatched.map((u: any, i: number) => (
                                                <div
                                                    key={u._id || i}
                                                    className="flex items-center justify-between gap-4 p-3 rounded-lg bg-secondary/40 border border-border"
                                                >
                                                    <div className="text-sm">
                                                        <span className="font-medium text-foreground">
                                                            "{u.heard}"
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            {" "}
                                                            — {u.reason}
                                                        </span>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            setTeachForm({
                                                                heard: u.heard,
                                                                orderId: order._id,
                                                            });
                                                            setTeachMeaning("");
                                                        }}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors whitespace-nowrap"
                                                    >
                                                        <Tag className="w-3.5 h-3.5" /> Teach
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Raw JSON Toggle */}
                                {order.rawGeminiResponse && (
                                    <div>
                                        <button
                                            onClick={() => setShowJsonId(showJsonId === order._id ? null : order._id)}
                                            className="flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            <Code className="w-4 h-4" />
                                            Raw LLM Response
                                            {showJsonId === order._id ? (
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            ) : (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                        {showJsonId === order._id && (
                                            <pre className="mt-2 p-3 rounded-lg bg-secondary/60 border border-border text-xs text-foreground overflow-x-auto max-h-80 overflow-y-auto">
                                                {(() => {
                                                    try {
                                                        return JSON.stringify(JSON.parse(order.rawGeminiResponse), null, 2);
                                                    } catch {
                                                        return order.rawGeminiResponse;
                                                    }
                                                })()}
                                            </pre>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* Teach Modal */}
            {teachForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl">
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
