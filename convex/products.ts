"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

const PROXY_URL = process.env.SANITY_PROXY_URL!;
const API_KEY = process.env.SANITY_PROXY_API_KEY!;

async function sanityQuery(groq: string, params: Record<string, string> = {}) {
    const res = await fetch(PROXY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
        body: JSON.stringify({ query: groq, params }),
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || "Sanity query failed");
    return json.data;
}

export const listCompanies = action({
    args: {},
    returns: v.array(v.object({ name: v.string(), _id: v.string() })),
    handler: async () => {
        return await sanityQuery(
            '*[_type == "company"]{name, _id} | order(name asc)',
        );
    },
});

export const listProducts = action({
    args: { companyId: v.string() },
    returns: v.array(
        v.object({ name: v.string(), size: v.string(), price: v.number() }),
    ),
    handler: async (_ctx, args) => {
        return await sanityQuery(
            `*[_type == "product" && company._ref == "${args.companyId}"]{name, size, price} | order(name asc)`,
        );
    },
});
