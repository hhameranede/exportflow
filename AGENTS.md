# ExportFlow Frontend Engineering Standards

Apply these project standards to all future frontend design, implementation, review, and refactoring work. Preserve ExportFlow's existing architecture and working behavior; make focused changes that are responsive, accessible, production-minded, and validated.

## Required skill activation

Before frontend work, read and apply the relevant project skills from `.agents/skills/`:

- `.agents/skills/frontend-design/SKILL.md` — visual direction and frontend design.
- `.agents/skills/ui-ux-pro-max/SKILL.md` — UI/UX decisions; use its scripts, data, and references when relevant.
- `.agents/skills/vercel-react-best-practices/SKILL.md` — React/Next.js performance, rendering, and data patterns.
- `.agents/skills/vercel-composition-patterns/SKILL.md` — component API and composition architecture.
- For GSAP work, load the relevant skill(s): `gsap-core`, `gsap-timeline`, `gsap-scrolltrigger`, `gsap-plugins`, `gsap-utils`, `gsap-react`, `gsap-performance`, or `gsap-frameworks` (each under `.agents/skills/<skill-name>/SKILL.md`). Use only the parts relevant to the task; do not add GSAP where it provides no meaningful value.

The repository's canonical skills directory is `.agents/skills/`. It is the project-level Agent Skills discovery location used here. `.claude/skills/` mirrors selected entries as symlinks for Claude Code; do not create separate duplicate copies there. Skill inventories and source revisions are recorded in `skills-lock.json`.

## Design direction

Avoid generic SaaS templates, predictable purple/blue gradients, indiscriminate rounded cards, glassmorphism without purpose, repeated section patterns, oversized headings without hierarchy, generic AI illustrations, decorative icon clutter, fabricated product metrics, placeholder content, and animation that harms usability.

Create a distinctive, coherent ExportFlow visual identity with deliberate typography, spacing, contrast, and hierarchy. Use realistic product-specific content and established design tokens/components where present. Make each section and interaction intentional. Prioritize clarity, usability, accessibility, responsive behavior, and visual precision. Keep color and type systems restrained and consistent.

## Motion and animation

Use GSAP only when it meaningfully improves the experience. Favor restrained, well-sequenced timelines, selected ScrollTrigger use, and purposeful hover/state transitions. Keep motion responsive and performant (prefer transforms and opacity, avoid layout thrashing), clean up animations with the framework lifecycle, and honor `prefers-reduced-motion`. Preserve keyboard access and avoid animation that blocks or distracts from core workflows.

## Engineering and verification

Follow the existing stack and patterns; avoid unnecessary dependencies and broad rewrites. Preserve production functionality, semantic HTML, accessible names and focus behavior, and mobile layouts. Validate the changed behavior with the narrowest relevant checks and report any unverified behavior honestly. Do not invent product facts or claim tests passed unless they were run.
