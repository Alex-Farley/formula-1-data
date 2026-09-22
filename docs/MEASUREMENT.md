# Measuring whether anybody arrives

`PD-0` (#261) sat under *Someday, or maybe never* for months and then became
the first item under *Now*, because of one number: **1 asset download across
six releases**, against F1DB's ~1,800 across formats in five days. One is not
a small version of 1,800. It is the number a finished, undistributed thing
gets.

What that number could not say is **which** kind of nothing it was. *Nobody
arrives* and *people arrive and leave* have opposite treatments, and every
ranking on the board was assuming one of them without evidence. The ruling of
2026-09-21 is the narrowest pair of instruments that tells them apart:

| | Answers | Costs |
|---|---|---|
| **Cloudflare Web Analytics** | arrivals, by landing page and referrer | free, cookieless, one script tag |
| **Google Search Console** | impressions and clicks, by query and by page | free, no tag at all if verified by DNS |

Nothing else was adopted. Bing Webmaster Tools, per-file request counts and
GitHub's per-asset download counts were all on the table on 2026-09-20 and are
not part of this; they can be added later against a measured baseline rather
than instead of one.

## What it cost, and what was bought back

The footer on every page used to say **"Nothing you look at or type is sent
anywhere."** The beacon sends the address you arrive on, so that sentence
stopped being true the day it shipped, and a promise this site cannot keep is
worth more than the measurement. Two changes keep it honest:

- the beacon is written with **`"spa": false`**, so it fires once on the
  arrival and never on a route change. That is also exactly what *arrivals by
  landing page* means, so nothing was given up buying it;
- `IN_THIS_TAB` in `web/src/lib/site.js` now claims only what the page leaves
  true: nothing you search for, sort or type is sent **as you do it**; what
  leaves is the address arrived on, counted once, **the photographs** from
  Wikimedia Commons as a reader reaches them, and **the fonts** from Google,
  which every page fetches; moving between pages counts nothing further; and a
  search, a filter or a SQL statement is **kept in the address**, so arriving
  at one of those hands it over with the page.

That last clause is there because the first attempt at this sentence said
"moving between pages asks the network for nothing", which is false — a route
change to any page with a photograph fetches it from Wikimedia, handing them
the reader's IP and the referrer. A narrower claim than the truth is the same
failure as a wider one.

The review of #580 found the third version of it, and this time the claim was
too wide. The beacon records `document.location.href` when it executes;
`web/src/pages/Sql.jsx` writes the typed statement to `?q=`, and
`web/src/lib/urlstate.js` writes a register's search, filters and sort there
too (IA-08, #525). So an arrival at one of those addresses — a reload, a
bookmark, a restored session, the permalink the console invites a reader to
share — sends the reader's own text to Cloudflare. `"spa": false` holds, so
typing alone sends nothing; it is one beacon per arrival, at whatever address
that arrival carries. Every published claim is therefore about the moment,
with the address named beside it, on this page as well as on the site.

**PD-50 (#581)** is the mechanism that would let the shorter claim come back:
strip the reader's own parameters from the address before the beacon executes,
and hand them to the app afterwards. Until it lands, the wording above is the
whole of the honesty.

They are one decision, and `web/test/conventions.mjs` holds them together: it
calls `measurement()` and asserts against **the tag that will actually be
written**, so dropping `"spa": false` fails, and it fails too if the footer
stops naming what that buys or goes back to either of the two wordings it has
already outgrown.

## Setting it up

Both accounts are outside this repository, so all of this is a person's and
the loop cannot take any of it. Nothing here is a secret: a beacon token is in
the page source of every site that uses it, and a verification string is a
public claim of ownership. They are environment variables anyway, because they
name **an account** rather than describing this repository — a fork that built
this tree would otherwise report its arrivals into this dashboard.

**The order that matters.** Setting the token does nothing on its own:
`prerender.js` is what writes the tag, so the beacon appears on the first
deploy that carries both. Set the variable whenever — it sits there
harmlessly — but if the code is not on `main` yet, expect
`/build-status.txt` to say nothing about measurement at all until it is.

### 1. Get the Cloudflare beacon token

1. **dash.cloudflare.com**, signed in.
2. Sidebar → **Analytics & Logs → Web Analytics**. It is at the *account*
   level, not inside the `lapledger.org` zone, which is the usual reason for
   not finding it.
3. **Add a site**, hostname `lapledger.org`.
4. Choose **manual installation**. If the site is already there with automatic
   setup, open **Manage site** and **turn automatic off**: it injects its own
   beacon at the edge, and with this one in the page every arrival would be
   counted twice.

   (Manual is the choice for a second reason. Automatic rewrites HTML at the
   edge, and this site is served out of a Worker's static assets; whether that
   path is rewritten is not something this repository can establish. Written
   into the page instead, one `curl` settles it `[D-09]`.)
5. It offers a snippet like

   ```html
   <script defer src='https://static.cloudflareinsights.com/beacon.min.js'
     data-cf-beacon='{"token": "0a1b2c3d4e5f60718293a4b5c6d7e8f9"}'></script>
   ```

   **Copy the token only** — the string inside the quotes after `"token":`.
   Not the tag, not the quotes, not `token:`. `prerender.js` writes the rest,
   and writes it with `"spa": false`, which the dashboard's snippet does not.

### 2. Put it on the Workers Builds project

1. dash.cloudflare.com → **Workers & Pages** (newer dashboards: **Compute**) →
   **`formula-1-data`**.
2. **Settings → Build → Variables and Secrets → Add**.
3. Type **Text**, not Secret — it is not one, and a plain variable can be read
   back later.

   ```
   CF_BEACON_TOKEN = <the token from step 1>
   ```

4. **Save.** Nothing happens yet: a build variable applies to the *next*
   build.

### 3. Deploy, and check it landed

A push to `main` builds and deploys. If the variable was added after the last
build, no push is needed either — **Deployments → Retry build** on the latest
one rebuilds the same commit with the new variable.

```bash
curl -s https://lapledger.org/build-status.txt | sed -n '/measurement/,$p'
curl -s https://lapledger.org/ | grep -o 'beacon\.min\.js[^>]*'
```

The first should read `beacon   on — token 0a1b2c…, spa:false`, the second
should show the tag with `"spa":false` in it. What the other answers mean:

| It says | What happened |
|---|---|
| `off — CF_BEACON_TOKEN is not set` | The variable did not reach the build: wrong project, or added after the build ran |
| `OFF — … is not 8–64 alphanumerics` | More than the token was pasted — the whole tag, stray quotes, a trailing space |
| no `measurement` block at all | The deploy is still running a `prerender.js` from before this change |

A malformed token is never allowed to fail a deploy, and never allowed to fail
silently either `[D-10]`, which is what that block is.

Then open the site and look at Web Analytics a few minutes later. **Ad
blockers block `static.cloudflareinsights.com`**, so an empty dashboard after
your own visit is expected; test from a phone on mobile data before concluding
anything is broken.

### 4. Google Search Console

No code at all if DNS verification works, and it will.

1. **search.google.com/search-console**, signed in to an account worth
   keeping: the property belongs to it, and other users can be added later.
2. Property dropdown, top left → **Add property**.
3. Two boxes appear. Take the left one, **Domain** — not URL prefix. Enter
   `lapledger.org`: no `https://`, no `www`.

   **This is not a preference, and here is the concrete reason.**
   `https://www.lapledger.org/` serves the whole site — same pages, same
   title, `200` — with its canonical pointing back at the apex (checked
   2026-09-22). A URL-prefix property for `https://lapledger.org/` would not
   cover that hostname, so every impression and click arriving on `www` would
   be missing from the only report this item is being measured by, and
   nothing in the interface would say so. A Domain property covers the apex,
   `www`, any subdomain and both schemes at once. Its one cost is that it can
   only be verified by DNS, which is free here.
4. It gives a TXT record — but the popup has a **DNS provider** dropdown,
   and until it reads **"Any DNS provider"** (with record type **TXT**) it
   shows provider-specific instructions rather than the string. Cloudflare is
   in that list and offers to write the record for you over OAuth; it works,
   and it asks for DNS write access across the account to save one paste.
   Copy the whole value, which starts `google-site-verification=`. If the
   popup is closed before that: the property name → verification methods →
   **DNS TXT record → Details** shows it again.
5. dash.cloudflare.com → the **lapledger.org** zone → **DNS → Records → Add
   record**. Type **TXT**, name `@`, content the pasted value, TTL Auto.
   **Save.**
6. Back in Search Console, **Verify**. Usually under a minute; a failure in
   the first few is DNS propagating, so wait five and try again.
7. Verified → **Sitemaps → Add a new sitemap**, and type just `sitemap.xml`.
   It carries one entry per prerendered page plus the feed, and
   `prerender.js` writes it fresh on every deploy, so it never needs
   resubmitting.

`GOOGLE_SITE_VERIFICATION` is **not** needed for any of this. It exists for
the day the DNS is somewhere unreachable: a URL-prefix property verified by a
meta tag instead, set as a build variable exactly as in step 2, with the
`content` value only and not the whole tag.

### 5. Wait a fortnight

Search Console backfills nothing. The clock starts when the property verifies,
not when the pages went up, and the first few days of arrival data are worth
nothing on their own.

## The baseline, so the fortnight has something to beat

Measured 2026-09-21, before any of the above:

| | |
|---|---|
| Unique repository visitors, 14 days | 4 |
| Release asset downloads, across 7 releases | 9 |
| Distinct referrers | 1 |
| Arrivals at lapledger.org | never measured |
| Search impressions | never measured |

Every release before 2026-09-14 was private, so the clean window opens there.

### Day zero, 2026-09-22

What was actually in place when counting began, verified against the live
site rather than assumed:

| | |
|---|---|
| Beacon live from | **18:02 UTC**, deploy `46306b4` |
| Beacon tags per page | **1** — on `/` and on a deep page, so automatic injection is off and no arrival is double-counted |
| Tag as served | `data-cf-beacon='{"token":"1f1f3c…","spa":false}'` |
| Search Console | verified some days earlier; the apex TXT record resolves, and it is the only TXT there |
| `sitemap.xml` | `200`, **3,542** URLs, named by `robots.txt` |
| Google's discovery route | the sitemap, and internal links — a sampled race page names `/constructors/ferrari` as its referring page |
| A sampled deep page | `/races/1976/9`: **Discovered – currently not indexed**, last crawl **N/A** |

**The two clocks do not start together.** Search Console had been accruing
for several days by the time the beacon went out, so for the first fortnight
the indexing trend has a longer runway than the arrivals data. Do not read
them week-on-week against each other.

### What "Discovered – currently not indexed" means here, because it will dominate the first read

The sampled page is technically clean: `200`, no `robots` meta, no
`X-Robots-Tag`, a self-referential canonical, in the sitemap, and 29,545
bytes of real prerendered HTML naming the winner and the classification. It
has simply never been fetched — last crawl `N/A`. That is the mild form of
the status: queued, not visited. The form that would mean something is wrong
carries a crawl date, meaning Google looked and declined.

Google crawls a new domain in proportion to what it thinks the domain is
worth, and that is mostly inbound links, of which this site has almost none.
So the count to watch across the 3,542 is not whether any single page
indexed but **whether that count falls**:

- **falling** — crawl budget is ramping and the site is earning trust; wait.
- **flat** — Google has decided the domain is not worth the crawl, and no
  technical work changes that. The remedy is links, which is `SD-18` (#389),
  the item that says this artefact is finished and undistributed.

Requesting indexing by hand moves one URL. The quota is about ten a day
against 3,542 pages, so it is a way to inspect a page's status, not a way to
get the site indexed.

## The two numbers to read, and what each answers

After a fortnight, read **arrivals by landing page** and **search impressions
by query**. Where each one is:

- Cloudflare → **Web Analytics → lapledger.org**, broken down by **Path** for
  the landing pages and by **Referrer** for how they got there.
- Search Console → **Performance**, the *Queries* tab for impressions by
  query and the *Pages* tab for which page each one showed.

Between them they close out this item:

- **Any organic arrival on a deep page** — a driver, a race, a season, not the
  home page — is the site working as designed. Every page on this site is
  prerendered precisely so that a search for *"1976 Japanese Grand Prix
  classification"* lands on the answer rather than on a front door.
- **Any query on which Lap Ledger is shown at all** separates *nobody arrives*
  from *people arrive and leave*. Impressions without clicks is a title and
  description problem. Clicks without downloads is a different problem
  entirely, and a much better one to have.

Then two follow-ons, both of which were waiting on this:

1. the items under *Next* get re-ranked against real arrival data — the
   user-research walkthrough predicts a third of them turn out premature and a
   handful urgent;
2. `SD-21` (#392) takes its answer-engine baseline, **the day before any
   announcement** — otherwise there is nothing to compare the announcement to.

## Where this lives in the code

| | |
|---|---|
| The tags, and the reasoning | `web/scripts/measurement.js`, called from `prerender.js` |
| The claim they cost | `IN_THIS_TAB` in `web/src/lib/site.js`, `LEDE` in `web/src/queries/home.js` |
| The rules that keep the two in step | `web/test/conventions.mjs`, *what the pages send, and to whom* |
| What a given deploy actually wrote | `/build-status.txt`, last block |
