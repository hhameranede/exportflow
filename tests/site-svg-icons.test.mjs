import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderBrandCatSvg, renderFeatureIcon } from "../src/site/icons.js";

const iconsFile = new URL("../src/site/icons.js", import.meta.url);
const pagesFile = new URL("../src/site/marketing-pages.js", import.meta.url);
const marketingFile = new URL("../src/site/marketing.js", import.meta.url);
const [iconsSource, pagesSource, marketingSource] = await Promise.all([
  readFile(iconsFile, "utf8"),
  readFile(pagesFile, "utf8"),
  readFile(marketingFile, "utf8")
]);
const dictionary = iconsSource.match(/const FEATURE_SVGS = \{([\s\S]*?)\n\};/);
assert.ok(dictionary, "FEATURE_SVGS icon registry must exist");
const iconNames = [...dictionary[1].matchAll(/^\s*"([^"]+)"\s*:/gm)].map((match) => match[1]);

test("the feature icon registry has unique, explicit identifiers", () => {
  assert.ok(iconNames.length >= 20, "Expected the full bespoke icon set");
  assert.equal(new Set(iconNames).size, iconNames.length, "Icon identifiers must be unique");
});

test("every registered feature icon renders one complete accessible inline SVG", () => {
  for (const name of iconNames) {
    const html = renderFeatureIcon(name);
    const svgMatches = html.match(/<svg\b[\s\S]*?<\/svg>/g) || [];
    assert.equal(svgMatches.length, 1, name + " should render exactly one SVG");
    assert.match(html, /aria-hidden="true"/, name + " should be decorative to assistive technology");
    assert.match(svgMatches[0], /\bwidth="\d+"/, name + " should declare width");
    assert.match(svgMatches[0], /\bheight="\d+"/, name + " should declare height");
    assert.match(svgMatches[0], /\bviewBox="[^"]+"/, name + " should declare a viewBox");
    assert.match(svgMatches[0], /<(?:path|circle|rect|line|polyline|polygon|ellipse)\b/, name + " should contain vector geometry");
    assert.doesNotMatch(html, /(?:undefined|NaN|null)/, name + " should not interpolate invalid values");
  }
});

test("brand cat mark is a valid, dimensioned decorative SVG", () => {
  const html = renderBrandCatSvg("qa-brand-cat", 32);
  assert.match(html, /<svg\b/);
  assert.match(html, /class="qa-brand-cat"/);
  assert.match(html, /width="32"/);
  assert.match(html, /height="32"/);
  assert.match(html, /viewBox="0 0 64 64"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /<path\b/);
});

test("every statically mapped use-case icon exists in the registry", () => {
  const mapped = [...pagesSource.matchAll(/:\s*"(uc-[a-z-]+)"/g)].map((match) => match[1]);
  assert.ok(mapped.length >= 5, "Use-case icon map should contain the five visible workflows");
  for (const name of mapped) assert.ok(iconNames.includes(name), "Missing SVG registry entry for " + name);
});

test("unknown feature identifiers fall back to the canonical web-intelligence icon", () => {
  assert.equal(renderFeatureIcon("qa-unknown-icon"), renderFeatureIcon("web-intelligence"));
  assert.match(marketingSource, /renderFeatureIcon/);
});
