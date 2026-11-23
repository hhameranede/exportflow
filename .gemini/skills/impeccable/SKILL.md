---
name: impeccable
description: "Review, critique, simplify, audit, and polish ExportFlow web interfaces. Apply product-specific visual judgment, accessibility, responsive behavior, UX copy, and final UI verification."
---

# Impeccable — ExportFlow UI/UX Practice

Adapted from [pbakaus/impeccable](https://github.com/pbakaus/impeccable), licensed under Apache-2.0. Selected upstream references are included beside this skill.

## Workflow

1. Read the ExportFlow Command Center and Agent Operating Guide in Notion before project-level changes.
2. Inspect the rendered route and source before editing. Classify each issue as hierarchy, interaction, information architecture, copy, accessibility, responsive behavior, or product-state truth.
3. Preserve the working ExportFlow identity and routes. Fix the cause at the narrowest shared component or token.
4. Use `reference/critique-rubric.md` for heuristic and cognitive-load assessment, `reference/audit.md` for measurable implementation checks, `reference/craft-floor.md` before UI edits, and `reference/polish.md` for final review.
5. Verify the rendered page on desktop and mobile, test keyboard navigation and reduced motion, and run repository tests and build checks.
6. Separate verified evidence from assumptions. Never claim a browser/device test or a Production deployment unless it actually ran.

## ExportFlow design constraints

- The product is agent execution infrastructure, not a generic AI chatbot or parcel-tracking website.
- Use direct, meaningful page titles; avoid repeated tiny uppercase labels above headings.
- Avoid generic SaaS patterns: repeated icon-in-a-tile title rows, decorative section numbers, identical cards without a content reason, gratuitous glow, and vague AI claims.
- Keep meaningful status badges, ordered workflow steps, code identifiers, and architecture labels when they convey actual product state or sequence.
- Distinguish Available, In development, Preview-only, and Planned capabilities honestly.
- Prioritize mobile reading, clear primary actions, semantic controls, visible focus, and WCAG AA contrast.
- Motion must be purposeful and respect `prefers-reduced-motion`.

## Tooling boundary

This is a focused reference bundle, not the full upstream Impeccable CLI/runtime. Do not invoke missing `impeccable` commands or claim its detector ran. Use available browser tooling and repository tests.
