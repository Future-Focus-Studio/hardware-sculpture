const FIRECRAWL_API_KEY =
  process.env.FIRECRAWL_API_KEY || "fc-46ccce0a60d74d499236c8019d155312";

const FIRECRAWL_URL = "https://api.firecrawl.dev/v1/scrape";

const priceCache = new Map<string, number | null>();

export async function fetchRealPrice(
  partNumber: string,
): Promise<number | null> {
  if (priceCache.has(partNumber)) {
    return priceCache.get(partNumber) ?? null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: `https://www.mcmaster.com/${partNumber}`,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      priceCache.set(partNumber, null);
      return null;
    }

    const body = (await res.json()) as {
      data?: { markdown?: string };
      markdown?: string;
    };
    const markdown = body?.data?.markdown ?? body?.markdown ?? "";
    const match = markdown.match(/\$(\d+\.\d{2})\s+each/i);
    const price = match ? parseFloat(match[1]) : null;
    priceCache.set(partNumber, price);
    return price;
  } catch {
    priceCache.set(partNumber, null);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
