import { parseDefuddleHtml } from "../../src/core/defuddle.js";

const repeatedText = (label, count = 30) =>
  Array.from({ length: count }, (_, index) =>
    label + " section " + (index + 1) +
    " describes reliable retrieval, source evidence, bounded processing, and content provenance.",
  ).join(" ");

const FIXTURES = [
  {
    id: "article-multilingual",
    url: "https://docs.example.org/workerd/article",
    html: [
      "<!doctype html><html><head><title>Workerd article fixture</title>",
      '<meta name="description" content="A local Workers runtime parser fixture."></head>',
      "<body><nav>Home | About | Contact</nav><main><article>",
      "<h1>Workerd article fixture</h1><p>",
      "This is the primary article paragraph. ", repeatedText("Article"), "</p>",
      "<p>هذا نص عربي للتأكد من الحفاظ على المحتوى متعدد اللغات.</p>",
      "<p>Fetch through ExportFlow and parse locally.</p>",
      "<table><thead><tr><th>Layer</th><th>Role</th></tr></thead><tbody>",
      "<tr><td>Fetcher</td><td>Network and redirects</td></tr>",
      "<tr><td>Parser</td><td>Content cleanup</td></tr></tbody></table>",
      '<p><a href="javascript:alert(1)" onclick="alert(2)">Unsafe link</a></p>',
      "<script>throw new Error('page scripts must not execute');</script>",
      '<template><img src="x" onerror="alert(3)"></template>',
      "</article></main><footer>Footer navigation should be removed.</footer></body></html>",
    ].join(""),
  },
  {
    id: "technical-documentation",
    url: "https://docs.example.org/workerd/api-reference",
    html: [
      "<!doctype html><html><head><title>API Reference</title></head><body>",
      "<aside>Documentation navigation should not become the article.</aside>",
      "<main><article><h1>API Reference</h1>",
      "<p>", repeatedText("API"), "</p>",
      "<h2>Fetch a public resource</h2>",
      "<pre><code>const response = await fetch(url, { method: 'GET' });</code></pre>",
      "<p>Use a bounded timeout and preserve the final source URL.</p>",
      "<table><thead><tr><th>Option</th><th>Meaning</th></tr></thead><tbody>",
      "<tr><td>timeoutMs</td><td>Maximum request duration</td></tr>",
      "<tr><td>maxBytes</td><td>Maximum body size</td></tr></tbody></table>",
      "</article></main><footer>Related links and footer content.</footer></body></html>",
    ].join(""),
  },
  {
    id: "product-detail",
    url: "https://shop.example.org/products/research-notebook",
    html: [
      "<!doctype html><html><head><title>Research Notebook</title>",
      '<meta name="description" content="A durable notebook for research notes.">',
      '<script type="application/ld+json">',
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        name: "Research Notebook",
        description: "A structured notebook for research and field notes.",
        sku: "NOTE-042",
        offers: { "@type": "Offer", price: "12.50", priceCurrency: "USD" },
      }),
      "</script></head><body><main><article>",
      "<h1>Research Notebook</h1>",
      "<p>", repeatedText("Product"), "</p>",
      "<h2>Specifications</h2><ul>",
      "<li>Hard cover with stitched binding</li>",
      "<li>Acid-free paper</li>",
      "<li>Numbered pages with index section</li></ul>",
      "</article></main><footer>Cart, account and footer navigation.</footer></body></html>",
    ].join(""),
  },
];

export default {
  async fetch(request) {
    if (request.method !== "GET" || new URL(request.url).pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    const results = [];
    for (const fixture of FIXTURES) {
      const start = performance.now();
      const parsed = await parseDefuddleHtml(fixture.html, fixture.url);
      results.push({
        id: fixture.id,
        title: parsed.title,
        markdown: parsed.markdown,
        wordCount: parsed.wordCount,
        parseTimeMs: parsed.parseTimeMs,
        workerElapsedMs: Math.round((performance.now() - start) * 100) / 100,
      });
    }

    return Response.json({
      parserVersion: "0.19.6",
      fixtures: results,
    });
  },
};
