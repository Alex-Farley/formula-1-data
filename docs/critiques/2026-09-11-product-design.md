# Product design critique — 2026-09-11

**Critic:** `product-design-critic` (`.claude/agents/`), second live run.
**Subject:** the whole product at v2.21, commit `c4026ca` on `main`, against the built site served at `localhost:4180`.
**Brief:** `.claude/CRITIQUE-BRIEF.md`.
**Prior:** `docs/critiques/2026-09-10-product-design.md` (my first run), the content and IA critiques of the same date, `docs/BACKLOG.md` at 8 landed items.

**Evidence.** I drove the built site in Chromium (1280×900 and 390×844), queried the committed `f1.db` and `f1-geometry.db` directly, read the front-end source and the prerendered HTML, and — unlike the first run, where GitHub returned 403 — **reached the network and looked at the alternatives**: F1DB's release API, StatsF1's driver pages, formula1.com, and the Wikipedia/Commons API for 160 sampled drivers. Where a claim is a sample rather than a census I say so. The repository was not modified.

**Findings are filed as `PD-14` onward,** continuing the first run's numbering, which reached `PD-13` plus `PD-Ø`.

**Status of the claims below.** The critic ran read-only and left the repository unmodified. Before this file was written the author re-checked its load-bearing figures against the committed `f1.db`, `f1-geometry.db`, the source and the prerendered HTML, and all held: the repository is private (`gh repo view`: `visibility: PRIVATE`, unauthenticated GET 404); 862 drivers, 618 with no `notes`, 625 with no podium, pole or fastest lap; 731 of 1,153 chassis join to a Commons image and 346 of those have `name_matches = 1`; one open row in `discrepancies`; 25 traced circuits covering 588 of 1,172 races, Silverstone (61 races) untraced; `Atlas.jsx:80` opens on `'spa'` and the circuit page's link carries no circuit; zero `og:image` and zero `<img>` in the prerendered Hamilton and MP4/4 pages. The Wikipedia lead-image sample (n=160) and the DEM characterisation were not re-checked and stand at the critic's stated evidence level.

---

## Is this on the right track?

**The execution is on the right track. The direction is not, and the four questions you are asking are the symptom.**

