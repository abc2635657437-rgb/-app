# Travel World design context

## Product feel

Travel World is a warm, editorial travel companion: calm paper tones, deep teal ink, and a restrained cinnabar accent. Keep the interface welcoming and useful, with a little local character rather than generic SaaS panels or over-produced AI copy.

## Visual system

- Paper backgrounds: warm ivory (`#fbf7ee`) with the existing location-specific Gathered artwork kept visible behind content.
- Ink: deep teal (`#183947`); muted copy stays readable, not faint.
- Accent: restrained cinnabar (`#b64d39`) for primary actions and selected states.
- Display titles may use the existing Chinese serif voice; controls and dense metadata use the system sans-serif stack.
- Real, licensed photographs belong to the place and carry source/credit links. Never invent ratings, prices, room availability, or user popularity.

## Responsive behavior

- Treat a 390px-wide portrait phone as the primary layout target; support 320px without horizontal scrolling.
- Maintain clear touch targets (at least 44px), safe-area padding, and sticky actions only when they do not cover content.
- Use compact, photo-led sections with short copy. Keep navigation actions explicit and never label a map route as a ride booking.
- Third-party booking and ticket inventory must be described as live only after the visitor reaches the provider's current results; otherwise label it as an outbound search.

## West Lake sample

Use the approved vertical Gathered West Lake artwork as the full-page backdrop, with the title over it and documentary photos in the six practical sections: eat, drink, see, do, stay, and go. The phone view is the source of truth; desktop may widen the same information, not introduce a separate information hierarchy.

All 1,000 destination guides reuse the exact West Lake six-category SVG renderer (`TravelGuideIcon`) and the shared `.wl-category-icon` styling in `photo-places.css`; do not substitute dots, letters, emoji, or a second icon family. Each category needs two in-site photos with credits; regional imagery must not be represented as a specific business interior.

## Travel desk

The in-app AI assistant is a travel desk, not a chatbot: it is labelled 同路人 · 旅途顾问 / Travel Desk, opens by asking for the few facts that change an answer, and replies across the same 衣 · 食 · 住 · 行 · 玩 axes the product is built on.

- The desk is drawn as its own sheet of paper (`modules/ai/ai-chat.css`), one hairline rule at a time. The page intro is a compact 22px heading and steps aside once a conversation starts, so the composer stays above the bottom navigation on a 390 × 844 phone.
- Answers are an editorial column, not a bubble: left hairline, serif headings with a cinnabar tick, numbered steps, hairline tables, pull quotes and footnote-style sources. Only the traveller's own questions are bubbles.
- The six-subject index is a 3 × 2 grid rather than a horizontal scroller, so nothing is clipped at 320px. The disclosure line carries the anonymous quota; the sign-in invitation is a quiet link in the composer.
- Colour comes from `--ai-*` tokens so the desk works in both the day and the night journal theme; the floating entry hides while the desk is open.
- Voice: warm, calm, precise, a little literary. No emoji, no exclamation marks, no hype words; prices, hours and safety are always framed as things to verify locally.

### Voice and saved plans

- Speech stays in the browser (`modules/ai/ai-voice.js`, Web Speech API): no audio leaves the device and no speech key is needed. Missing recognition or synthesis hides the control instead of showing a dead button.
- One tap on the microphone listens; the interim transcript fills the composer and the final phrase goes through the same `send()` path as typing, so streaming, sources, quota and the route hand-off behave identically.
- Read-aloud queues the answer sentence by sentence with markdown and table rows stripped, because those are noise when spoken. A voice question is always answered out loud; the masthead switch makes typed answers read aloud too, and tapping either control stops playback.
- Each question also carries the traveller's own saved plans — their routes (`routes.days` holds the day-by-day places plus 衣 · 食 · 住 · 行 · 玩 notes) and their open trip posts — capped at roughly 12 KB on the client and sanitised again on the server, so "my trip" questions are grounded in real data instead of invention.

### Day plans with photographs

- A question that asks for an itinerary sends `mode: "plan"`, and the desk asks for one `## 日程` table (`天 | 时间 | 地点 | 类型 | 说明`) instead of prose: a table survives small models far better than JSON.
- The server parses that table into days, resolves one licensed photograph per place through Wikidata P18 → Wikimedia Commons (author and licence kept, cached for an hour), and returns the structure beside the text. An unresolved place keeps its 衣 / 食 / 住 / 行 / 玩 glyph rather than being illustrated with a stock photo.
- The client draws it as a page, not a table: a 152px cover photograph and a serif title open the plan, then a category index (全部 / 吃 / 喝 / 玩 / 乐 / 住 with live counts) narrows it in one tap, and each day is one horizontal strip of 132 × 172 photo cards — time, place, and a line of advice over the image. No pipe tables ever appear in the transcript, and a day costs about 210px of scrolling instead of a screenful.
- Categories come from the model's type column and collapse onto 吃 / 喝 / 玩 / 乐 / 住; the prompt asks for at least one 吃 and one 喝 a day and for street-level places (markets, noodle shops, old lanes, cafes). Photographs are resolved for every stop: Wikidata P18 first, then a Commons image search for whatever is left.
- Every card carries two real actions: the category action (订座 → 大众点评 in China, Tabelog in Japan, OpenTable elsewhere; 门票 → Klook across Asia, GetYourGuide elsewhere; 住宿 → a Booking.com city search) and a ride link (滴滴 inside China; Uber everywhere else, with Grab as the second option in South-East Asia). Links are provider searches or documented deep links prefilled with the place — never a made-up merchant page. The region comes from a small city gazetteer over the traveller's question, with a global fallback.
- Notes are written for a friend ("清晨人少，景色更好"), with no durations or prices; the prompt forbids greetings and exclamation marks. Photographs that fail to load fall back to the stop's 衣/食/住/行/玩 glyph instead of a broken image, and the cover deliberately opens on a place other than the first stop.
- Plan mode uses a compact prompt plus one retry, because the free upstream can spend its whole token budget reasoning and return nothing. When that happens the desk says the itinerary failed instead of inventing one.
- The card's route action carries the itinerary into Route Studio: each stop becomes an editable row in 衣 · 食 · 住 · 行 · 玩 (mapped from its type) plus an entry in 行程顺序, so publishing starts from real content instead of a paragraph of tips.

## Publishing navigation

Keep exactly five primary destinations: Home, Explore, Chat, Travel companions, and My. Route publishing belongs inside the existing top-right Publish flow. Do not add a separate Route tab or route buttons above the home feed. Keep the public traveler-route list at the bottom of Explore.
