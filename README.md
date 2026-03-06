# Stackline Full Stack Assignment – Submission

## Overview

This is a sample eCommerce app (product list, search/filter, product detail). I reviewed the application, identified the issues below, and implemented fixes. Each section describes what was wrong, how I fixed it, and why I chose that approach.

---

## Bugs Identified & Fixes

### 1. Subcategories not filtered by category

**What was wrong:** When you picked a category, the subcategories dropdown was populated by calling `/api/subcategories` with no query. The API supports a `category` param and returns subcategories for that category, but the frontend never sent it. So you’d see all subcategories instead of only the ones for the selected category.

**Fix:** In `app/page.tsx`, the subcategories `useEffect` now builds a URL with the selected category and passes it to the API:

```ts
const params = new URLSearchParams({ category: selectedCategory });
fetch(`/api/subcategories?${params}`)
```

**Why:** The API was already correct; the bug was only on the client. Adding the query param was the minimal change and makes the filter behavior match what users expect.

---

### 2. Product links broken (wrong `href` and bad URL pattern)

**What was wrong:** Product cards used a Next.js App Router `Link` with `href={{ pathname: "/product", query: { product: JSON.stringify(product) } }}`. In the App Router, `Link` expects a string `href`; the `query` object style is from the Pages Router and doesn’t produce a proper URL. So clicking a product didn’t go to the right place. Even if it did, putting the whole product as JSON in the query string is fragile (length limits, encoding, refresh, bookmarks).

**Fix:**  
- List page: product links now use the SKU:
  ```tsx
  href={`/product/${product.stacklineSku}`}
  ```
- New dynamic route: `app/product/[sku]/page.tsx` loads the product by calling `GET /api/products/[sku]` and renders the detail view.  
- `app/product/page.tsx` (no SKU) now redirects to `/` so `/product` alone doesn’t show an empty or broken state.

**Why:** Using the SKU in the URL is the right fit here: stable, shareable, and works with the existing product-by-SKU API. The detail page always fetches fresh data, so no huge JSON in the URL and no risk of stale or missing fields (e.g. `featureBullets`, `retailerSku`).

---

### 3. Product detail page could crash on missing fields

**What was wrong:** The detail page assumed `product.imageUrls`, `product.featureBullets`, and `product.retailerSku` were always present. If any were missing or not arrays, `.length` or iteration could throw.

**Fix:** In `app/product/[sku]/page.tsx` I use safe defaults and optional rendering:

- `const imageUrls = product.imageUrls ?? [];` and `const featureBullets = product.featureBullets ?? [];`
- Thumbnails and feature list only render when the arrays have items.
- Retailer SKU is rendered only when `product.retailerSku` is present.

**Why:** Defensive checks keep the page from crashing on malformed or partial API data and make future schema changes safer.

---

### 4. Products API `limit` and `offset` could be invalid

**What was wrong:** `limit` and `offset` were taken from the query and passed to `parseInt()` with no validation. Invalid values (e.g. `limit=abc`) become `NaN`, so `filtered.slice(offset, offset + limit)` could behave oddly or return wrong results.

**Fix:** In `app/api/products/route.ts`:

- Parse `limit` and `offset` and fall back to defaults when parsing fails: e.g. `parseInt(limitParam, 10) || 20` and `parseInt(offsetParam, 10) || 0`.
- Clamp `limit` to a reasonable range (e.g. 1–100) and ensure `offset` is non‑negative before passing to `slice`.

**Why:** Validating and clamping avoids NaN and keeps the API predictable for the UI and for any direct API consumers.

---

### 5. Products fetch on home page had no error handling

**What was wrong:** The products list `fetch` had no `.catch()`. If the request failed (network error, 5xx, etc.), `setLoading(false)` never ran, so the UI could stay on “Loading products…” forever.

**Fix:** Added a `.catch()` that sets products to an empty array and sets loading to false so the user at least sees “No products found” and can try again.

**Why:** Failing fast and showing a clear state is better than an infinite loading spinner; we already had a “No products found” state, so reusing it was straightforward.

---

### 6. List page assumed `product.imageUrls` and `data.products` always exist

**What was wrong:** The list used `product.imageUrls[0]` and `data.products` without checking. Missing or malformed data could cause runtime errors.

**Fix:** Use optional chaining for the first image (`product.imageUrls?.[0]`) and when setting state use `setProducts(data.products ?? [])` so we always set an array.

**Why:** Small defensive checks so the list page doesn’t break if the API returns an error payload or a product with no images.

---

### 7. Stale subcategory when changing category

