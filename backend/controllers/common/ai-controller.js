/**
 * AI + Voice Recommendation Controller
 * Shopify_Y2S2 Final – Optimized Version
 */
const Product = require("../../models/Product");

/* -------------------- Initialize OpenAI -------------------- */
let openaiClient = null;
try {
  const OpenAI = require("openai");
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log("[AI] ✅ OpenAI initialized");
  } else {
    console.log("[AI] ⚠️ No OpenAI key – running in local (rule-based) mode");
  }
} catch (err) {
  console.warn("[AI] ⚠️ OpenAI not loaded:", err.message);
}

/* -------------------- Configuration -------------------- */
const GPT = process.env.AI_RECOMMENDATIONS_MODEL || "gpt-4o-mini";

/** Light synonyms for fallback local parsing */
const SYNONYMS = {
  sneaker: ["sneaker", "sneakers", "trainer", "trainers"],
  shoes: ["shoe", "shoes", "formal", "loafers"],
  tshirt: ["t shirt", "t-shirt", "tee", "tees", "tshirts"],
  hoodie: ["hoodie", "hoodies", "hooded"],
  dress: ["dress", "dresses", "gown", "frock"],
  jeans: ["jeans", "denim", "denims", "denim jeans"],
  denim: ["denim", "denims", "jeans"],
  jacket: ["jacket", "jackets", "coat", "outerwear"],
  watch: ["watch", "watches", "wristwatch"],
  bag: ["bag", "bags", "handbag", "tote", "backpack"],
  saree: ["saree", "sari"],
  // audience
  men: ["men", "male", "man", "mens", "gents"],
  women: ["women", "woman", "female", "ladies"],
  kids: ["kids", "kid", "child", "children", "boys", "girls"],
  // colors
  red: ["red", "maroon", "crimson", "scarlet"],
  blue: ["blue", "navy", "azure", "sky"],
  black: ["black"],
  white: ["white"],
  green: ["green", "olive", "mint"],
  pink: ["pink", "rose", "blush"],
  purple: ["purple", "violet", "lavender"],
  grey: ["grey", "gray", "charcoal", "ash"],
  brown: ["brown", "tan", "beige", "khaki"],
};

const CANON = {};
for (const k of Object.keys(SYNONYMS))
  for (const t of SYNONYMS[k]) CANON[normalize(t)] = k;

