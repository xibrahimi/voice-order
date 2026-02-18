export interface Company {
    name: string;
    _id: string;
}

export interface Product {
    name: string;
    size: string;
    price: number;
}

export interface MatchedItem {
    name: string;
    size: string;
    price: number;
    quantity: number;
    unit: string;
    confidence: "high" | "medium" | "low";
    notes: string;
}

export interface GeminiResult {
    transcript?: string;
    items: MatchedItem[];
    unmatched: { heard: string; reason: string }[];
}

export interface AudioData {
    base64: string;
    mimeType: string;
    fileName: string;
}
