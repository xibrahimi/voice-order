import { fetchCompanies, fetchProducts } from "./sanity";
import { startRecording, stopRecording, isRecording, fileToAudioData } from "./audio";
import { matchProducts } from "./gemini";
import type { Product, AudioData, GeminiResult, MatchedItem } from "./types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./style.css";

let products: Product[] = [];
let currentAudio: AudioData | null = null;
let lastResult: GeminiResult | null = null;
let selectedCompanyName = "";

// ── DOM refs ──
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const companySelect = $<HTMLSelectElement>("company-select");
const productCount = $<HTMLSpanElement>("product-count");
const recordBtn = $<HTMLButtonElement>("record-btn");
const recordStatus = $<HTMLSpanElement>("record-status");
const fileInput = $<HTMLInputElement>("file-input");
const audioPreview = $<HTMLAudioElement>("audio-preview");
const audioInfo = $<HTMLDivElement>("audio-info");
const processBtn = $<HTMLButtonElement>("process-btn");
const resultsSection = $<HTMLDivElement>("results");
const loadingEl = $<HTMLDivElement>("loading");

// ── Init ──
async function init() {
    try {
        const companies = await fetchCompanies();
        companySelect.innerHTML = '<option value="">Select a company...</option>';
        for (const c of companies) {
            const opt = document.createElement("option");
            opt.value = c._id;
            opt.textContent = c.name;
            companySelect.appendChild(opt);
        }
    } catch (err) {
        companySelect.innerHTML = '<option value="">Failed to load companies</option>';
        console.error(err);
    }
}

// ── Company selection ──
companySelect.addEventListener("change", async () => {
    const id = companySelect.value;
    selectedCompanyName = companySelect.options[companySelect.selectedIndex]?.text || "";
    if (!id) {
        products = [];
        productCount.textContent = "";
        return;
    }
    productCount.textContent = "Loading...";
    try {
        products = await fetchProducts(id);
        productCount.textContent = `${products.length} products loaded`;
    } catch (err) {
        productCount.textContent = "Failed to load products";
        console.error(err);
    }
});

// ── Recording ──
recordBtn.addEventListener("click", async () => {
    if (isRecording()) {
        recordBtn.classList.remove("recording");
        recordBtn.textContent = "🎙️ Record";
        recordStatus.textContent = "Processing...";
        try {
            currentAudio = await stopRecording();
            showAudioPreview(currentAudio);
            recordStatus.textContent = "Recording saved";
        } catch (err) {
            recordStatus.textContent = "Recording failed";
            console.error(err);
        }
    } else {
        try {
            await startRecording();
            recordBtn.classList.add("recording");
            recordBtn.textContent = "⏹️ Stop";
            recordStatus.textContent = "Recording...";
            currentAudio = null;
            resultsSection.innerHTML = "";
        } catch (err) {
            recordStatus.textContent = "Mic access denied";
            console.error(err);
        }
    }
});

// ── File upload ──
fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
        currentAudio = await fileToAudioData(file);
        showAudioPreview(currentAudio);
        resultsSection.innerHTML = "";
    } catch (err) {
        console.error(err);
    }
});

// ── Process ──
processBtn.addEventListener("click", async () => {
    if (!currentAudio) return alert("Record or upload audio first");
    if (products.length === 0) return alert("Select a company first");

    processBtn.disabled = true;
    loadingEl.style.display = "flex";
    resultsSection.innerHTML = "";

    try {
        lastResult = await matchProducts(currentAudio, products);
        renderResults(lastResult);
    } catch (err: any) {
        resultsSection.innerHTML = `<div class="error">Error: ${err.message}</div>`;
        console.error(err);
    } finally {
        processBtn.disabled = false;
        loadingEl.style.display = "none";
    }
});

