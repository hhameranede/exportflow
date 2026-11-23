---
name: ui-ux-pro-max
description: "Apply structured UI/UX guidance to ExportFlow pages, components, design systems, accessibility, typography, responsive behavior, and interaction quality."
---

# UI/UX Pro Max — ExportFlow Reference Bundle

Based on [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill), licensed under MIT. Selected web and UX checklists are included in `references/`.

## Workflow

1. Identify the surface mode: Persuade (marketing), Operate (workspace/product UI), or Read (documentation).
2. Inspect the existing component, product truth, design tokens, and rendered experience before choosing a pattern.
3. Prioritize accessibility, interaction feedback, mobile layout, readable content, typography, and semantic color before decorative styling.
4. Use `references/quick-reference.md` for UX checks and `references/pro-rules.md` for the professional UI checklist.
5. Keep the interface specific to agent execution infrastructure. Do not paste generic AI/SaaS templates onto the product.
6. Verify at small phone, standard phone, tablet, and desktop widths when browser tooling is available; include keyboard, touch, RTL, and reduced-motion checks.

## ExportFlow constraints

- Direct page headings; no repeated eyebrow/kicker labels or generic all-caps micro-headings.
- Communicate status with text as well as color.
- Do not remove real workflow order, technical identifiers, or runtime states just because they are compact labels.
- Keep the user's task first; progressively reveal advanced policy, quota, and evidence details.
- Preserve the current visual identity and tokens unless an approved redesign calls for a new system.

## Tooling boundary

This is a focused reference bundle. The upstream searchable catalog and Python runtime are not mirrored here; use the included checklists directly instead of attempting upstream search commands.
