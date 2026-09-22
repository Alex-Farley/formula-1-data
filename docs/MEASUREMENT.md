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
  arrival and never again. A route change here queries a database already in
  the tab, and it still asks the network for nothing;
- `IN_THIS_TAB` in `web/src/lib/site.js` now claims only that much — what you
  search for, sort or type never leaves, moving between pages sends nothing,
  and the one thing that does leave is a cookieless count of the page you
  arrived on.

They are one decision. `web/test/conventions.mjs` fails the build if the
`spa: false` is dropped while the sentence still promises what it buys, and if
the sentence goes back to the old wording while the beacon is still there.

## Setting it up

Both accounts are outside this repository, so the first four steps are a
person's and the loop cannot take them. Nothing here is a secret: a beacon
token is in the page source of every site that uses it, and a verification
string is a public claim of ownership. They are environment variables anyway,
because they name **an account** rather than describing this repository — a
fork that built this tree would otherwise report its arrivals into this
dashboard.

### 1. Cloudflare Web Analytics

1. Cloudflare dashboard → **Analytics & Logs → Web Analytics → Add a site**,
   hostname `lapledger.org`.
2. Choose **manual installation** and copy the **site token** out of the
   snippet it offers. Do not paste the snippet anywhere; only the token is
   wanted. (Automatic injection rewrites HTML at the edge, and this site is
   served out of a Worker's static assets. Rather than spend a fortnight
   discovering whether that path is rewritten, `prerender.js` writes the tag
   and `curl -s https://lapledger.org | grep beacon` settles it in one line
   `[D-09]`.)
3. Workers & Pages → **formula-1-data → Settings → Build → Variables and
   Secrets**, add a plain (not encrypted) variable:

   ```
   CF_BEACON_TOKEN = <the site token>
   ```

4. Push anything to `main`, or re-run the last deploy. Then check the two
   places that say whether it worked:

   ```bash
   curl -s https://lapledger.org/build-status.txt | sed -n '/measurement/,$p'
   curl -s https://lapledger.org/ | grep -o 'beacon.min.js[^>]*'
   ```

   The first should read `beacon   on — token ……, spa:false`. If it reads
   `OFF —` with a reason, the variable is malformed and the site deployed
   without it: the tag is never allowed to fail a deploy, and never allowed to
   fail silently either `[D-10]`.

### 2. Google Search Console

1. search.google.com/search-console → **Add property → Domain**, enter
   `lapledger.org`.
2. It asks for a DNS TXT record. Add it in the Cloudflare dashboard under
   **DNS → Records**; verification usually passes within a minute or two.
   A Domain property covers `www`, `http` and every subdomain, which a URL-prefix
   property does not — prefer it.
3. **Sitemaps → Add a new sitemap**: `sitemap.xml`. It carries one entry per
   prerendered page plus the feed, and `prerender.js` writes it fresh on every
   deploy, so it never needs resubmitting.

   If the DNS is ever somewhere unreachable, the other route is a URL-prefix
   property verified by a meta tag: set `GOOGLE_SITE_VERIFICATION` as a build
   variable exactly as above, with the `content` value only — not the whole
   tag — and `prerender.js` writes it into every page.

### 3. Wait a fortnight

Search Console backfills nothing. The clock starts when the property
verifies, not when the pages went up, and the first few days of arrival data
are worth nothing on their own.

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

## The two numbers to read, and what each answers

After a fortnight, read **arrivals by landing page** and **search impressions
by query**. Between them they close out this item:

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
| The tags, and the reasoning | `web/scripts/prerender.js`, under *measurement* |
| The claim they cost | `IN_THIS_TAB` in `web/src/lib/site.js`, `LEDE` in `web/src/queries/home.js` |
| The rules that keep the two in step | `web/test/conventions.mjs`, *what the pages send, and to whom* |
| What a given deploy actually wrote | `/build-status.txt`, last block |