Eight backlog items landed in a day, including `PD-01` (1,130 pages that 404'd), `PD-04` (the disagreement component), `CD-01`, `IA-04`, `IA-15` and the `PM-05` pole split — which required a schema change, a version bump, six view rewrites and a front-end fix caught in review. I checked three of those fixes in the browser and they work. The defect-closing machinery here is faster and more disciplined than most funded teams manage. Nothing below is a criticism of that.

But look at what did **not** move. My first run's three top findings were: *the static half contradicts the app*, *the product leads with the claim it shares with everyone else*, and *nothing measures anything*. The first is `PD-02`, still open and still at the top of *Now*. The second is `PD-11`/`IA-02`, still open. The third is `PD-Ø`, still unsized, still untouched. And the next four things you want to spend on — driver photographs, the atlas, 3D circuits, "looks nicer" — are all **surface**, and three of the four are on page types that between them account for one page (`/atlas`) and 863 pages nobody can find (drivers), while the 2,333 pages that carry the sport's actual record get nothing.

Then there is this, which I did not expect to find:

    $ curl -s -o /dev/null -w "%{http_code}\n" https://github.com/Alex-Farley/formula-1-data
    404
    $ curl -s https://api.github.com/users/Alex-Farley/repos | jq length
    0

**The repository is private.** The brief says "a GitHub release carries the `.db` files, a JSON export and a Parquet bundle"; `CLAUDE.md` says `f1_database.json` "is gitignored and published as a release asset instead". No member of the public can reach any of it. `verify.py` — the ~170 checks that *are* the distinguishing claim — cannot be read by anyone who would want to check it. The site saves this: `lapledger.org/f1.db`, `/f1-geometry.db` and `/f1-parquet.zip` all return 200 and I downloaded all three. But the 21 MB JSON export exists publicly nowhere, and the source of an audited database is unauditable.

That is the trajectory in one fact. The product is being polished at the rate of a team and published at the rate of nobody. **Fix the door before you repaint the rooms.**

---

## The three that matter

### 1. The verifiability claim has no public evidence, and one of the three products is unreachable (`PD-14`)

Above. Free to fix if the private state is an oversight; a positioning decision if it is not. If the repository stays private, then "a public reference that other people depend on" is not achievable and the README, `COMMERCIAL-READINESS.md` and the licence classification are documenting a promise the distribution does not keep.

### 2. A photograph is the fourth thing a driver page is missing, and you already own 731 photographs you are hiding (`PD-15`–`PD-19`)

The median driver in this database has **7 race entries**. 171 of 862 (20%) have exactly one. **625 of 862 (73%) have zero wins, zero podiums, zero poles and zero fastest laps** — four of the eight tiles in the stat strip reading `0`. **618 of 862 (72%) have no opening sentence at all**, because `drivers.notes` is populated on 244. The championship dot plot renders on 281 (33%).

So the typical driver page is a name, four zeros, an empty chart slot and a seven-row table. A portrait above that does not fix it; it frames it.

Meanwhile **731 of 1,153 chassis pages already carry a Commons photograph** — 21% of the whole site — rendered at about 130 px in a section called "Photographs", below the specification, below the fold. And **no prerendered page on this site contains a single `<img>` tag**, nor an `og:image`, on any of 3,515 pages.

### 3. The atlas's unique half is buried under its duplicated half, and the link that promises the unique half is broken (`PD-21`, `PD-22`)

`/circuits/suzuka` says *"Open it in the atlas to walk the lap metre by metre and compare it with the other traced circuits at one scale."* I clicked it. It lands on **Spa** — `Atlas.jsx:80` is `useState('spa')` and there is no circuit in the URL. Every one of the 25 contextual links into the atlas does this.

The single-circuit hero that occupies the top 460 px is a bigger copy of the drawing already on the circuit page (`TrackMap.jsx`) and already on `/circuits`. The **wall** — 25 shapes, switchable to true scale, "Monaco really is half of Spa" — is the only thing on this site that exists nowhere else, and it is section two, below the fold, after a circuit the reader did not pick.

---

## The four questions, answered

### Q1. Driver pages: is a photograph what they are missing?

**No. It is fourth on a list of four, and the first three are cheaper.** But the licensing question you were worried about has a clean answer, so here it is first.

**The licence is not a blocker.** I sampled 40 drivers from each of four eras (n=160) against the Wikipedia `pageimages` API and checked where the file is hosted — a file served from `/wikipedia/commons/` is on Commons, which hosts only free files:

| Era (by last season) | Register | Sampled | Has a lead image | On Commons (free) |
|---|---|---|---|---|
| to 1969 | 483 | 40 | 22 | **22 (55%)** |
| 1970–89 | 202 | 40 | 27 | **27 (68%)** |
| 1990–2009 | 116 | 40 | 34 | **34 (85%)** |
| 2010–26 | 61 | 40 | 39 | **39 (98%)** |

Every lead image found was on Commons; none was a local non-free upload. Weighted to the register's era distribution that is **roughly 65%, about 560 of 862 driver pages**, ±8pp per stratum at this sample size. The pipeline already exists: `tools/wikimedia_images.py`, the `article_images` table, the `attribution()`/`canShow()` rule, `CommonsImage`. It is a harvest change, not an architecture change.

But note what the table says about *shape*: a template built around a portrait works on 98% of modern drivers and 55% of the pre-1970 ones — and the pre-1970 drivers are **483 of 862 rows, 56% of the register**, and the part of this database that has the least competition. You would be adding a hole to the half of the product that is most yours.

**What the page is actually missing, in order.**

1. **A sentence.** 618 pages open with an h1 and a grid of zeros. `CD-02` covers the 111 ledes that lead with the harvest and `CD-03` covers the 1,172 race pages with none; **nobody has filed the 618 driver pages with none**. That is `PD-16`.
2. **A stat strip that fits the driver.** `Driver.jsx:173-184` is designed for Hamilton and rendered for Bruce Halford, where Wins/Podiums/Poles/Fastest laps are four adjacent zeros on 73% of pages. That is `PD-15`.
3. **The figures StatsF1 has and you don't.** I pulled StatsF1's Bruce Halford page — the same nine-race 1950s privateer. It gives best grid position, average grid (16), average finish (9.5), retirement rate (75%), laps raced (177), km raced (2,039), teammates (2), constructors (4), models (4), birthplace and place of death. **Every one of those except birthplace is derivable from data already in `f1.db`** (`grid`, `finish_position`, `status`, `laps_completed`, `constructor_id`, `race_id`). And birthplace is in your upstream: F1DB's `Driver` entity publishes `placeOfBirth`, `abbreviation`, `permanentNumber`, `bestStartingGridPosition`, `totalRaceLaps` and `familyRelationships` under CC BY 4.0, and `harvest/f1db_drivers.txt` already reads `abbreviation` and discards it. That is `PD-17`.
4. **Then the photograph**, and only after you have made the 731 you already own earn their keep (`PD-19`).

**One competitive note that should settle the formula1.com instinct.** formula1.com has driver pages for the current grid — about 20 people. Lap Ledger has 862. A design copied from a 20-row product will break on an 862-row one, and the 842 rows where it breaks are the rows formula1.com does not have. The right reference for this page is StatsF1, not formula1.com, and StatsF1's advantage is derived figures, not pictures.

### Q2. The atlas: what is it for?

**Decision: it is a comparison surface, and only that.** You can make this call now; you do not need `PD-Ø` first, because the argument is structural rather than about demand.

The atlas has three jobs and only one is its own:

| Job | Also done by | Verdict |
|---|---|---|
| Draw one circuit's shape | `Circuit.jsx:125` (`TrackMap`), `Circuits.jsx:50` (thumbnails) | Duplicated **twice**. Retire it here. |
| Compare 25 circuits at one scale | nothing, anywhere | **This is the atlas.** |
| Walk the lap with a scrubber, coloured by corner radius | — | The most-built thing, disabled on 3 of 25, answering no question I can name. Demote. |

The evidence that this is right: `Atlas.jsx` + `lib/lap.js` + `TrackMap.jsx` is 613 lines, the second database, the runtime overlay merge in `worker.js`, and a build/verify contract on `closes`/`loose_ends`/`segment_count` — for **one page of 3,515**, which holds **a quarter of the homepage's "Popular ways in" band** (`Home.jsx:249`), **cannot be linked to a circuit**, and is **the only page type on the site with no prerendered content**: `curl /circuits/atlas` returns 6,440 bytes of chrome and the sentence *"The drawings need JavaScript."* On a 4 Mbps connection I measured **11.9 s** before React replaces the static page (11.4 s in the first run — unchanged). For those twelve seconds, and for every crawler, the most elaborate page on the site is blank.

And there is a defect underneath that nobody has filed: **the selection has no stated rule.** 25 of 80 circuits are traced, covering **588 of 1,172 races (50%)** and **14 of the 23 rounds of the 2026 season**. Silverstone — 61 races, more than any untraced venue — is absent, as are Catalunya (36), Hungaroring (41), Red Bull Ring (40), Imola (32), Marina Bay, Yas Marina, Lusail and Miami. Present: **Donington Park (1 race), Mugello (1), Portimão (2), Buddh (3), East London (3)**. A reader cannot tell whether their circuit is missing because it has not been traced yet or because it cannot be. The page says "Twenty-five of the eighty circuits have been traced so far" in the source note, which is a count, not a rule.

**Do:** `PD-21`. Make the wall the page. Give each cell an address. Fix the twenty-five broken promises from the circuit pages. State the rule — even "the modern permanent circuits OSM maps cleanly, traced in order of races held" would do, and it would make the next ten traces obvious rather than arbitrary. Cost **M**, and it is shippable in three independent pieces: the URL (S), the reordering (S), the rule and the backfill order (S).

### Q3. Interactive 3D circuits with elevation

**A distraction, and the sharpest one on the list.** Six reasons, in descending force:

1. **It would be the only figure in this database with no cross-check.** Your stated discipline is that a fact which cannot survive a cross-check does not go in, and that where two sources disagree the disagreement is recorded. There is no second redistributable source of circuit elevation profiles to check a DEM sample against, and no confidence tier you could honestly assign. You would be putting the least verifiable data in the project on its most prominent new surface. That is the product arguing against itself in public.
2. **The available elevation sources are surface models, not ground models.** SRTM (public domain, 30 m) and Copernicus GLO-30 both include buildings and trees. Sampling them along a street circuit — Monaco, Baku, Las Vegas, Long Beach, Marina Bay, Miami, 7 of your 25 — returns rooftop heights. Spa, Suzuka and Interlagos would work; Monaco would return a sawtooth, and a reader who knows Monaco would spot it instantly.
3. **The resolution does not support it.** Spa's centreline is 359 points over 6,995 m — about 19 m apart — against a 30 m DEM cell. Every sample would be interpolation between measurements, and the absolute vertical accuracy (±6–10 m) is a fifth of Spa's entire 100 m elevation change and larger than Bahrain's whole range.
4. **The stored geometry is 2D.** `circuit_geometry.centreline` is a GeoJSON `MultiLineString` with `[lon, lat]` pairs and no third ordinate. There is no elevation anywhere in this project except four hand-written sentences in `data/circuits.py` ("100 m of elevation change" at Spa, "300 m" at the Nordschleife).
5. **It breaks two standing decisions at once.** Every chart on this site is hand-drawn SVG and carries a table of its own numbers — a discipline `Figure.jsx` enforces. A WebGL canvas can carry neither, cannot be prerendered, and cannot be read by a screen reader. And three.js is roughly 150 KB gzipped against your whole current bundle of 118 KB. `CLAUDE.md`'s rejection of code splitting rests on "the bundle is irrelevant beside the database"; that argument is true at 118 KB and starts being false at 270 KB.
6. **Copernicus would need a `SOURCE_LICENCE` class,** and `build.py` refuses an unclassified source. SRTM's public-domain status is clean; the point is that this is a build change, not a fetch.

**If you want to ship the instinct anyway, here is the Lap Ledger-shaped version, and it is an S.** Add `elevation_change_m` to `circuits`, sourced from the Wikipedia article each circuit already cites, for the ~20 venues where a published source states a figure. That is a *fact with a source and a confidence tier*, it puts a number on the circuit page next to Length and Turns, it makes "the Nordschleife has 300 m of elevation change and Bahrain has 17" a comparison a reader can make, and if a drawing is ever worth making, the data is there and checkable. It is also the honest answer to why the atlas draws a circuit flat: the shape is measured and the height is not. `PD-23`.

### Q4. Where does visual investment pay for a reference source?

**It pays in inverse proportion to how far down the page it sits, and it pays most where the page is not.**

Three places it pays, all cheap:

- **The share card and the search result.** Zero of 3,515 pages carry an `og:image`; `prerender.js:1306` sets `twitter:card` to `summary` and no image. Every link to this site posted in Slack, Discord, WhatsApp, Bluesky, Mastodon or a Wikipedia talk page renders as a grey text box. For a product whose distribution *is* the shared link and the search snippet, that is the highest-leverage pixel on the project, and **346 chassis pages already have a photograph whose file name names the car** and could be the image today. `PD-20`, **S**.
- **The first screen of a page type with thousands of instances.** The MP4/4 page is the best page on this site — a real lede, a stat strip that means something, "Why it mattered", a specification table — and its photograph is 130 px wide, eighth in the visual order, captioned like a footnote. Make it lead on the 346 pages where the file name is confirmed, keep it small and labelled unconfirmed on the 385 where it is not (`name_matches = 0` on 337 of 602 images — `PM-07`). That is 731 pages, 21% of the site, for one component change. `PD-19`, **S**.
- **Density and scan in tables.** This is where a reference source lives, and yours is already good. Leave it alone.

Two places it does not pay:

- **Anything below the fold on a long page.** Hamilton's page is **7,009 px tall**. Craft spent at 5,000 px is craft nobody sees.
- **Anything that asserts a fact the database cannot support.** This is the test that disposes of Q3 and keeps Q1. A photograph of a car is *evidence* — it is the thing the row describes, and it carries its own licence and photographer. A rendered elevation profile is *decoration that makes a claim*. The first belongs here; the second does not.

One thing I will name as taste, not standard: the visual system is already good. The Pit Wall look, the stat strip, the condensed display face, the accent rule above each tile — that is a coherent system, and the reason your pages feel thinner than formula1.com is not the palette, it is that 73% of them have four zeros and no sentence. **The perceived "looks" problem on driver pages is a content problem.**

---

## The full set, by consequence

### `PD-14` — The repository is private, so the audit cannot be audited and the JSON export does not publicly exist — **S (a decision)**
*Evidence: drove the network. Defect, or an unstated position.*

`github.com/Alex-Farley/formula-1-data` returns 404; `api.github.com/users/Alex-Farley/repos` returns an empty list. The brief, `CLAUDE.md`, `README.md` and my first run all assume a public release. `lapledger.org` serves `f1.db` (20 MB), `f1-geometry.db` (217 KB) and `f1-parquet.zip` (1.3 MB) — all 200, all verified — so the *data* is obtainable. `f1_database.json` is 404 on the site and is a private release asset, so it is available to nobody.

Who this hurts: everyone the brief names except the fan. A developer evaluating whether to build on this cannot read the schema history or the checks. A journalist or Wikipedia editor cannot see what "cross-checked" means. `verify.py` is the entire distinguishing claim and it is unreadable.

**Do:** make the repository public, or state on `/reference/sources` that it is not and why. If it stays private, `PD-11`'s claim has to change from "audited" to "audited, take my word for it", which is a different product.

### `PD-15` — The driver stat strip is designed for a champion and rendered for a privateer — **M**
*Evidence: drove the site, queried the database. Defect.*

`Driver.jsx:173-184` emits Seasons, Entries, Wins, Podiums, Poles, Fastest laps, [Titles], Best finish. **625 of 862 drivers (73%) have wins, podiums, poles and fastest laps all zero**; 181 were never classified in any race. On `/drivers/bruce-halford` — nine entries, a representative page — four of seven tiles read `0` and one reads `P8`.

Note the convention collision: `number(derived.wins ?? 0)` forces a zero where this site's own homepage says a blank is never a zero. The zeros here are true, so this is not `CD-11` again — it is that four true zeros in a row carry no information and occupy half the page's most valuable strip.

**Do:** make the strip conditional on the career. Keep Seasons, Entries, Best finish always. Show Wins/Podiums/Poles/Fastest laps only where at least one is non-zero; for the other 625, fill those slots from figures that always exist and always differ: **Best grid**, **Starts** (`finish_position IS NOT NULL`), **Retirements** (`status IS NOT NULL`, as a share), **Laps completed**, **Constructors driven for**. All five are one `SELECT` away from the `DERIVED` query already at `Driver.jsx:23`. Independently shippable one tile at a time.

### `PD-16` — 618 driver pages have no opening sentence — **M**
*Evidence: queried the database, drove the site. Defect.*

`Driver.jsx:169` sets `lede={driver.notes}`; `notes` is populated on **244 of 862**. `CD-02` files the 111 that open with the harvest; `CD-03` files the 1,172 race pages with none. The 618 driver pages with nothing have not been filed by anyone, and they are 72% of the largest page type after cars and races.

The shape of the fix exists at `prerender.js:480-482`, which already composes a serviceable sentence for a race's meta description from columns the page holds. The same is available here: *"A British privateer who entered nine Grands Prix for Maserati, Lotus and Cooper between 1956 and 1960, finishing eighth in France in 1960 — his best result."* Every clause is a column.

**Do:** generate a lede from the entry record where `notes` is null, in both renderers from one expression, and keep `notes` as the override for the 244 that have a human sentence worth keeping. This is the single largest improvement available to "the driver pages should look nicer", and it is a paragraph of SQL rather than a design.

### `PD-17` — Six fields your upstream publishes, that you already fetch or could, are discarded — **S**
*Evidence: read the F1DB schema over the network, read the harvest. Defect of omission.*

F1DB's `Driver` entity (`f1db.schema.json`, v2026.13.0, CC BY 4.0) publishes `placeOfBirth`, `abbreviation`, `permanentNumber`, `bestStartingGridPosition`, `totalRaceLaps`, `bestChampionshipPosition` and `familyRelationships`. `harvest/f1db_drivers.txt` reads `abbreviation` and the `drivers` table has no column for it; the rest are not fetched. `familyRelationships` is the Hill, Villeneuve, Schumacher, Verstappen, Rosberg and Andretti dynasties — the single most human thing available about this register, free, and joinable to pages you already have.

**Do:** add the fields to the harvest line and the table. `placeOfBirth` alone converts "Born 1931-05-18" into "Born 18 May 1931 in Hampton-in-Arden, Warwickshire", which is most of what a photograph would have bought you. Note `bestStartingGridPosition` and `totalRaceLaps` are *derivable here*, so they arrive as a second source to cross-check against — which is this project's favourite kind of row.

### `PD-18` — Driver photographs: available for ~65%, and fourth in the queue — **S (a decision), M (the build)**
*Evidence: sampled the Wikipedia API, read the source. Preference, with the licence question settled.*

Coverage table in Q1 above. The mechanism is the one you already run. Two design consequences if you do it:

- **The template must not require one.** 302 of 862 pages would have no portrait, and they cluster in the pre-1970 half of the register. A layout with a fixed portrait slot will look broken there. Design the page to work with no image and improve with one.
- **`name_matches` does not exist for people.** The car harvest checks the file name against the car name; "Jim Clark in 1963 (cropped).JPG" checks fine, but a lead image on a driver article can be of the car, the grave, or the team. `PM-07` is the standing warning that 337 of 602 car images are unconfirmed. Decide the driver check before the harvest, not after.

**Do:** decide it after `PD-16` and `PD-19` have shipped, and judge then whether the page still feels thin.

### `PD-19` — 731 chassis pages carry a photograph you show at 130 px, and no static page carries an image at all — **S**
*Evidence: drove the site, queried the database, read the prerendered HTML. Defect of placement.*

`article_images` holds 602 rows across 602 Wikipedia articles. **731 of 1,153 chassis pages (63%) join to one; 346 join to one where `name_matches = 1`.** `Car.jsx:149-160` renders them in a "Photographs" section below the specification at `width={600}`, displayed at about 130 px. `curl /cars/mclaren-mp4-4 | grep -c "<img>"` returns **0** — the prerendered half of a 1,160-page section has no image in it, so Google Images has nothing from this site and neither does a crawler.

Circuits have no photographs at all, though `/circuits/suzuka` is one of the most-photographed places in the sport and Commons is full of free images of it.

**Do:** lead the car page with the photograph where `name_matches = 1`, at a size that reads; keep the unconfirmed ones where they are with the existing caveat. Emit the `<img>` from `prerender.js` too, with the credit — `CommonsCredit`'s fail-closed rule must be honoured in the static renderer or not rendered at all, and `smoke.mjs` already enforces this for the app and should be extended.

### `PD-20` — No `og:image` on any of 3,515 pages — **S**
*Evidence: read the prerendered HTML. Defect.*

`prerender.js:1306` writes `twitter:card="summary"` and no `og:image`, `twitter:image` or `image_src` anywhere. Confirmed on `/cars/mclaren-mp4-4` and `/drivers/hamilton`.

Who this hurts: the project's entire distribution. A reference source spreads by being linked, and every link this project has ever generated renders as a grey box.

**Do:** three tiers, all in `prerender.js`. Car pages with a confirmed image: the Commons thumbnail. Everything else: a generated card — the site mark, the page title, and the two or three figures the stat strip leads with — which `prerender.js` can write as an SVG per route at build time for essentially nothing. Set `twitter:card` to `summary_large_image` once there is an image to justify it.

### `PD-21` — `PD-08` answered: the atlas is a comparison surface, and it is arranged as the opposite — **M, in three S pieces**
*Evidence: drove the site, queried both databases, read the source. Defect and decision.*

Argument and numbers in Q2 above. The three pieces:

1. **Address it.** `/circuits/atlas/:id` or `?circuit=`, read on mount. Fixes the 25 broken contextual links, one of which I confirmed by clicking: Suzuka → Spa. This also makes it citable, which is what `IA-07` wants for the SQL console and for the same reason. **S.**
2. **Invert the page.** The wall first, at true scale by default — that is the only sentence on the page that nothing else can say. The single-circuit view second, or reached by picking a cell. The scrubber last or gone. **S.**
3. **State the selection rule** on the page and in `known_gaps`, and let it order the next traces. Silverstone at 61 races before Donington at 1 is not a close call. **S.**

*Engaging with my own first run,* which said "keep the atlas, maintenance is near zero, stop giving it a slot in Popular ways in": I was half wrong. The maintenance cost is near zero and the craft is real, but the page as arranged spends its prominence on the half that is duplicated twice elsewhere. It should keep the homepage slot **after** piece 2, not before.

### `PD-22` — The atlas is the only page type with no prerendered content — **S**
*Evidence: read the prerendered HTML, measured a throttled load. Defect.*

`curl /circuits/atlas` returns 6,440 bytes: chrome, a breadcrumb, a lede, and *"The drawings need JavaScript; the measurements are on each circuit page."* Nothing else on this site does that — `PD-01` exists precisely because every route should have a static page with content. Cold load to app takeover measured at **11,903 ms on 4 Mbps** (70 ms RTT, throttled Chromium against the preview build).

**Do:** prerender the 25 shapes as static SVG paths into the wall. The geometry is 217 KB of GeoJSON, `pathOf`/`project` in `lib/lap.js` are pure functions, and `prerender.js` already reads the geometry database. That gives a crawler 25 named circuits with their lengths, and gives the cold reader the page's whole point in the first 500 ms. The scrubber and the colouring can stay JavaScript-only; they are not the content.

### `PD-23` — 3D with elevation: decline, and buy `elevation_change_m` instead — **decision; the alternative is S**
*Evidence: read the source, queried the geometry, read the docs, inference on the DEM properties. Preference, strongly held.*

Reasoning in Q3. The alternative is a real product improvement: four circuits already assert an elevation figure in `data/circuits.py` prose ("100 m of elevation change" at Spa; "300 m" at the Nordschleife; "High altitude and a long uphill main straight" at Mexico City) and none of them is a queryable field. Promote them to a column with a source and a confidence tier, extend to the ~20 venues where a published source states one, and the circuit page gains a figure that is both new and checkable.

*Marked as inference:* the DEM accuracy and surface-model characterisations are from general knowledge of SRTM and Copernicus GLO-30, not from sampling them against your traces. If you disagree with the conclusion, the experiment that would settle it is cheap — sample SRTM along Spa and along Monaco and look at the two profiles side by side. If Monaco comes back clean, reopen this.

### `PD-24` — `meta.coverage_note` ships `PD-07`'s stale prose *inside the published artefact* — **S**
*Evidence: queried the database. Defect. Escalation of `PD-07` to a new location.*

`PD-07` files the README. The same falsehoods are in `meta`, which is in `f1.db`, in `f1_compat.json`, in `meta.parquet` and in the JSON export:

> "Partial by design for: full driver register (**every race winner, pole-sitter and fastest-lap setter, not all ~780 starters**); full finishing order; **qualifying, grid and lap-by-lap data (not held)**"

`drivers` holds 862 rows and `race_entries` covers 860 distinct drivers with 27,482 rows including finishing order. `qualifying` holds **26,997 rows**. `grid` is a column on `race_entries`. `meta.database_name` still reads "F1 Verified Facts Project Memory Database" (`PM-22`).

This matters more than the README does, because the bulk-data consumer reads `meta` and never reads the README. A machine asking this database what it contains is told, in the database's own words, that it does not contain qualifying — while holding 26,997 qualifying rows.

**Do:** ship it with `PD-07`. Generate `coverage_note` from the row counts, or shorten it to what is stable and put the counts in a view. Add the same `verify.py` check `PD-07` asks for, pointed at `meta` as well as the README.

### `PD-25` — The "recorded disagreements" claim is now one row, and that is a better claim than 45 — **S**
*Evidence: queried the database, read the source. Observation, with a copy consequence.*

`PD-04` shipped `<Disagreement>` to race and driver pages on 16+2 pages. `PM-05` and `PM-25` then correctly resolved 17 of the 18 open rows. `DRIVER_DISAGREEMENTS` and `RACE_DISAGREEMENTS` filter on `status LIKE 'open%'`, and there is now **exactly one open row in 45** — 1970 round 1, Brabham vs Surtees on fastest lap. So the component renders on **1 of 3,515 pages**.

That is not a regression; the data work was right. But it changes what `/data` should claim. `CD-07` writes the `/data` page around "60 recorded source disagreements", and `PD-11` repeats it. Written today that reads as a pile of doubt, and it is now inaccurate. The true and stronger claim is: **45 source disagreements found, 44 resolved on the record with the reasoning attached, 1 still open.** That is an audit trail, which is the thing F1DB does not have and cannot easily copy. Check `CD-07`'s wording before it ships.

The durable differentiators, after `PM-05`, are the confidence ladder, `known_gaps`, `constructor_lineage`, `circuit_layouts`, the ~170 checks — and the resolution history in `discrepancies`, not its open count.

### `PD-Ø` — still unsized, still untouched, and now there is a free partial answer
*Evidence: drove the network. Re-raised at higher severity.*

Still no analytics of any kind in `web/`. But F1DB's release API hands out per-asset download counts, and its most recent release (`v2026.13.0`, 6 September) shows **355 downloads of the SQLite zip, 601 of the split JSON, 392 of the CSV** — about 1,800 across formats, for one release, five days old. That is a competitor telling you the size of the bulk-data audience and which format it wants, for the cost of one HTTP request.

Your equivalent number is unobtainable, because the release is private (`PD-14`). Cloudflare's own analytics for `lapledger.org` would give you page views and the `/f1.db` request count at zero implementation cost and without a tracker, and `/build-status.txt` already establishes the pattern of writing a fact where it can be read.

**Do:** one of three, and write down which. (a) Read Cloudflare's request counts monthly. (b) Make the repository public and read the release download counts. (c) Decide measurement is not wanted, write that here, and let critics stop raising it. Any of the three ends this item; none of them is more than an hour.

---

## Landed items I checked, and what I found

- **`CD-01`** — verified in the browser. `/drivers/bruce-halford` renders "Finished" for his one classified result and the reason for each of the other eight. Correct in both halves. Good fix.
- **`IA-04`** — verified; the document is renamed on in-app navigation.
- **`PD-04`** — verified in source; renders on one page now, for the reason in `PD-25`. Not a fault of the fix.
- **`PD-01`** — verified: `dist/` holds 3,515 `index.html` files, `sitemap.xml` holds 3,515 `<url>` entries, and 1,160 of them are cars. The two numbers agreeing is worth noticing; `IA-06` says the search index still holds 3,494.

---

## What is genuinely good — do not touch while fixing the rest

- **`/cars/:id`.** The best page on this site and the model for every other entity page: a lede that says why the thing mattered, a stat strip where every tile means something, "The idea / What it did", a specification table with an explicit note about what a blank means, then the entries. If you want the driver page to look like something, look here, not at formula1.com.
- **The homepage's "The season, at both ends."** Last race run and next on the calendar, side by side, with the winner linked. That is the single most useful thing a returning fan can be shown and it is the first thing below the fold. Nothing on `/records` is as good as this.
- **`Onward` as computed links.** `Driver.jsx:387` gives Halford his last team, his best season, Records and the register, each with a reason. Every one of those is derived from his own record. This is still the best wayfinding on the site and it is better than most funded products.
- **The circuit page's honesty block.** *"No layout timeline for this circuit. Only thirteen of the eighty have one. Nothing maps what a circuit used to look like."* A constraint stated as a position, on the page where the reader hits it, linked to the gap register. This is the voice everything else should be rewritten toward.
- **The whole-download architecture, again.** I reopened it a second time with the network available and found no reason to move. The cold window is a content problem (`PD-02`, `PD-22`), not an architecture problem.
- **`PM-05`.** Splitting pole from grid 1, finding the three races where they differ, pinning all three counts in `verify.py`, and catching the car page's column-by-name bug in review — that is a piece of data work that would not have happened at most organisations and it made the database measurably more correct. It is also why `PD-25` exists, which is a nice problem to have.

---

## Which critics to run now, in priority order

Visual and interaction are running alongside me, so these are the four left.

1. **`user-research-simulator`.** Every question in this document ends at "nobody has asked anyone anything" — the atlas, the records slot, the driver page, `/data`, and whether `PD-Ø` matters. It is the only agent that can produce a proxy for demand without instrumenting anything, and you are about to spend real time on appearance with no evidence about who is looking. Run it first and give it the four questions above.
2. **`accessibility-critic`.** Not looked at once, and the surface has grown: 3,515 pages across two renderers, a range input, a modal search palette with no route, a colour-only encoding in the atlas legend, a confidence pill that is a bare word (`CD-10`), and a nav that scrolls with the scrollbar hidden (`IA-14`). It is also the discipline whose findings are cheapest to act on and most expensive to defer.
3. **`service-design-critic`.** `PD-14` is its territory and so is everything around it: a private repository behind a public promise, a weekly cron holding 93.5% of the rows, a deploy with the logs off, no contact route for a reader who finds an error, and no statement of what happens if F1DB stops. That is the whole longevity half of the product and nobody has looked at it.
4. **`data-architecture-critic`.** The brief reserves two real things for it — the consolidation onto `claims`/`checks` (`PM-14`–`PM-16`) and `race_entries` being one row per driver per race, which silently loses a result for the shared drives that were normal before 1965. Both are decisions only that discipline can frame. Lowest urgency because nothing reader-facing is blocked on either.

---

## What I did not examine

- **Any real user.** Again. Every statement about relative demand — including my decision on the atlas and my ranking of the driver-page fixes — is an argument from structure.
- **The deployed site's search performance.** I confirmed `lapledger.org` serves all three artefacts and its `robots.txt` and `sitemap.xml`, but I have no Search Console data beyond what `AF-01` records, so I cannot say whether any of the 3,515 pages are ranking. If they are not, `PD-20` and `PD-19` get more urgent and `PD-15`/`PD-16` get less.
- **Whether the private repository is deliberate.** I established that it is private and that the user has no public repositories. I did not establish why, and `PD-14` reads differently if it is a decision than if it is an oversight.
- **The driver photograph sample beyond 160 rows,** and the licence of each file beyond "Commons hosts only free files". That inference is sound in general but I did not read 122 individual licence templates. Coverage figures carry roughly ±8pp per stratum.
- **The DEM properties in Q3,** which are general knowledge, not measurement. Marked as inference in `PD-23` with the experiment that would falsify it.
- **17 of the 22 page components in their rendered state.** I drove home, drivers, driver, car, circuit, atlas and the mobile viewport.
- **`/records`, `/reference/*` and the SQL console this run.** My first run covered them and `IA-16` re-examined the nav slot; nothing I saw suggests either has changed.
- **The build and verify pipeline.** Every database figure here is a direct query against the committed `f1.db` and `f1-geometry.db`.
