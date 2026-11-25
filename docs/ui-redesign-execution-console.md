# ExportFlow UI redesign — execution-first visual hierarchy

**Status:** Draft implementation on an isolated feature branch. No merge or Production deployment.

## Design intent

The interface should feel like an execution product, not a generic AI SaaS template. The redesign keeps ExportFlow's established cobalt, ink, and paper palette and the existing Plus Jakarta Sans / mono typography. The stronger visual cue is the execution surface itself: the architecture stage on the public homepage and the task workspace after sign-in.

## Existing visual system retained

| Token | Value | Role |
| --- | --- | --- |
| Signal blue | #2458C6 | Primary actions, focus, selected navigation |
| Ink navy | #172338 | Execution workspace identity band and architecture surface |
| Canvas | #FBFCFE | Main page background |
| Body text | #43536A | Supporting copy |
| Primary font | Plus Jakarta Sans | Navigation, headings, forms, body |
| Code font | SF Mono / JetBrains Mono stack | API and task output |

Dark-mode theme tokens remain owned by the existing stylesheet; the redesign does not replace the theme system.

## Layout decisions

### Homepage

- At desktop widths (1024px and above), the hero becomes a two-column composition: product promise and primary actions on the left, execution architecture on the right.
- Below that breakpoint, the hero returns to a single-column flow to preserve readable text and a usable diagram on tablets and phones.
- Capability cards receive clearer separation and consistent surfaces without gradients, stock illustrations, or fake product statistics.

### Workspace

- The signed-in identity row becomes a dark navy anchor, separating account identity from task execution controls.
- Usage/limit summaries gain clearer typographic hierarchy and a restrained cobalt top rule.
- Task entry, API-key management, output/provenance, and history remain in the existing markup and retain their original DOM hooks and JavaScript behavior.

### Account

- Account settings keep their existing section navigation, profile fields, connected-account controls, 2FA enrollment, session management, and password flows.
- Navigation state, card structure, and form focus states receive a more consistent hierarchy.
- The existing large-screen sidebar and mobile horizontal navigation patterns are preserved.

## Accessibility and responsive behavior

- Uses logical CSS properties so selected-state accents work in LTR and RTL.
- Preserves visible focus indicators and existing semantic labels, button names, and data-* behavior hooks.
- Keeps touch controls at least 44px high where the account/workspace components already establish that interaction contract.
- Adds responsive spacing for widths down to 320px and disables non-essential transitions under prefers-reduced-motion: reduce.
- No new JavaScript package, framework, or animation dependency is introduced.

## Scope boundaries

This is a visual-only pass. It does not alter authentication, OAuth, task execution, API contracts, tenant authorization, billing, data storage, or production configuration. The stylesheet cache key is incremented so browsers request the revised CSS.

## Verification plan

- Automated marketing-site test covers the new homepage layout breakpoint, redesigned workspace/account selectors, stylesheet cache key, and reduced-motion rules.
- Existing CI runs unit tests, syntax checks, full-site Chromium QA for all declared routes/locales, and desktop/mobile viewport overflow and accessibility checks.
- This branch has no Cloudflare Pages Preview deployment because no Pages project is linked to the ExportFlow repository. The PR CI is the review validation surface; Production stays unchanged until a separate approval.

**Pending:** exact-head GitHub Actions results and human design review.