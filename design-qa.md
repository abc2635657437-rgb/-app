# Route photo-first iteration — local preview

final result: blocked

Scope: photo-first route preview only, not acceptance of the five-page application or production release.

Source visual truth: C:/Users/Administrator/.codex/generated_images/01a0aeef-ea89-7321-8dd8-af719ce8f366/exec-431034f9-3bb2-4f40-a56d-ca0799cb0a6b.png (1487×1058).
Implementation screenshot: D:/同路人/artifacts/camino-photo-preview.png (699×664 displayed capture; browser reports 714×676 CSS viewport). Existing in-app panel sizing was retained; viewport override did not yield the requested desktop size and was reset.

Source and implementation were opened together in the same comparison input. This is a responsive redesign under subsequent explicit user amendments, not a pixel-faithful clone. A fully normalized same-size source/implementation comparison remains unavailable; therefore no final design acceptance is claimed.

## Verified current iteration

Full-page background follow-up: a fresh 971×1619 Gathered asset derived from the same cathedral reference replaces the wide banner. The viewport-fixed decorative layer remains in place while the route content scrolls; photo cards remain documentary originals. Route records now carry background provenance. Current top/detail screenshots: artifacts/camino-fullpage-top.png and artifacts/camino-fullpage-scroll.png. CSS fixed positioning and no horizontal overflow checked in the browser. This scoped change does not remove the full-application acceptance blockers below.

Directory expansion: 150 distinct Hong Kong official trail entries imported with source links, explicitly marked directory-only / details-not-verified / background-not-created. This is not 150 finished guides or global-route coverage. No third-party photos were copied by the importer.

- Typography: serif navy headings retained; long repeated descriptions moved behind disclosure controls. Small labels need a larger-device and accessibility follow-up.
- Layout: seven photo stops in one row at the current panel width; food, actual beds, four clickable waypoint photographs and the existing interactive map are visible together. No horizontal overflow in the inspected Chinese or English state.
- Colors: ivory paper, navy text and restrained vermilion accents retained. Artistic cathedral background remains at the edge, with opaque fact backgrounds preventing text overlap.
- Imagery: all fourteen inspected card images loaded. The rural stone-wall hero was removed. The hostel image was visually checked against its official gallery and replaced with bunk beds. Artistic background is explicitly distinguished from documentary photos. Historical photos are not advertised as current conditions or user-submitted journeys. The Ferreiros photo depicts nearby Mirallos church; the village pin is not claimed as its camera location.
- Content: English route headings/buttons/disclosures checked with no Han characters found. This is not proof of full-site translation. Prices remain published references, not live availability.

## Interaction checks

Seven town photo buttons were clicked individually: each showed the corresponding name/photo and selected state and focused the existing map. All four waypoint photo buttons were clicked and showed their corresponding detail title. Hostel photo click opened its native details disclosure. Static photo-source and file checks and hiking difficulty checks passed.

## Comparison history

Earlier issues: text-only town cards; irrelevant rural wall hero; hostel reception instead of beds; text-only waypoint entries; header artwork conflicting with statistics; overly tall photo rows.
Fixes: licensed place cards, church waypoint photographs, actual official bunk-bed photograph, edge-only artistic background with protected stats, condensed labels and one-row town overview.
Post-fix evidence: artifacts/camino-photo-preview.png.

## Remaining acceptance blockers

- Normalize the visual comparison for the intended desktop and mobile sizes and check font legibility there.
- Verify all five app pages and full English flows separately; this iteration does not establish their completion.
- Confirm business-photo reuse terms before any public release. No deployment authorized for this iteration.

The screenshot is shared as work in progress for the user's requested early review, not a completed build handoff.

---

# West Lake selected detail edition — local review

final result: ready for user review

Scope: only the user-selected West Lake detail design, implemented as the selected-edition detail opened from Explore. Other landmark detail templates and production deployment were not changed.

Visual source: C:/Users/Administrator/.codex/generated_images/01a0aeef-ea89-7321-8dd8-af719ce8f366/exec-d610810d-f83f-46b3-a1af-3e76de0bdac5.png. Implementation reviewed in the in-app browser at `http://localhost:8795/?preview=journal&landmark=cn-west-lake&v=westlake-selected-v5`, portrait viewport 390px wide. The browser screenshot was inspected live; no screenshot file was saved.

Structure: paper-and-watercolor West Lake title, illustrated lake guide with four real map-search pins, six compact category shortcuts, photo-first horizontal recommendation sections, stay filters, transit choices, and a sticky save/add-to-itinerary bar. The illustrative map is disclosed as visual guidance; pins open live Amap search.

Interaction checks: category shortcuts scroll to the matching section; hotel filters update the Booking.com search URL and the “more stays” link together; navigation, ride, and ticket controls point to Amap, DiDi, and Trip.com; save toggles and restores; add-to-itinerary opens the app's login flow when required. The four map pins are individually named and actionable. Geolocation was not requested during QA, so no location permission was prompted.

Responsive/media: tested at 390px, document and dialog scroll widths remain 375px, all inspected images loaded, and the six sections remain in the intended order. JavaScript syntax checks passed; map web integration and provider contract tests passed (2 suites).

Release: local preview only. No commit, push, or deployment was made.

---

# Gathered background and journal-theme release

final result: passed