/* -------------------- Utility Helpers -------------------- */
function normalize(str = "") {
  return String(str)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractNumbers(s) {
  return [...String(s).matchAll(/\b(\d{2,6})\b/g)].map((m) => Number(m[1]));
}

function extractPriceRange(message) {
  const m = normalize(message);
  const nums = extractNumbers(m).sort((a, b) => a - b);
  const kMatches = [...m.matchAll(/(\d+)\s*k\b/g)].map((x) => Number(x[1]) * 1000);
  const all = [...nums, ...kMatches].sort((a, b) => a - b);

  let minPrice = 0,
    maxPrice = 9999999;
  if (/under|below|less than/.test(m) && all.length) maxPrice = all.at(-1);
  else if (/between|from/.test(m) && all.length >= 2) [minPrice, maxPrice] = [all[0], all.at(-1)];
  else if (/above|over|more than/.test(m) && all.length) minPrice = all[0];
  return { minPrice, maxPrice };
}

/** Local fallback parser using synonyms */
function extractCanonTerms(message) {
  const m = normalize(message);
  const words = m.split(/\s+/);
  const cats = new Set();
  const colors = new Set();
  const audiences = new Set();
  const leftover = [];

  for (const w of words) {
    const key = CANON[w];
    if (!key) {
      leftover.push(w);
      continue;
    }
    if (["men", "women", "kids"].includes(key)) audiences.add(key);
    else if (
      ["red", "blue", "black", "white", "green", "pink", "purple", "grey", "brown"].includes(key)
    )
      colors.add(key);
    else cats.add(key);
  }

  const keywords = leftover.filter((w) => !/^\d+$/.test(w)).join(" ").trim();

  return {
    categories: [...cats],
    colors: [...colors],
    audiences: [...audiences],
    q: keywords,
  };
}

/** Regex builder for keyword search */
function buildRegexFromWords(q) {
  if (!q) return null;
  const words = q.split(/\s+/).filter(Boolean);
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(pattern, "i");
}

/** Simple heuristic score */
function scoreItem(p, filters) {
  let s = 0;
  const title = normalize(p.title || p.name || "");
  const desc = normalize(p.description || "");
  const q = normalize(filters.q || "");

  if (q) {
    const words = new Set(q.split(/\s+/));
    for (const w of words) {
      if (title.includes(w)) s += 2;
      if (desc.includes(w)) s += 1;
    }
  }

  if (filters.colors?.length)
    for (const c of filters.colors)
      if (`${title} ${desc}`.includes(c)) s += 1.5;

  if (filters.categories?.length) {
    const cat = normalize(p.category || p.categories?.[0] || p.type || "");
    for (const c of filters.categories) if (cat.includes(c)) s += 2;
  }

  const price =
    (typeof p.salePrice === "number" ? p.salePrice : undefined) ?? p.price ?? 0;
  if (price && filters.minPrice >= 0 && filters.maxPrice)
    if (price >= filters.minPrice && price <= filters.maxPrice) s += 2;

  if (typeof p.rating === "number") s += Math.min(3, p.rating / 2);
  if (p.createdAt) {
    const days = (Date.now() - new Date(p.createdAt).getTime()) / 86400000;
    if (days < 7) s += 1;
    else if (days < 30) s += 0.5;
  }

  return s;
}

/* -------------------- AI-assisted helpers -------------------- */
async function extractFiltersLLM(message) {
  const sys = `Extract an e-commerce query into JSON:
{"q":"","minPrice":0,"maxPrice":9999999,"colors":[],"categories":[],"audiences":[]}`;
  const resp = await openaiClient.chat.completions.create({
    model: GPT,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: message },
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(resp.choices[0].message.content || "{}");
}

/* -------------------- Main Controller -------------------- */
async function aiRecommend(req, res) {
  try {
    const { message, limit = 6 } = req.body || {};
    if (!message)
      return res.status(400).json({ success: false, message: "message is required" });

    // Step 1: Extract filters (AI → fallback)
    let filters = { q: "", minPrice: 0, maxPrice: 9999999, colors: [], categories: [], audiences: [] };

    if (openaiClient) {
      try {
        const f = await extractFiltersLLM(message);
        filters = {
          q: (f.q || "").trim(),
          minPrice: f.minPrice || 0,
          maxPrice: f.maxPrice || 9999999,
          colors: (f.colors || []).map(normalize),
          categories: (f.categories || []).map(normalize),
          audiences: (f.audiences || []).map(normalize),
        };
      } catch (err) {
        console.warn("[AI] LLM parsing failed → fallback:", err.message);
        const { minPrice, maxPrice } = extractPriceRange(message);
        filters = { ...filters, ...extractCanonTerms(message), minPrice, maxPrice };
      }
    } else {
      const { minPrice, maxPrice } = extractPriceRange(message);
      filters = { ...filters, ...extractCanonTerms(message), minPrice, maxPrice };
    }

    // Step 2: Build Mongo filters
    const q = { isDeleted: { $ne: true } };
    const and = [];

    const rx = buildRegexFromWords(filters.q);
    if (rx)
      q.$or = [
        { title: { $regex: rx, $options: "i" } },
        { name: { $regex: rx, $options: "i" } },
        { description: { $regex: rx, $options: "i" } },
      ];

    if (filters.categories?.length) {
      const allTerms = filters.categories.flatMap((cat) => SYNONYMS[cat] || [cat]);
      const catRx = new RegExp(allTerms.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");
      and.push({ $or: [{ category: catRx }, { description: catRx }, { title: catRx }] });
    }
    if (filters.colors?.length) and.push({ color: { $in: filters.colors } });
    if (filters.audiences?.length)
      and.push({
        $or: filters.audiences.map((aud) => ({
          $or: [
            { gender: aud },
            { audience: aud },
            { tags: aud },
            { title: new RegExp(aud, "i") },
            { description: new RegExp(aud, "i") },
          ],
        })),
      });
    if (and.length) q.$and = and;

    // Step 3: Query products
    let products = await Product.find(q)
      .select("title name description price salePrice category color gender tags rating createdAt images image")
      .limit(120)
      .lean();

    // Filter by price range
    products = products.filter((p) => {
      const price = p.salePrice ?? p.price ?? 0;
      return price >= filters.minPrice && price <= filters.maxPrice;
    });

    // Step 4: Score & sort
    const scored = products.map((p) => ({ ...p, _score: scoreItem(p, filters) }));
    scored.sort((a, b) => b._score - a._score);

    // Step 5: Slice final
    const finalItems = scored.slice(0, Math.min(Number(limit) || 6, 12));

    // Step 6: Optional AI summary
    let summary = "";
    if (openaiClient && finalItems.length) {
      try {
        const explain = await openaiClient.chat.completions.create({
          model: GPT,
          messages: [
            { role: "system", content: "Explain in 1 short sentence why these products match the query." },
            { role: "user", content: `Query: ${message}\nProducts: ${finalItems.map(i => i.title).join(", ")}` },
          ],
        });
        summary = explain.choices?.[0]?.message?.content?.trim() || "";
      } catch (err) {
        console.warn("[AI] summary failed:", err.message);
      }
    }

    return res.json({ success: true, filters, items: finalItems, summary });
  } catch (err) {
    console.error("[AI] recommend error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
}

module.exports = { aiRecommend };