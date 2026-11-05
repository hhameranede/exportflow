# ExportFlow - GitHub Copilot instructions

## Product
ExportFlow is a consumer parcel-tracking website. A shopper pastes a tracking number from an online store (such as AliExpress, Temu, SHEIN, or Amazon) and should eventually be able to follow the parcel across carriers. It is NOT a B2B freight-forwarding or export-management platform.

## Current implementation
- Static, dependency-free HTML/CSS/JavaScript frontend.
- English and Arabic are supported; preserve correct RTL behavior.
- The only working tracking result is explicitly a demo. Do not imply arbitrary tracking numbers are queried live.
- Build output is generated into dist/ by npm run build.

## Engineering rules
1. Keep the product fast, mobile-first, accessible, and usable without an account.
2. Keep the core journey short: enter a tracking number, identify the carrier, show latest status, and display a chronological event timeline.
3. Preserve semantic HTML, keyboard support, visible focus states, sensible labels, and responsive layouts down to 320px.
4. Keep English and Arabic copy in sync. When Arabic is selected, set lang=ar and dir=rtl; do not reverse Latin tracking codes.
5. Never add carrier API credentials to browser code. Real lookups must run behind a server-side API.
6. Treat tracking numbers and shipment data as private. Avoid logging full tracking numbers.
7. Do not add fake carrier coverage counts, fake live statuses, or unverified delivery guarantees.
8. Prefer small, dependency-free changes. Add dependencies only when they solve a real requirement.
9. Run node --check app.js, npm test, and npm run build after meaningful changes.

## Next milestone
Integrate the selected parcel connector engine behind a server-side endpoint, verify its license and carrier detection, then replace the demo UI response only after live responses are proven.