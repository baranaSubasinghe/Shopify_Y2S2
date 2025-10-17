// backend/controllers/common/ai-controller.js
const Product = require("../../models/Product");

let openaiClient = null;
try {
  const OpenAI = require("openai");
  if (process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (_) {}

/* -------------------------- Config -------------------------- */
const GPT = process.env.AI_RECOMMENDATIONS_MODEL || "gpt-4o-mini";

/** Light synonyms so “sneakers” ~ “shoes”, “tee” ~ “t-shirt”, etc. */
const SYNONYMS = {
  // categories
  sneaker: ["sneaker", "sneakers", "trainer", "trainers"],
  shoes: ["shoe", "shoes", "formal", "loafers"],
  tshirt: ["t shirt", "t-shirt", "tee", "tees"],
  hoodie: ["hoodie", "hoodies", "hooded"],
  dress: ["dress", "gown", "frock"],
  jeans: ["jeans", "denim", "denims", "denim jeans"],
  denim: ["denim", "denims", "jeans"], // all lowercase
  jacket: ["jacket", "coat", "outerwear"],
  watch: ["watch", "wristwatch"],
  bag: ["bag", "handbag", "tote", "backpack"],
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

/* Build reverse map: term -> canonical (normalized) */
const CANON = {};
for (const k of Object.keys(SYNONYMS)) {
  for (const t of SYNONYMS[k]) CANON[normalize(t)] = k;
}

/* -------------------------- Helpers -------------------------- */
function normalize(str = "") {
  return String(str || "")
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

  let minPrice = 0, maxPrice = 9999999;
  if (/under|below|less than/.test(m) && all.length) {
    maxPrice = all[all.length - 1];
  } else if (/between|from/.test(m) && all.length >= 2) {
    minPrice = all[0];
    maxPrice = all[all.length - 1];
  } else if (/above|over|more than/.test(m) && all.length) {
    minPrice = all[0];
  }
  return { minPrice, maxPrice };
}

function extractCanonTerms(message) {
  const m = normalize(message);
  const words = m.split(/\s+/);
  const cats = new Set();
  const colors = new Set();
  const audiences = new Set();
  const leftover = [];

  for (const w of words) {
    const key = CANON[w];
    if (!key) { leftover.push(w); continue; }
    if (["men", "women", "kids"].includes(key)) audiences.add(key);
    else if (SYNONYMS[key] && ["red","blue","black","white","green","pink","purple","grey","brown"].includes(key)) colors.add(key);
    else cats.add(key);
  }

  const keywords = leftover.filter((w) => !/^\d+$/.test(w)).join(" ").trim();

  return {
    categories: [...cats],
    colors: [...colors],
    audiences: [...audiences],
    keywords,
  };
}

function buildRegexFromWords(q) {
  if (!q) return null;
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const pattern = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return new RegExp(pattern, "i");
}

function scoreItem(p, filters) {
  // composite score: text match + price fit + rating + recency
  let s = 0;

  const title = normalize(p.title || p.name || "");
  const desc  = normalize(p.description || "");
  const q = normalize(filters.q || "");

  if (q) {
    const words = new Set(q.split(/\s+/));
    for (const w of words) {
      if (title.includes(w)) s += 2;
      if (desc.includes(w))  s += 1;
    }
  }

  // color/category boosts
  if (filters.colors?.length) {
    const text = `${title} ${desc}`;
    for (const c of filters.colors) if (text.includes(c)) s += 1.5;
  }
  if (filters.categories?.length) {
    const cat = normalize(p.category || p.categories?.[0] || p.type || "");
    for (const c of filters.categories) if (cat.includes(c)) s += 2;
  }

  // price proximity
  const price = (typeof p.salePrice === "number" ? p.salePrice : undefined) ?? p.price ?? 0;
  if (price && filters.minPrice >= 0 && filters.maxPrice) {
    if (price >= filters.minPrice && price <= filters.maxPrice) {
      const mid = (filters.minPrice + filters.maxPrice) / 2;
      const delta = Math.max(1, Math.abs(price - mid));
      s += 4 / Math.log10(delta + 10);
    }
  }

  if (typeof p.rating === "number") s += Math.min(3, p.rating / 2);

  if (p.createdAt) {
    const days = (Date.now() - new Date(p.createdAt).getTime()) / 86400000;
    if (days < 7) s += 1;
    else if (days < 30) s += 0.5;
  }

  return s;
}

/* ------------------------- LLM helpers ------------------------- */
async function extractFiltersLLM(message) {
  const sys = `Extract an e-commerce query into filters. Return strict JSON:
{
  "q": "string keywords",
  "minPrice": number,
  "maxPrice": number,
  "colors": ["color"],
  "categories": ["category"],
  "audiences": ["men"|"women"|"kids"]
}`;
  const resp = await openaiClient.chat.completions.create({
    model: GPT,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: message }
    ],
    response_format: { type: "json_object" },
  });
  return JSON.parse(resp.choices[0].message.content || "{}");
}

async function rerankLLM(message, candidates) {
  const prompt = `User query: "${message}"
You are given products as JSON objects with "title", "description", and "price".
Return the indices (0-based) of the best 6 products in descending order of relevance as a JSON array, property "order".
Do not add commentary.`;

  const content = JSON.stringify(candidates.map(c => ({
    title: c.title || c.name,
    description: c.description || "",
    price: c.salePrice ?? c.price,
    category: c.category || c.categories?.[0] || c.type || "",
  })));

  const resp = await openaiClient.chat.completions.create({
    model: GPT,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: content }
    ],
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(resp.choices[0].message.content || "{}");
  const order = Array.isArray(parsed.order) ? parsed.order : [];
  return order.filter((i) => Number.isInteger(i) && i >= 0 && i < candidates.length);
}

/* --------------------------- Controller --------------------------- */
/**
 * POST /api/ai/recommend  { message, limit? }
 */
async function aiRecommend(req, res) {
  try {
    const { message, limit = 6 } = req.body || {};
    if (!message) return res.status(400).json({ success:false, message:"message is required" });

    // 1) Parse filters
    let filters = { q:"", minPrice:0, maxPrice:9999999, colors:[], categories:[], audiences:[] };

    if (openaiClient) {
      try {
        const f = await extractFiltersLLM(message);
        filters.q = (f.q || "").trim();
        filters.minPrice = Number.isFinite(f.minPrice) ? f.minPrice : 0;
        filters.maxPrice = Number.isFinite(f.maxPrice) ? f.maxPrice : 9999999;
        filters.colors = Array.isArray(f.colors) ? f.colors.map(normalize) : [];
        filters.categories = Array.isArray(f.categories) ? f.categories.map(normalize) : [];
        filters.audiences = Array.isArray(f.audiences) ? f.audiences.map(normalize) : [];
      } catch (e) {
        const { minPrice, maxPrice } = extractPriceRange(message);
        const locals = extractCanonTerms(message);
        filters = { ...filters, ...locals, minPrice, maxPrice };
      }
    } else {
      const { minPrice, maxPrice } = extractPriceRange(message);
      const locals = extractCanonTerms(message);
      filters = { ...filters, ...locals, minPrice, maxPrice };
    }

    // 2) Build precise Mongo filters
    const q = { isDeleted: { $ne: true } };

    // Keyword regex across title/name/description
    const rx = buildRegexFromWords(filters.q);
    if (rx) {
      q.$or = [
        { title: { $regex: rx, $options: "i" } },
        { name: { $regex: rx, $options: "i" } },
        { description: { $regex: rx, $options: "i" } },
      ];
    }

    const and = [];

    // Category: match category fields OR text synonyms in title/description
    if (Array.isArray(filters.categories) && filters.categories.length) {
      const categoryOrs = [];

      categoryOrs.push({
        $or: [
          { category: { $in: filters.categories } },
          { categories: { $in: filters.categories } },
          { type: { $in: filters.categories } },
        ],
      });

      const synonymTerms = [];
      for (const cat of filters.categories) {
        const terms = (SYNONYMS?.[cat] || [cat]).map(normalize);
        synonymTerms.push(...terms);
      }
      const uniq = Array.from(new Set(synonymTerms)).filter(Boolean);
      if (uniq.length) {
        const pattern =
          "\\b(" + uniq.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")\\b";
        const catRx = new RegExp(pattern, "i");
        categoryOrs.push({ title: { $regex: catRx } }, { description: { $regex: catRx } });
      }

      and.push({ $or: categoryOrs });
    }

    // Color exact match
    if (Array.isArray(filters.colors) && filters.colors.length) {
      and.push({ color: { $in: filters.colors } });
    }

    // Gender / audience strict match
    if (Array.isArray(filters.audiences) && filters.audiences.length) {
      const genderClauses = filters.audiences.map((aud) => {
        const b = new RegExp(`\\b${aud}\\b`, "i");
        return {
          $or: [
            { gender: aud },
            { audience: aud },
            { tags: aud },
            { title: b },
            { description: b },
          ],
        };
      });
      and.push({ $or: genderClauses });
    }

    if (and.length) q.$and = and;

    // 3) Pull a generous candidate set
    let raw = await Product.find(q)
      .select("title name description images image price salePrice category categories type color gender tags rating createdAt")
      .sort({ rating: -1, createdAt: -1 })
      .limit(120)
      .lean();

    // Deduplicate by _id/title
    const seen = new Set();
    raw = raw.filter((p) => {
      const key = p._id?.toString() || p.title?.toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 4) Strict price filter
    const priceFiltered = raw.filter((p) => {
      const price =
        typeof p.salePrice === "number" && p.salePrice > 0
          ? p.salePrice
          : typeof p.price === "number"
          ? p.price
          : null;

      if (price == null) return false;
      if (filters.minPrice && price < filters.minPrice) return false;
      if (filters.maxPrice && price > filters.maxPrice) return false;
      return true;
    });

    // 5) Local scoring
    const withScore = priceFiltered.map((p) => ({ ...p, _score: scoreItem(p, filters) }));

    // Gender penalty (outside of scoreItem; safe scope)
    if (Array.isArray(filters.audiences) && filters.audiences.length) {
      for (const item of withScore) {
        const text = `${item.title || ""} ${item.description || ""}`.toLowerCase();
        const isMen = /men|gents|male/.test(text);
        const isWomen = /women|ladies|female/.test(text);
        if (filters.audiences.includes("men") && isWomen) item._score -= 3;
        if (filters.audiences.includes("women") && isMen) item._score -= 3;
      }
    }

    withScore.sort((a, b) => b._score - a._score);

    // 6) Optional LLM re-rank
    let finalItems = withScore;
    if (openaiClient && withScore.length > 6) {
      const top = withScore.slice(0, 24);
      try {
        const order = await rerankLLM(message, top);
        const ordered = order.map((i) => top[i]).filter(Boolean);
        finalItems = [...ordered, ...top.filter((x) => !ordered.includes(x))];
      } catch (_) {
        finalItems = withScore;
      }
    }

    finalItems = finalItems.slice(0, Math.min(Number(limit) || 6, 12));

    // 7) Tiny explanation
    let summary = "";
    if (openaiClient) {
      try {
        const explain = await openaiClient.chat.completions.create({
          model: GPT,
          messages: [
            { role: "system", content: "Explain in 1 sentence why these items match. Be concise." },
            { role: "user", content: `Query: ${message}\nItems: ${finalItems.map(i=>`${i.title || i.name} - ${(i.salePrice ?? i.price)}`).join(", ")}` }
          ]
        });
        summary = explain.choices[0].message.content?.trim() || "";
      } catch(_) {}
    }

    return res.json({ success:true, filters, items: finalItems, summary });
  } catch (err) {
    console.error("[ai] recommend error:", err);
    return res.status(500).json({ success:false, message:"Server error" });
  }
}

module.exports = { aiRecommend };