// ── Audio preview ──
function showAudioPreview(audio: AudioData) {
    const bytes = atob(audio.base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    audioPreview.src = URL.createObjectURL(new Blob([arr], { type: audio.mimeType }));
    audioPreview.style.display = "block";
    audioInfo.textContent = `${audio.fileName} (${audio.mimeType})`;
    audioInfo.style.display = "block";
    processBtn.disabled = false;
}

// ── Render results ──
function renderResults(result: GeminiResult) {
    let html = "";

    if (result.items.length > 0) {
        let grandTotal = 0;
        html += `<div class="results-header">
            <h3>Matched Products (${result.items.length})</h3>
            <button id="download-pdf" class="btn btn-pdf">📄 Download PDF</button>
        </div>`;
        html += `<div class="table-wrap"><table>
            <thead><tr>
                <th>#</th><th>Product</th><th>Size</th><th>Qty</th><th>Unit</th>
                <th>Unit Price</th><th>Line Total</th><th>Confidence</th><th>Notes</th>
            </tr></thead><tbody>`;

        for (let i = 0; i < result.items.length; i++) {
            const item = result.items[i];
            const lineTotal = item.price * item.quantity;
            grandTotal += lineTotal;
            html += `<tr>
                <td>${i + 1}</td>
                <td class="product-name">${item.name}</td>
                <td>${item.size}</td>
                <td>${item.quantity}</td>
                <td>${item.unit}</td>
                <td>₨ ${item.price.toLocaleString()}</td>
                <td>₨ ${lineTotal.toLocaleString()}</td>
                <td><span class="badge badge-${item.confidence}">${item.confidence}</span></td>
                <td>${item.notes || "—"}</td>
            </tr>`;
        }

        html += `</tbody><tfoot><tr>
            <td colspan="6" class="total-label">Grand Total</td>
            <td class="total-value">₨ ${grandTotal.toLocaleString()}</td>
            <td colspan="2"></td>
        </tr></tfoot></table></div>`;
    }

    if (result.unmatched.length > 0) {
        html += `<h3>Unmatched Items (${result.unmatched.length})</h3>`;
        html += `<div class="unmatched-list">`;
        for (const u of result.unmatched) {
            html += `<div class="unmatched-item"><strong>"${u.heard}"</strong> — ${u.reason}</div>`;
        }
        html += `</div>`;
    }

    resultsSection.innerHTML = html;

    // Attach PDF handler after DOM is ready
    document.getElementById("download-pdf")?.addEventListener("click", () => downloadPDF(result.items));
}

// ── PDF generation (clean: no notes, no confidence) ──
function downloadPDF(items: MatchedItem[]) {
    const doc = new jsPDF({ orientation: "landscape" });
    const date = new Date().toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });

    // Header
    doc.setFontSize(16);
    doc.text("Voice Order", 14, 18);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`${selectedCompanyName} — ${date}`, 14, 25);
    doc.setTextColor(0);

    // Table data — unit price × qty = line total (we calculate, not LLM)
    let grandTotal = 0;
    const rows = items.map((item, i) => {
        const lineTotal = item.price * item.quantity;
        grandTotal += lineTotal;
        return [
            i + 1,
            item.name,
            item.size,
            item.quantity,
            item.unit,
            `Rs ${item.price.toLocaleString()}`,
            `Rs ${lineTotal.toLocaleString()}`,
        ];
    });

    autoTable(doc, {
        startY: 32,
        head: [["#", "Product", "Size", "Qty", "Unit", "Unit Price", "Line Total"]],
        body: rows,
        foot: [["", "", "", "", "", "Grand Total", `Rs ${grandTotal.toLocaleString()}`]],
        styles: { fontSize: 9, cellPadding: 3 },
        headStyles: { fillColor: [108, 99, 255], textColor: 255 },
        footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: "bold" },
        columnStyles: {
            0: { cellWidth: 12, halign: "center" },
            1: { cellWidth: "auto" },
            5: { halign: "right" },
            6: { halign: "right" },
        },
    });

    doc.save(`order-${selectedCompanyName.toLowerCase()}-${Date.now()}.pdf`);
}

// Go
init();
