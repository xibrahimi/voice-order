import type { Company, Product } from "./types";

const PROXY_URL = "https://sanity-wrapper-proxy-5157a326ce35.herokuapp.com/api/query";
const API_KEY = "e18885d3832b6dd9f1b9bc35fedf994e0f3ccb91f8ef96ad9c23b74e532b3ab5";

// In-memory cache — avoids re-fetching on repeated selections
const cache = new Map<string, unknown[]>();

async function query<T>(groq: string, cacheKey?: string): Promise<T[]> {
    if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey) as T[];

    const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ query: groq, params: {} }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Sanity query failed");

    const data = json.data as T[];
    if (cacheKey) cache.set(cacheKey, data);
    return data;
}

export async function fetchCompanies(): Promise<Company[]> {
    return query<Company>('*[_type == "company"]{name, _id} | order(name asc)', "companies");
}

export async function fetchProducts(companyId: string): Promise<Product[]> {
    return query<Product>(
        `*[_type == "product" && company._ref == "${companyId}"]{name, size, price} | order(name asc)`,
        `products:${companyId}`
    );
}