Scope: existing journal five-page shell, existing map behavior, seven completed landmark backgrounds; not acceptance of the unfinished 100-background library, regional AI, all authenticated interactions or global travel guides.

Visual target: user-selected five-panel image, codex-clipboard-d8f9ae07-f4dd-4b01-ac93-c33349f35608.png. The responsive implementation retains the cream/navy/vermillion palette, Meili cover, serif headings, five-tab navigation and quiet Great Wall profile/buddy backdrop. Real posts and logged-out states replace illustrative people/counts from the reference. No fake popularity or sample chat was published.

Verification: in-app browser, local release server on port8790. All five navigation destinations opened. English Home/Explore and native language selector checked. Read-only real community content loaded. Directory country filters and map/photo detail appeared. Seven individual PNG files, dimensions, photo sources, attribution and map aliases passed scripts/check-gathered-release.mjs. Catalog bounds, photos input validation and clustering checks passed.

Mobile: 390x844 five-page checks; document width never exceeded viewport and visible non-map images stayed within bounds. 320x740 Eiffel detail: dialog clientWidth250 equals scrollWidth250, with correct unique background. No mobile horizontal overflow. Layout screenshots remain in the original working checkout's artifacts folder, not committed with public users' content.

Known limits: no native iOS/Android-device test; user-authored Chinese posts are not machine-translated; not every authenticated dialog has been re-tested. Business-photo food cards remain local-review-only and are excluded on the production hostname. Remaining backgrounds and budget algorithms are not released.

## 2026-10-16 — publishing entry placement

final result: passed

Scope: route-entry placement only. The West Lake reference-image redesign remains a separate pending iteration.

User direction: remove the standalone Route tab and the two route buttons at the top of Home; retain route publishing inside the top-right Publish flow, and traveler routes at the bottom of Explore.

Implementation: removed Route Studio's navigation/home injection. The existing publisher action now opens “发布我的路线”; returning from this editor goes back to the publisher, and a saved route can be attached there. The existing Explore traveler-route list remains in place.

Browser evidence: local server port 8794, portrait 390×844. Runtime DOM inspection showed five primary navigation buttons, no `#studioEntry` home bar, the publisher button text “发布我的路线”, and the Explore “旅行者路线 · 真实发布” section. Logged-out publishing remains behind the existing sign-in flow; no live route was created. JavaScript syntax and diff checks passed. This is a local preview, not a production deployment.

---

# West Lake selected-image interaction overlay — local review

final result: ready for user review

Scope: only West Lake detail. The selected reference is displayed as one unchanged image; the old rebuilt West Lake detail component and its artwork were removed. Other landmark renderers were left untouched. No deployment was made.

Visual source: `C:/Users/Administrator/.codex/generated_images/01a0aeef-ea89-7321-8dd8-af719ce8f366/exec-d610810d-f83f-46b3-a1af-3e76de0bdac5.png` (798×1971). The app asset `assets/route-photos/west-lake-selected-reference.png` is byte-identical (SHA-256 `E0BEDD3CCD51CD553A14435F36086947F29C5F2409F942E4261AB9C37E52046E`). Reviewed in the in-app browser at `http://localhost:8795/?preview=journal&landmark=cn-west-lake&v=westlake-image-v1`, portrait viewport 390×844. The image keeps its natural aspect ratio; interactive targets are transparent overlays.

Interaction checks: category areas lead to relevant map or booking searches; map/transit controls link to Amap, ride control to DiDi, ticket actions to Trip.com, and hotel actions to Booking.com with the chosen property and filters in the search. The star filter was opened and set to 4+; the filter control is visually transparent but keyboard and accessibility-tree discoverable. Favorite and add-to-itinerary controls use the app's existing behavior. Provider sign-in, live inventory, and booking completion remain on those external services; geolocation permission is not requested.

Verification: JavaScript syntax checks passed for the changed map entry, loader, map web module and service worker. Map integration and provider contract tests passed (2 suites). Browser preview rendered the exact selected artwork and its interaction labels. Local preview only; no commit, push, or production deployment.

---

# West Lake six-category interactive guide — mobile review

final result: local preview ready for user review

This section supersedes the selected-image-overlay implementation above. The full reference is not used as a page or click-overlay: the guide is rendered from independent semantic sections and cards; selected artwork is limited to the hero/map visual areas. Scope is only the West Lake detail entry. No unrelated page was changed for this guide, and nothing was deployed.

The page contains six vertically ordered categories (eat, drink, sights, leisure, stay, transport), four map pins that open in-app sight details, category shortcuts, independently clickable recommendation cards, horizontally scrollable recommendation rails with arrows/mouse drag/touch scrolling, stay filters and Booking search, separate Amap transit routes and DiDi handoff, and a fixed bottom favorite/itinerary bar. Mobile browser review confirmed the bar remains at the viewport bottom while scrolling and category shortcuts reach lower sections. A mouse drag moved the eat rail to its end; after disabling text selection on rails, a refreshed mobile preview showed no drag-selection artifact.

Validation: JavaScript syntax and `git diff --check` passed. Three automated suites passed: map places, map provider contract, and map web integration. In-app mobile preview shows all six categories and the fixed footer. External booking, ticket inventory, live business ratings/prices, and DiDi account/ride completion remain with their providers; sample/reference photos and missing live data are labeled rather than represented as live facts. Preview URL: `http://localhost:8795/?preview=journal&landmark=cn-west-lake&v=westlake-guide-review-2`.
