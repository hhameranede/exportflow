import { parseDefuddleHtml } from "../../src/core/defuddle.js";

const ARTICLE_TEXT = Array.from(
  { length: 45 },
  (_, index) =>
    "This paragraph " + (index + 1) +
    " explains bounded web retrieval, source provenance, and safe content conversion.",
).join(" ");

const FIXTURE_HTML = [
  "<!doctype html><html><head><title>Workerd Defuddle fixture</title>",
  '<meta name="description" content="A local Workers runtime parser fixture."></head>',
  "<body><nav>Home | About | Contact</nav><main><article>",
  "<h1>Workerd Defuddle fixture</h1><p>",
  "This is the primary article paragraph. ", ARTICLE_TEXT, "</p>",
  "<p>هذا نص عربي للتأكد من الحفاظ على المحتوى متعدد اللغات.</p>",
  "<p>Fetch through ExportFlow and parse locally.</p>",
  "<table><thead><tr><th>Layer</th><th>Role</th></tr></thead><tbody>",
  "<tr><td>Fetcher</td><td>Network and redirects</td></tr>",
  "<tr><td>Parser</td><td>Content cleanup</td></tr></tbody></table>",
  '<p><a href="javascript:alert(1)" onclick="alert(2)">Unsafe link</a></p>',
  "<script>throw new Error('page scripts must not execute');</script>",
  '<template><img src="x" onerror="alert(3)"></template>',
  "</article></main><footer>Footer navigation should be removed.</footer></body></html>",
].join("");

export default {
  async fetch(request) {
    if (request.method !== "GET" || new URL(request.url).pathname !== "/") {
      return new Response("Not found", { status: 404 });
    }

    const parsed = await parseDefuddleHtml(
      FIXTURE_HTML,
      "https://docs.example.org/workerd/fixture",
    );

    return Response.json({
      markdown: parsed.markdown,
      title: parsed.title,
      wordCount: parsed.wordCount,
      parserVersion: "0.19.6",
    });
  },
};