**What was wrong:** When you changed the category dropdown, the subcategory selection was not cleared. So you could end up with e.g. Category = “Electronics” and Subcategory still “E-Readers” (from the previous “Tablets” choice). The products request would then use both filters and often return no results, and the subcategory dropdown could show a value that wasn’t in the new list.

**Fix:** In the `useEffect` that runs when `selectedCategory` changes, we now clear the subcategory first with `setSelectedSubCategory(undefined)` whenever the category changes, then fetch the new subcategories. So switching category always resets subcategory to “All Subcategories”.

**Why:** Keeps category and subcategory in sync and avoids confusing empty results or invalid dropdown state.

---

### 8. Categories and subcategories fetches had no error handling

**What was wrong:** If `/api/categories` or `/api/subcategories` failed (network or 5xx), there was no `.catch()` and no fallback. Categories could stay empty and the user would see no feedback; the app could look broken.

**Fix:** Both fetches now check `res.ok` and use `.catch()`. On failure we set the relevant state to an empty array (`setCategories([])` or `setSubCategories([])`). Response bodies are read safely with `data?.categories ?? []` and `data?.subCategories ?? []`.

**Why:** Matches the products fetch fix: the app doesn’t hang or show misleading state when an API call fails.

---

### 9. Default template metadata in layout

**What was wrong:** `app/layout.tsx` still had `title: "Create Next App"` and the default description, so the browser tab and meta tags looked like an unmodified template.

**Fix:** Updated metadata to `title: "StackShop"` and `description: "Sample eCommerce product catalog with search and filters"`.

**Why:** Presents the app as a real product and improves tab/SEO clarity.

---

### 10. Select components and empty value

**What was wrong:** Category and subcategory Selects used `value={selectedCategory}` and `value={selectedSubCategory}` with `undefined` when nothing was selected. Radix Select expects a string value; using `undefined` can cause warnings or odd behavior.

**Fix:** Use `value={selectedCategory ?? ""}` and `value={selectedSubCategory ?? ""}` so the empty state is always a string.

**Why:** Aligns with Radix’s API and avoids subtle UI or console issues.

---

### 11. Next.js security vulnerabilities (CVE-2025-66478 and related)

**What was wrong:** The project used Next.js 15.5.4, which was affected by critical/high vulnerabilities in the React Server Components (RSC) protocol—including remote code execution (RCE), denial of service (DoS), and source code exposure. `npm install` and `npm audit` reported these issues.

**Fix:** Upgraded Next.js (and `eslint-config-next`) from 15.5.4 to 15.5.12, the patched version for the 15.5.x line. No code changes required; dependency bump only.

**Why:** Small fix (version bump), large impact: addresses RCE and DoS risks. Build and `npm audit` now report 0 vulnerabilities.

---

## Summary of file changes

| File | Change |
|------|--------|
| `app/page.tsx` | Subcategories fetch includes `category`; clear subcategory when category changes; product links use `/product/[sku]`; products, categories, and subcategories fetches have error handling and safe fallbacks; optional chaining for first image; Select values use `""` when empty. |
| `app/layout.tsx` | Metadata updated to StackShop title and description. |
| `app/product/page.tsx` | Replaced with a redirect to `/` when visiting `/product` with no SKU. |
| `app/product/[sku]/page.tsx` | **New.** Product detail by SKU: fetches from API, loading and “not found” states, safe handling of `imageUrls`, `featureBullets`, and `retailerSku`. |
| `app/api/products/route.ts` | `limit`/`offset` parsed with fallbacks and clamped to valid ranges. |
| `package.json` | Next.js and eslint-config-next upgraded 15.5.4 → 15.5.12 (security patches). |

---

## How to run

```bash
npm install
npm run dev
```

Or with yarn: `yarn install` then `yarn dev`.

---

## How to verify the fixes

1. **Subcategories filtered by category** – Select a category (e.g. Tablets). The subcategory dropdown should show only subcategories for that category.
2. **Stale subcategory** – Select a category and subcategory, then change the category. The subcategory should reset to "All Subcategories".
3. **Product links** – Click a product card. You should land on `/product/[sku]` with full details. "Back to Products" returns to the list.
4. **Metadata** – The browser tab title should show "StackShop".
5. **Refresh** – Refreshing a product page should still load correctly.

---

## Notes

- I did not change the existing API response shapes or add new endpoints; all fixes are either client-only or validation in the existing products route.
- The product detail page now always loads from the API by SKU, so it stays in sync with the backend and avoids the previous JSON-in-URL approach.
- I focused on correctness and robustness (filters, links, error handling, validation) rather than adding new features, to stay within the recommended time and scope.
