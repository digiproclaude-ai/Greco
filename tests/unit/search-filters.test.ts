import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ cacheLife: () => {}, cacheTag: () => {} }));

const { listingFilterQuery, parseListingFilters, parseProviderFilters, toQuery } = await import("@/server/modules/marketplace/search");

describe("search filters", () => {
  it("ignore invalid values instead of failing", () => {
    const filters = parseListingFilters({
      q: "  voice agent ",
      category: "not-a-uuid",
      delivery: "9999",
      type: "robot",
      sort: "cheapest",
      page: "-3",
    });
    expect(filters).toMatchObject({ q: "voice agent", category: null, delivery: null, type: null, sort: "relevance", page: 1 });
  });

  it("convert budgets with the chosen currency", () => {
    const filters = parseListingFilters({ currency: "EUR", min: "100", max: "2500.50" });
    expect(filters).toMatchObject({ currency: "EUR", minMinor: 10000, maxMinor: 250050 });
    expect(parseListingFilters({ min: "1e9" }).minMinor).toBeNull();
  });

  it("default to newest without a query", () => {
    expect(parseListingFilters({}).sort).toBe("newest");
    expect(parseProviderFilters({ q: "rag" }).sort).toBe("relevance");
  });

  it("build compact query strings for links", () => {
    expect(toQuery({ q: "rag", page: 1, empty: "", none: null })).toBe("?q=rag");
    const filters = parseListingFilters({ q: "chatbot", sort: "price_asc", page: "2" });
    expect(listingFilterQuery(filters, 3)).toBe("?q=chatbot&sort=price_asc&page=3");
  });
});
