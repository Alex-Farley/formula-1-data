# -*- coding: utf-8 -*-
"""
Harvest the photograph of every car article already accepted into this
database, with the attribution needed to display it.

    python3 tools/wikimedia_images.py               # full run, ~26 requests
    python3 tools/wikimedia_images.py --limit 100   # a sample, for a trial
    python3 tools/wikimedia_images.py --route category   # ~700 requests
    python3 tools/wikimedia_images.py --thumbs      # thumb_url only, both files

Reads:   harvest/car_specs.txt      the articles the spec harvest accepted
Writes:  harvest/article_images.txt the accepted rows
         harvest/article_images.log every article, and why it was refused

The category route (AF-42, at the end of this docstring) reads
harvest/chassis.txt as well and writes harvest/category_images.txt and
harvest/category_images.log instead. The two routes never write each other's
files.

No image is downloaded and none is stored. What is stored is a *reference*
and its attribution: which file an article leads with, who took it, and
under what licence. The pixels are fetched from Wikimedia's own servers by
whatever renders the page, under Wikimedia's terms, and this repository
redistributes nothing.

The thumbnail's own address (VD-23)
-----------------------------------
`thumb_url` is the address the API gives for the file at the width asked
(`thumburl`, with its tracking query dropped), so a page can ask for the
pixels in one request. Built from the file name instead, through
`Special:FilePath`, the same thumbnail took two redirects on 2026-09-23 - to
`Special:Redirect`, then to the thumbnail server - before a byte of it
arrived. Commons now serves only a fixed ladder of thumbnail widths, and
refuses a direct request for any other with a 400, so the address is taken
as the API gives it and never assembled here. Every one is fetched once
before it is written: an address that does not answer 200 with an image is
left empty and logged, and a page with no `thumb_url` builds the
`Special:FilePath` address as it always did (web/src/lib/commons.js).

`--thumbs` refreshes that one column in both committed files and changes
nothing else: no file is chosen afresh and no credit is re-read, so the rows
stay the rows the dated run above chose, and the note it adds to the header
says when the addresses were last fetched.

What is checked, and what cannot be
-----------------------------------
The article is the constraint. These are not images found by searching for a
car's name - that would be inference of exactly the kind that put an invented
"Ferrari 125 F2" into the abandoned 1952 harvest. Every article read here has
already passed the three checks in tools/wikispec_fetch.py: its infobox names
the constructor F1DB assigns the chassis, the years it reports fall inside the
seasons F1DB records it entered, and its title is a form of that constructor
followed by the chassis's designation. The claim recorded is therefore "the article that was proved to describe
this chassis carries this file", which a rerun of this tool re-establishes.

Which file on the article
-------------------------
The article's lead image (`pageimage`) is taken where there is one. Where
there is none, a file from the body of the article is taken - but only one
whose own name names the car, by the same test as `name_matches` below: the
article title or a chassis id, starting at a word and not cutting into a run
of digits, so "Brabham BT46 Lauda.jpg" does not name the BT4. A
body image is placed by an editor to illustrate *something* in the article,
and that is often not the car: the Cooper T58 article carries a Renault 4
road car, and the BRM P115 article a Jackie Stewart photograph from a season
he drove a Matra and a display of BRM's H16 engine. "The first photograph on
the page" would admit all three. So the rule that half-detects a wrong lead
image is, for a body image, the condition of taking it at all, and an article
with no body image that names the car stays refused. Among several that do,
the first by title is taken, which is the order the API returns and does not
change between runs. Vector files, audio and video are never candidates.

Lead image or body image, every check below applies unchanged, and a body
image that fails one gives way to the next that names the car.

Three checks are applied here, and each one refuses a row outright:

  1. **Commons.** `imagerepository` must be `shared`. A file hosted locally on
     en.wikipedia.org is there precisely BECAUSE it is not free - local upload
     is how a non-free image is kept off Commons - so linking one would be a
     licence violation dressed up as a feature. On the run that produced the
     committed file all 610 files were `shared`, which is why the check looks
     redundant; it is not, because the lead image of an article is whatever an
     editor last put there and that can change tomorrow.
  2. **A free licence.** Sixteen distinct licence strings appear across these
     files - CC BY-SA at four different versions, CC BY at four more, CC0,
     public domain, and country-specific variants. There is no single blanket
     credit line that covers them, so each file carries its own.
  3. **An attributable author.** Where `AttributionRequired` is true, there
     must be an Artist or a Credit to attribute to. CC BY and CC BY-SA
     attribution is not optional, and a file that cannot be attributed cannot
     be displayed.

What CANNOT be checked is whether the photograph shows the car. Nothing in
this database constrains the content of an image, and there is no second
source to disagree with. Testing whether the file name mentions the chassis
finds only 294 of 610, because most correct images are filed under the driver
- `File:Jos_Verstappen_2000_Monza_(cropped).jpg` really is an Arrows A21 - so
the test cannot be a rule without discarding half the good rows. It is
recorded as `name_matches` and enforced nowhere. The failure it half-detects
is real: the lead image of the ATS D5 article is
`File:Grand_Prix_van_NL_op_circuit_van_Zandvoort_nr._10_,_11_officials_en_politie...`,
which is a photograph of officials and police.

So these rows enter at `unverified`, which is where this database puts what it
cannot prove, and `./f1 unverified` lists them for a person to look at. That is
the honest position, not a gap to pad.

The category route, for a chassis with no article
-------------------------------------------------
A chassis whose only Wikipedia coverage is its team's page has no article, so
the route above never reaches it. `--route category` looks instead for a
Wikimedia Commons category named for the chassis - `Category:Vanwall VW5` -
and takes a photograph filed under it. The claim is weaker, and it is
recorded as weaker: "Commons editors filed this file under a category named
for this chassis", at the `catalogued` rung, one below `unverified`. An
editor's filing is better evidence than a file name, but a category admits
replicas, scale models, show cars and museum mock-ups, and nothing here can
tell. The rung is what keeps these rows separable from the article route's,
and `route` in the table says which is which.

A category is taken only when all of these hold:

  a. **Its title is this chassis's name.** The constructor (F1DB's short or
     full name, whole, with the filler words check 3 allows), then the
     designation exactly - no family cut and no variant letter, since March
     ran the 721, 721G and 721X as three chassis - then nothing, or only a
     tail from TAILS ("F1", "E Performance", "(Formula One car)"). An exact
     title is tried first; Commons' own category search only proposes
     titles, which this rule then judges.
  b. **Commons files it as a Formula One car.** One of its visible parent
     categories names Formula One. This is the category route's equivalent
     of the article route's "infobox is not a Formula One car": it is what
     refuses `Category:Ferrari 275` (the road cars), `Category:Porsche 718`
     (a sports-racer and a Cayman) and `Category:Lotus 20` (Formula Junior).
  c. **No other chassis claims it.** A category two chassis resolve to names
     neither of them.

Its files are then walked, and its subcategories to two levels - the
Stirling Moss photographs of the VW5 are one level down - but only a
subcategory whose title is the category's own followed by "of", "in", "at"
or a bracket, which is how Commons names one car's appearances. A file or
subcategory whose name says replica, model, scale, show car and the like
(REPLICA) is passed over, as is a category whose own title says so: that is
a narrowing rule, not a check that the rest show the car. So are these: a
file that two chassis's categories both hold is a candidate for neither, and
a file whose name names another chassis of the same constructor - "Coloni
FC188B" in the FC188's category - is not a candidate for this one. Among the files left, one that names the car is taken
first, then the shallower, then by title.

Checks 2 and 3 above apply unchanged. Check 1 cannot be applied the same
way, and this is a restatement, not a dropped check: asked about its own
file, Commons answers `imagerepository` = `local` - `shared` is what
en.wikipedia.org says of a file it does not host. The equivalent is that the
query went to commons.wikimedia.org and the page is in namespace 6 (File),
which is where a file hosted on Commons lives; a non-free local upload is on
en.wikipedia.org and cannot be answered by this query at all. Those rows are
stored with `repository` = `commons`, and the schema's CHECK accepts that
value only on the category route.
"""
import argparse
import html
import json
import os
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

from wikispec_fetch import FILLER, _GLUE, designation, words

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HARVEST = os.path.join(ROOT, "harvest")

API = "https://en.wikipedia.org/w/api.php"
COMMONS_HOST = "commons.wikimedia.org"
COMMONS_API = f"https://{COMMONS_HOST}/w/api.php"
UA = ("formula-1-data/2.14 (https://github.com/Alex-Farley/formula-1-data; "
      "article lead-image attribution harvest)")

# Batch size. The API caps titles at 50 for an unauthenticated client and
# silently truncates past it, so this is a limit, not a tuning knob.
BATCH = 50

# Pacing. The API rate-limits an anonymous client hard: a run at 0.4 s between
# batches returned 429 partway through and lost the pass. 1.5 s completes.
DELAY = 1.5

COLUMNS = ["article", "file_name", "repository", "licence", "licence_url",
           "artist", "credit", "description_url", "thumb_url", "width",
           "height", "name_matches"]

# The width asked of the API for `thumb_url`, `width` and `height`. The
# front end asks for no more than this from the stored address and builds a
# Special:FilePath one for anything wider (THUMB_WIDTH in web/src/lib/commons.js,
# which must agree).
THUMB_WIDTH = 800

# Where Wikimedia serves the pixels from. The API answered with the second on
# 2026-09-23; the first is the one the files have been served from for years
# and still answers. A thumburl on any other host is not taken.
THUMB_HOSTS = ("upload.wikimedia.org", "thumb.wikimedia.org")

# Licence strings accepted as free, matched case-insensitively against the
# start of extmetadata.LicenseShortName. Deliberately a list of prefixes and
# not a regex over "cc": "CC BY-NC" and "CC BY-ND" both start with "cc by"
# and neither is free enough to display here without further thought.
FREE = ("cc0", "cc by 1.0", "cc by 2.0", "cc by 2.5", "cc by 3.0", "cc by 4.0",
        "cc by-sa 1.0", "cc by-sa 2.0", "cc by-sa 2.5", "cc by-sa 3.0",
        "cc by-sa 4.0", "public domain", "attribution", "pd-")


def norm(s):
    """Letters and digits only, for the name-match signal."""
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"[^a-z0-9]", "", s.lower())


def norm_keep(s):
    """norm() without dropping the separators: lower case, accents folded."""
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c)).lower()


def title_key(name):
    """The API answers in normalised titles - spaces, not underscores.

    `pageimage` hands back the underscored file name, so asking for
    "File:ATS_D2.jpg" and looking the answer up under that spelling finds
    nothing: it comes back as "File:ATS D2.jpg". Both directions go through
    here so the two always meet.
    """
    return (name or "").replace("_", " ").strip()


def plain(value):
    """extmetadata fields arrive as HTML. Reduce to displayable text.

    Artist is routinely a link - `<a href="...">Morio</a>` - and Credit is
    routinely a `<span>` wrapping "Own work". Storing the markup would put
    someone else's HTML into a field this project renders, so it is stripped
    here rather than trusted downstream.
    """
    if not value:
        return None
    text = re.sub(r"<[^>]+>", " ", value)
    text = html.unescape(text)
    text = " ".join(text.split())
    # A pipe would split the field on read. Nothing legitimate needs one.
    text = text.replace("|", "/")
    return text or None


def api(session_delay=DELAY, endpoint=API, **params):
    """One API call, with the backoff a 429 actually needs."""
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = endpoint + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=45) as r:
                data = json.loads(r.read().decode("utf-8"))
            time.sleep(session_delay)
            return data
        except urllib.error.HTTPError as e:
            # 429 is the common case and it needs seconds, not milliseconds.
            if e.code in (429, 503) and attempt < 5:
                time.sleep(5 * (attempt + 1))
                continue
            raise
        except Exception:
            if attempt < 5:
                time.sleep(5 * (attempt + 1))
                continue
            raise
    raise SystemExit("wikimedia_images: gave up after six attempts")


def batches(xs, n=BATCH):
    for i in range(0, len(xs), n):
        yield xs[i:i + n]


def thumb_address(url):
    """The API's thumburl without its tracking query, or None.

    `?utm_source=...` is Wikimedia counting which wiki handed the address
    out, not part of the file's address, and a stored copy of it would tell
    them the wrong thing on every load. Only https on THUMB_HOSTS is kept.
    """
    if not url:
        return None
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != "https" or parts.netloc not in THUMB_HOSTS:
        return None
    return urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path,
                                    "", ""))


# Pacing for the thumbnail check. These are HEAD requests to the media
# servers, not the API, one per file.
HEAD_DELAY = 0.2


def check_thumbs(rows, log, key):
    """Fetch every row's thumb_url once; empty the ones that do not answer.

    A HEAD request, so no pixels are downloaded. What passes is a 200 whose
    content type is an image; a redirect is followed and then counted as a
    failure, because an address that redirects is not the one-request
    address this column exists to hold.
    """
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, *a, **k):
            return None
    opener = urllib.request.build_opener(NoRedirect)
    bad = 0
    for n, r in enumerate(rows, 1):
        if n % 100 == 0:
            print(f"  thumbnails checked: {n}/{len(rows)}", flush=True)
        url = r.get("thumb_url")
        if not url:
            log.append(f"{r[key]}\tNO THUMB\t{r['file_name']}: the API gave "
                       f"no thumbnail address on {', '.join(THUMB_HOSTS)}")
            bad += 1
            continue
        req = urllib.request.Request(url, method="HEAD",
                                     headers={"User-Agent": UA})
        why = None
        for attempt in range(4):
            try:
                with opener.open(req, timeout=30) as resp:
                    kind = resp.headers.get("Content-Type", "")
                    if resp.status != 200 or not kind.startswith("image/"):
                        why = f"answered {resp.status} {kind or 'no type'}"
                    else:
                        why = None
                break
            except urllib.error.HTTPError as e:
                if e.code in (429, 503) and attempt < 3:
                    time.sleep(5 * (attempt + 1))
                    continue
                why = f"answered {e.code}"
                break
            except Exception as e:  # network: retried, then recorded
                if attempt < 3:
                    time.sleep(5 * (attempt + 1))
                    continue
                why = f"did not answer ({type(e).__name__})"
        time.sleep(HEAD_DELAY)
        if why:
            log.append(f"{r[key]}\tNO THUMB\t{r['file_name']}: {url} {why}")
            r["thumb_url"] = None
            bad += 1
    print(f"  thumbnails: {len(rows) - bad} of {len(rows)} answer in one "
          f"request; the rest fall back to Special:FilePath", flush=True)


def read_articles():
    """The articles the specification harvest accepted, with their chassis.

    Read by column name. Positional reads of a file another tool generates
    are a standing trap - adding a column to car_specs.txt once silently
    shifted every field in this direction and cost two full re-harvests.
    """
    path = os.path.join(HARVEST, "car_specs.txt")
    if not os.path.exists(path):
        raise SystemExit(
            "harvest/car_specs.txt is missing. Run tools/wikispec_fetch.py "
            "first - its accepted articles are what this tool reads.")
    cols, out = None, []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            if line.startswith("#"):
                if "|" in line:
                    cols = [c.strip() for c in line.lstrip("# ").split("|")]
                continue
            if not line.strip():
                continue
            parts = line.split("|")
            if cols is None:
                raise SystemExit("car_specs.txt: no column header found.")
            if len(parts) != len(cols):
                raise SystemExit(
                    f"car_specs.txt: {len(parts)} fields, expected "
                    f"{len(cols)}. Rerun tools/wikispec_fetch.py.")
            row = {c: (v.strip() or None) for c, v in zip(cols, parts)}
            if row.get("article"):
                out.append((row["article"], row.get("chassis_ids") or ""))
    return out


# A body image is a photograph or nothing. Flags, logos and stub icons are
# SVG; recordings and clips are neither a photograph nor displayable as one.
RASTER = (".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".webp")


def names_car(file_name, article, chassis_ids, whole=False):
    """Does the file's own name name the car? Recorded as `name_matches`.

    A name matches where it does not cut into a run of digits at its end,
    and starts at a word or where letters meet digits, so the BT4 is not
    named by "Brabham BT46" nor the RAM 01 by "Tram 01", while
    "Ferrari553F1.jpg",
    "Brabham BT11A" and "2020 Formula One tests Barcelona, Alfa Romeo C39"
    still name theirs. `chassis_ids` is car_specs.txt's field, joined with
    "+" for a family article that several chassis share.

    `whole` also refuses a name not followed by a separator, so that
    "Coloni FC188B" names the FC188B and not the FC188. The category route
    uses it to find a file that names a sibling chassis.
    """
    # The file name as norm() reduces it, remembering where a separator
    # stood: "ATS D6 1.jpg" is atsd61jpg, and the D6 ends at a space.
    fn, seps = "", set()
    for w in re.split(r"[^a-z0-9]+", norm_keep(file_name)):
        if w:
            seps.add(len(fn))
            fn += w
    seps.add(len(fn))
    names = [article] + [c for c in (chassis_ids or "").split("+") if c]
    for want in {norm(x) for x in names} - {""}:
        at = fn.find(want)
        while at >= 0:
            end = at + len(want)
            # It may start only at a separator or where letters meet
            # digits ("1991BenettonB191"): "Camera" does not name the ERA A.
            if (not (at not in seps and fn[at - 1].isdigit()
                     == want[0].isdigit())
                    and not (end not in seps and fn[end].isdigit()
                             and want[-1].isdigit())
                    and not (whole and end not in seps)):
                return True
            at = fn.find(want, at + 1)
    return False


def body_candidates(files, article, chassis_ids):
    """The body images of an article that may stand in for a lead image:
    raster files whose names name the car, in title order."""
    return sorted(f for f in files
                  if f.lower().endswith(RASTER)
                  and names_car(f, article, chassis_ids))


def lead_images(titles, log):
    """article title -> 'File:...' for the article's lead image, and the
    articles that have none."""
    found, bare = {}, []
    for n, batch in enumerate(batches(titles), 1):
        print(f"  lead images, batch {n}: {len(batch)} articles", flush=True)
        d = api(action="query", prop="pageimages", piprop="name",
                titles="|".join(batch))
        # A redirect or a normalised title comes back under a different name
        # than the one asked for. Map it back so the row still keys on the
        # article this database holds.
        back = {}
        for kind in ("normalized", "redirects"):
            for m in d.get("query", {}).get(kind, []) or []:
                back[m["to"]] = m["from"]
        for p in d.get("query", {}).get("pages", []) or []:
            title = back.get(p.get("title"), p.get("title"))
            if p.get("missing"):
                log.append(f"{title}\tREFUSED\tno such article")
                continue
            if not p.get("pageimage"):
                bare.append(title)
                continue
            found[title] = title_key("File:" + p["pageimage"])
    return found, bare


def body_images(titles):
    """article title -> every 'File:...' the article's body carries."""
    found = {}
    for n, batch in enumerate(batches(titles), 1):
        print(f"  body images, batch {n}: {len(batch)} articles", flush=True)
        cont = {}
        while True:
            d = api(action="query", prop="images", imlimit="max",
                    titles="|".join(batch), **cont)
            back = {}
            for kind in ("normalized", "redirects"):
                for m in d.get("query", {}).get(kind, []) or []:
                    back[m["to"]] = m["from"]
            for p in d.get("query", {}).get("pages", []) or []:
                title = back.get(p.get("title"), p.get("title"))
                for im in p.get("images") or []:
                    found.setdefault(title, []).append(title_key(im["title"]))
            if "continue" not in d:
                break
            cont = d["continue"]
    return found


def file_info(files, log, endpoint=API):
    """'File:...' -> dict of repository, licence and attribution.

    `host` and `namespace` are what the category route's check 1 reads: the
    wiki that answered, and where the page sits on it.
    """
    info = {}
    host = urllib.parse.urlsplit(endpoint).netloc
    for n, batch in enumerate(batches(files), 1):
        print(f"  file metadata, batch {n}: {len(batch)} files", flush=True)
        d = api(action="query", prop="imageinfo",
                iiprop="url|size|extmetadata", iiurlwidth=str(THUMB_WIDTH),
                titles="|".join(batch), endpoint=endpoint)
        for p in d.get("query", {}).get("pages", []) or []:
            name = title_key(p.get("title"))
            ii = (p.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata", {}) or {}
            get = lambda k: (em.get(k) or {}).get("value")
            info[name] = {
                "host": host,
                "namespace": p.get("ns"),
                "repository": p.get("imagerepository"),
                "licence": plain(get("LicenseShortName")),
                "licence_url": plain(get("LicenseUrl")),
                "artist": plain(get("Artist")),
                "credit": plain(get("Credit")),
                "description_url": ii.get("descriptionurl"),
                "thumb_url": thumb_address(ii.get("thumburl")),
                "attribution_required": (get("AttributionRequired") or ""),
                "width": ii.get("thumbwidth") or ii.get("width"),
                "height": ii.get("thumbheight") or ii.get("height"),
            }
    return info


def admit(article, file_name, meta, chassis_ids, log, route="article"):
    """Apply the three checks. Returns a row, or None with a logged reason.

    On the category route `article` is the chassis's full name - the label
    the log keys on and the name the file is tested against - and the row's
    `repository` is 'commons'; see the module docstring for why check 1 is
    restated there rather than dropped.
    """
    if meta is None:
        log.append(f"{article}\tREFUSED\tno metadata for {file_name}")
        return None

    # 1. Commons only. A local en.wiki file is local because it is non-free.
    if route == "category":
        # Asked of Commons itself, a Commons file answers 'local'. What
        # proves it is on Commons is who answered and where the page is.
        if (meta.get("host") != COMMONS_HOST or meta.get("namespace") != 6
                or meta["repository"] != "local"):
            log.append(f"{article}\tREFUSED\t{file_name} was not answered "
                       f"as a File page by {COMMONS_HOST} (host "
                       f"{meta.get('host')!r}, namespace "
                       f"{meta.get('namespace')!r}, repository "
                       f"{meta['repository']!r})")
            return None
        repository = "commons"
    elif meta["repository"] != "shared":
        log.append(f"{article}\tREFUSED\t{file_name} is hosted "
                   f"{meta['repository']!r}, not on Commons")
        return None
    else:
        repository = "shared"

    # 2. A free licence, matched against a list of what is actually free.
    lic = (meta["licence"] or "").lower()
    if not lic:
        log.append(f"{article}\tREFUSED\t{file_name} states no licence")
        return None
    if not any(lic.startswith(p) for p in FREE):
        log.append(f"{article}\tREFUSED\t{file_name} licence "
                   f"{meta['licence']!r} is not on the free list")
        return None

    # 3. Someone to attribute it to, where the licence demands one.
    required = str(meta["attribution_required"]).lower() == "true"
    if required and not (meta["artist"] or meta["credit"]):
        log.append(f"{article}\tREFUSED\t{file_name} requires attribution "
                   f"and names no author")
        return None

    if not meta["description_url"]:
        log.append(f"{article}\tREFUSED\t{file_name} has no description page")
        return None

    # The signal that is recorded and, for a lead image, enforced nowhere.
    # See the module docstring: it finds under half the correct lead images,
    # because most are filed under the driver rather than the car. A body
    # image is only a candidate when it holds.
    matches = 1 if names_car(file_name, article, chassis_ids) else 0

    return {
        "article": article,
        "file_name": file_name,
        "repository": repository,
        "licence": meta["licence"],
        "licence_url": meta["licence_url"],
        "artist": meta["artist"],
        "credit": meta["credit"],
        "description_url": meta["description_url"],
        "thumb_url": meta.get("thumb_url"),
        "width": meta["width"],
        "height": meta["height"],
        "name_matches": matches,
    }


# ------------------------------------------------------ the category route

CAT_COLUMNS = ["chassis_id", "category", "file_name", "repository",
               "licence", "licence_url", "artist", "credit",
               "description_url", "thumb_url", "width", "height",
               "name_matches"]

# Words a category title may carry after the designation without naming a
# different car. "Ferrari 125 F1" is the Formula One 125 where "Ferrari 125"
# is the road-car family; the Mercedes cars are catalogued under their full
# season names; "ERA A-Type" is how Commons spells the ERA A. Anything else
# after the designation - "Ferrari 125 S", "Talbot-Lago T26C-GS" - is refused.
TAILS = {(), ("f1",), ("type",), ("e", "performance"), ("eq", "performance"),
         ("eq", "power")}

# A parenthesised qualifier is accepted only when it says Formula One and
# nothing else: "Lotus T128 (Formula One car)", not "Lotus T128 (Le Mans
# Prototype)" and not "(Formula One show car)".
F1_BRACKET = re.compile(r"(formula (one|1)|f1)( (racing )?car)?", re.I)

# Check b: a visible parent category that files it as a Formula One car.
F1_PARENT = re.compile(r"formula (one|1)\b|\bf1 cars\b", re.I)

# The narrowing rule: a file or subcategory whose name says it is not the
# car, or not the car as a whole. The first run took a cutaway drawing, a
# fuel tank, a rear wing, an engine, a gear lever, a team logo and a
# photograph of a fatal accident, each from the right category.
REPLICA = re.compile(r"\b(replicas?|models?|scale|diecast|die-cast|lego|toys?|"
                     r"miniatures?|mock-?ups?|show ?cars?|tributes?|"
                     r"re-?creations?|kits?|1[:/]\d+|cutaways?|przekr\w*|"
                     r"engines?|cockpits?|logos?|wings?|tanks?|gearbox\w*|"
                     r"steering|suspension|tyres?|tires?|badges?|"
                     r"dashboards?|interiors?|details?|schalthebel|lenkrad|"
                     r"accidents?|crash\w*|fatal)\b", re.I)

# How Commons names one car's appearances under its category.
SUBCATEGORY = re.compile(r"(of|in|at)\s|\(", re.I)

# How deep subcategories are walked, and how many files per chassis are
# asked about before the chassis is refused.
DEPTH = 2
PER_CHASSIS = 5

# Commons answers a batch of fifty as readily as the article API; this pace
# completed a full run without a 429.
COMMONS_DELAY = 1.0


def cat_bare(title):
    return title[len("Category:"):] if title.startswith("Category:") else title


def category_tail(title, full, name, cons_names):
    """Check a: is `title` this chassis's name? The tail it carries, or None.

    `cons_names` is F1DB's short and full name for the constructor. Stricter
    than check 3 for articles: the designation must be matched whole, with no
    family cut and no variant letter, because a category holds photographs
    of every car filed under it and a family category would admit them all.
    """
    bare = cat_bare(title).strip()
    if REPLICA.search(bare):
        return None                # "(Formula One show car)", "... replica"
    m = re.fullmatch(r"(.*?)\s*\(([^()]*)\)", bare)
    if m:
        if not F1_BRACKET.fullmatch(m.group(2).strip()):
            return None
        bare = m.group(1)
    t = words(bare)
    # The constructor is matched whole, filler aside: "Lotus T128" is Lotus
    # Racing's and "Red Bull Racing RB22" Red Bull's, but "Red RB22" and
    # "Aston NB42" name nobody.
    cores = [c for c in ([w for w in words(n) if w not in FILLER]
                         for n in cons_names) if c]
    extra = FILLER | {w for c in cons_names for w in words(c)
                      if w not in _GLUE and not any(ch.isdigit() for ch in w)}
    want = "".join(designation(full, cons_names[0] if cons_names else "",
                               name))
    if not want:
        return None
    for i in range(1, len(t)):
        core = [w for w in t[:i] if w not in FILLER]
        for f in cores:
            if core[:len(f)] != f:
                continue
            if any(w not in extra for w in core[len(f):]):
                continue
            run = ""
            for j in range(i, len(t)):
                run += t[j]
                if run == want:
                    tail = tuple(t[j + 1:])
                    if tail in TAILS:
                        return tail
                    break
                if not want.startswith(run):
                    break
    return None


def exact_titles(full, name, short):
    """The category titles tried before any search: the full name, and the
    full name with the designation's spaces closed ("Vanwall VW 5" is
    catalogued as "Vanwall VW5")."""
    out = [f"Category:{full}"]
    if short and full.startswith(short + " "):
        closed = f"Category:{short} {full[len(short) + 1:].replace(' ', '')}"
        if closed not in out:
            out.append(closed)
    return out


def read_bare_chassis():
    """(chassis_id, constructor_id, name, full_name) for every F1DB chassis
    no accepted article claims, each constructor's two names, and every
    chassis (for the sibling rule).

    Read from the harvest files build.py reads, so the set is the one the
    build will leave with `chassis.article` NULL.
    """
    claimed = set()
    every = []
    for _article, ids in read_articles():
        claimed.update(i for i in ids.split("+") if i)
    cons = {}
    chassis = []
    for fname, into in (("f1db_constructors.txt", cons),
                        ("chassis.txt", chassis)):
        path = os.path.join(HARVEST, fname)
        if not os.path.exists(path):
            raise SystemExit(f"harvest/{fname} is missing. Run "
                             f"tools/f1db_fetch.py first.")
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.rstrip("\n")
                if not line.strip() or line.startswith("#"):
                    continue
                p = line.split("|")
                if into is cons:
                    cons[p[0]] = (p[1], p[2])
                    continue
                every.append((p[0], p[1], p[2], p[3]))
                if p[0] not in claimed:
                    chassis.append((p[0], p[1], p[2], p[3]))
    return chassis, cons, every


def search_categories(term):
    d = api(action="query", list="search", srsearch=term, srnamespace=14,
            srlimit=6, endpoint=COMMONS_API, session_delay=COMMONS_DELAY)
    return [s["title"] for s in d.get("query", {}).get("search", []) or []]


def category_parents(titles):
    """title -> its visible parent categories, or None where it is missing."""
    out = {}
    for n, batch in enumerate(batches(sorted(titles)), 1):
        print(f"  category parents, batch {n}: {len(batch)}", flush=True)
        cont = {}
        while True:
            d = api(action="query", prop="categories", clshow="!hidden",
                    cllimit="max", titles="|".join(batch),
                    endpoint=COMMONS_API, session_delay=COMMONS_DELAY, **cont)
            back = {m["to"]: m["from"]
                    for m in d.get("query", {}).get("normalized", []) or []}
            for p in d.get("query", {}).get("pages", []) or []:
                title = back.get(p["title"], p["title"])
                if p.get("missing") or p.get("invalid"):
                    out[title] = None
                    continue
                got = out.setdefault(title, [])
                if got is not None:
                    got.extend(c["title"] for c in p.get("categories") or [])
            if "continue" not in d:
                break
            cont = d["continue"]
    return out


def category_members(title):
    """(files, subcategories) filed directly under a Commons category."""
    files, subs, cont = [], [], {}
    while True:
        d = api(action="query", list="categorymembers", cmtitle=title,
                cmtype="file|subcat", cmlimit="max",
                endpoint=COMMONS_API, session_delay=COMMONS_DELAY, **cont)
        for m in d.get("query", {}).get("categorymembers", []) or []:
            if m.get("ns") == 6:
                files.append(title_key(m["title"]))
            elif m.get("ns") == 14:
                subs.append(m["title"])
        if "continue" not in d:
            break
        cont = d["continue"]
    return files, subs


def walk(category):
    """[(file, depth)] under a category and the subcategories that are this
    car's appearances, to DEPTH levels, replicas passed over."""
    out, seen = [], set()
    level = [category]
    for depth in range(DEPTH + 1):
        nxt = []
        for cat in level:
            files, subs = category_members(cat)
            for f in files:
                if f not in seen:
                    seen.add(f)
                    out.append((f, depth))
            head = cat_bare(category) + " "
            for s in subs:
                rest = cat_bare(s)[len(head):] if cat_bare(s).startswith(head) else None
                if (rest is not None and SUBCATEGORY.match(rest)
                        and not REPLICA.search(s)):
                    nxt.append(s)
        level = sorted(nxt)
    return out


def file_candidates(found, full, names, others=()):
    """The files of a category worth asking about, best first: raster, not
    named as a replica or as another chassis in `others`, naming the car
    before not, shallow before deep.

    `others` is [(chassis_id, full_name)] for the constructor's other
    chassis: the Coloni FC188's category holds "Coloni FC188B 2008
    Donington Park.jpg", and the FC188B is a chassis of its own. A sibling
    whose name this chassis's name contains yields to it: "Talbot-Lago
    T26C-DA" names the T26C whole as well, and is the T26C-DA's alone."""
    def sibling(f):
        own = names_car(f, full, names, whole=True)
        return any(names_car(f, o_full, o_id, whole=True)
                   and not (own and norm(o_full) != norm(full)
                            and norm(o_full) in norm(full))
                   for o_id, o_full in others)
    keep = [(f, d) for f, d in found
            if f.lower().endswith(RASTER) and not REPLICA.search(f)
            and not sibling(f)]
    keep.sort(key=lambda fd: (not names_car(fd[0], full, names), fd[1], fd[0]))
    return [f for f, _d in keep[:PER_CHASSIS]]


def main_category(args):
    chassis, cons, every = read_bare_chassis()
    # A constructor's other chassis. One whose name is only the constructor's
    # ("Kurtis Kraft") names no particular car and is left out.
    siblings = {}
    for cid, k, _n, full in every:
        if norm(full) != norm(cons.get(k, ("",))[0]):
            siblings.setdefault(k, []).append((cid, full))
    if args.only:
        needle = args.only.lower()
        chassis = [c for c in chassis
                   if needle in c[0] or needle in c[3].lower()]
    if args.limit:
        chassis = chassis[:args.limit]
    if not chassis:
        raise SystemExit("no chassis selected")
    print(f"{len(chassis)} chassis without an article", flush=True)

    log = []
    proposed = {}                  # chassis id -> [(tail, title)]
    for n, (cid, k, name, full) in enumerate(chassis, 1):
        if n % 50 == 0:
            print(f"  searched {n}/{len(chassis)}", flush=True)
        names = cons.get(k, (k, k))
        titles = exact_titles(full, name, names[0]) + search_categories(full)
        forms = {}                 # insertion order: exact titles, then search
        for t in titles:
            tail = category_tail(t, full, name, names)
            if tail is not None and t not in forms:
                forms[t] = tail
        if not forms:
            log.append(f"{cid}\tREFUSED\tno category is named for {full}")
            continue
        order = list(forms)
        proposed[cid] = sorted(((tail, t) for t, tail in forms.items()),
                               key=lambda x: (len(x[0]) > 0, order.index(x[1])))

    parents = category_parents({t for v in proposed.values() for _x, t in v})
    accepted = {}                  # chassis id -> [title]
    for cid, forms in proposed.items():
        ok = []
        for _tail, t in forms:
            ps = parents.get(t)
            if ps is None:
                continue           # an exact title Commons does not hold
            if not any(F1_PARENT.search(p) for p in ps):
                log.append(f"{cid}\tREFUSED\t{t} is not filed as a "
                           f"Formula One car ({'; '.join(cat_bare(p) for p in ps) or 'no parents'})")
                continue
            ok.append(t)
        if ok:
            accepted[cid] = ok
        elif not any(line.startswith(cid + "\t") for line in log):
            log.append(f"{cid}\tREFUSED\tno category named for it exists")

    # Check c: a category two chassis resolve to names neither.
    owners = {}
    for cid, ts in accepted.items():
        for t in ts:
            owners.setdefault(t, set()).add(cid)
    for t, who in sorted(owners.items()):
        if len(who) > 1:
            for cid in sorted(who):
                accepted[cid].remove(t)
                log.append(f"{cid}\tREFUSED\t{t} is claimed by "
                           f"{', '.join(sorted(who))}")
    accepted = {c: ts for c, ts in accepted.items() if ts}

    by_id = {c[0]: c for c in chassis}
    wanted, plan = set(), {}
    for n, cid in enumerate(sorted(accepted), 1):
        if n % 10 == 0:
            print(f"  walked {n}/{len(accepted)} categories' chassis",
                  flush=True)
        _c, _k, _name, full = by_id[cid]
        plan[cid] = [(t, walk(t)) for t in accepted[cid]]

    # A file two chassis's categories both hold - the VW2 photograph filed
    # under the VW55 as well - says which car it is to neither of them.
    holders = {}
    for cid, cats in plan.items():
        for _t, found in cats:
            for f, _d in found:
                holders.setdefault(f, set()).add(cid)
    for cid in sorted(plan):
        full = by_id[cid][3]
        others = [s for s in siblings.get(by_id[cid][1], ()) if s[0] != cid]
        cats = []
        for t, found in plan[cid]:
            found = [(f, d) for f, d in found if len(holders[f]) == 1]
            files = file_candidates(found, full, f"{cid}+{cat_bare(t)}",
                                    others)
            cats.append((t, files))
            wanted.update(files)
        plan[cid] = cats
    info = file_info(sorted(wanted), log, endpoint=COMMONS_API)

    rows = []
    for cid in sorted(plan):
        full = by_id[cid][3]
        tried, row = [], None
        for t, files in plan[cid]:
            for f in files:
                row = admit(full, f, info.get(title_key(f)),
                            f"{cid}+{cat_bare(t)}", tried, route="category")
                if row:
                    row["chassis_id"], row["category"] = cid, t
                    break
            if row:
                break
        if row:
            rows.append(row)
        elif tried:
            log.extend(f"{cid}\t" + line.split("\t", 1)[1] for line in tried)
        else:
            log.append(f"{cid}\tREFUSED\t{', '.join(t for t, _f in plan[cid])}"
                       f" holds no photograph that is not a replica, a part or another chassis's")
    check_thumbs(rows, log, "chassis_id")

    out = os.path.join(HARVEST, "category_images.txt")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("# Generated by tools/wikimedia_images.py --route category on "
                 + time.strftime("%Y-%m-%d") + ". Do not edit by hand.\n")
        fh.write("# Source: a Wikimedia Commons category named for each "
                 "chassis no article describes, via the Commons API.\n")
        fh.write("# The claim is only that Commons editors filed the file "
                 "there; the build holds these rows at 'catalogued'.\n")
        fh.write("# Each file carries its OWN licence. No image is stored "
                 "here or in the database.\n")
        fh.write("# " + "|".join(CAT_COLUMNS) + "\n")
        for r in rows:
            fh.write("|".join("" if r[c] is None else str(r[c])
                              for c in CAT_COLUMNS) + "\n")

    with open(os.path.join(HARVEST, "category_images.log"), "w",
              encoding="utf-8") as fh:
        fh.write("# Every chassis without an article, and why it was "
                 "refused.\n")
        for line in sorted(log):
            fh.write(line + "\n")
        for r in rows:
            fh.write(f"{r['chassis_id']}\tACCEPTED\t{r['category']}\t"
                     f"{r['file_name']}\t{r['licence']}\n")

    named = sum(r["name_matches"] for r in rows)
    print(f"\naccepted {len(rows)} of {len(chassis)} chassis")
    print(f"refused  {len(chassis) - len(rows)}  "
          f"(see harvest/category_images.log)")
    print(f"file name names the car: {named} of {len(rows)}")
    print(f"wrote {out}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--limit", type=int, default=0,
                    help="only the first N articles, for a trial run")
    ap.add_argument("--only", default=None,
                    help="only articles containing this substring")
    ap.add_argument("--route", choices=("article", "category"),
                    default="article",
                    help="article (the default), or a Commons category for "
                         "each chassis with no article")
    ap.add_argument("--thumbs", action="store_true",
                    help="refresh thumb_url in both committed files and "
                         "nothing else")
    args = ap.parse_args()
    if args.thumbs:
        return main_thumbs()
    if args.route == "category":
        return main_category(args)

    articles = read_articles()
    if args.only:
        needle = args.only.lower()
        articles = [a for a in articles if needle in a[0].lower()]
    if args.limit:
        articles = articles[:args.limit]
    if not articles:
        raise SystemExit("no articles selected")

    chassis_for = dict(articles)
    titles = sorted(chassis_for)
    print(f"{len(titles)} articles", flush=True)

    log = []
    leads, bare = lead_images(titles, log)
    print(f"{len(leads)} have a lead image", flush=True)

    body = {}
    if bare:
        found = body_images(bare)
        body = {a: body_candidates(found.get(a, ()), a, chassis_for.get(a))
                for a in bare}
    print(f"{sum(1 for v in body.values() if v)} of {len(bare)} without one "
          f"carry a body image that names the car", flush=True)

    wanted = set(leads.values()) | {f for v in body.values() for f in v}
    info = file_info(sorted(wanted), log)

    rows, via_body = [], set()
    for article in titles:
        f = leads.get(article)
        if f:
            row = admit(article, f, info.get(title_key(f)),
                        chassis_for.get(article), log)
            if row:
                rows.append(row)
            continue
        if article not in body:
            continue           # already logged by lead_images
        if not body[article]:
            log.append(f"{article}\tREFUSED\tarticle has no lead image, and "
                       f"no image in its body names the car")
            continue
        # The first candidate that passes every check. The refusals of the
        # ones before it are kept only if none passes.
        tried = []
        for f in body[article]:
            row = admit(article, f, info.get(title_key(f)),
                        chassis_for.get(article), tried)
            if row:
                rows.append(row)
                via_body.add(article)
                break
        else:
            log.extend(line + " (body image)" for line in tried)
    check_thumbs(rows, log, "article")

    out = os.path.join(HARVEST, "article_images.txt")
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("# Generated by tools/wikimedia_images.py on "
                 + time.strftime("%Y-%m-%d") + ". Do not edit by hand.\n")
        fh.write("# Source: the lead image of each accepted car article, or "
                 "a body image that names the car, via the MediaWiki API.\n")
        fh.write("# Files are on Wikimedia Commons and each carries its OWN "
                 "licence - see the licence column.\n")
        fh.write("# No image is stored here or in the database. These are "
                 "references and their attribution.\n")
        fh.write("# " + "|".join(COLUMNS) + "\n")
        for r in rows:
            fh.write("|".join("" if r[c] is None else str(r[c])
                              for c in COLUMNS) + "\n")

    with open(os.path.join(HARVEST, "article_images.log"), "w",
              encoding="utf-8") as fh:
        fh.write("# Every article considered, and why it was refused.\n")
        for line in sorted(log):
            fh.write(line + "\n")
        for r in rows:
            where = "body image" if r["article"] in via_body else "lead image"
            fh.write(f"{r['article']}\tACCEPTED\t{r['file_name']}\t"
                     f"{r['licence']}\t{where}\n")

    named = sum(r["name_matches"] for r in rows)
    print(f"\naccepted {len(rows)} of {len(titles)} articles, "
          f"{len(via_body)} of them from the body")
    print(f"refused  {len(log)}  (see harvest/article_images.log)")
    print(f"file name mentions the car: {named} of {len(rows)} "
          f"- recorded, not enforced")
    print(f"wrote {out}")


THUMBS_NOTE = "# thumb_url last fetched by tools/wikimedia_images.py --thumbs on "


def main_thumbs():
    """Refill thumb_url in both committed files, and change nothing else.

    Each file is read by its column header, the way data/harvest.py reads it,
    and written back line for line: the rows, their order and their credits
    are the dated run's. Only the column and a dated note in the header move.
    """
    for name, key, columns, endpoint in (
            ("article_images.txt", "article", COLUMNS, API),
            ("category_images.txt", "chassis_id", CAT_COLUMNS, COMMONS_API)):
        path = os.path.join(HARVEST, name)
        with open(path, encoding="utf-8") as fh:
            lines = fh.read().splitlines()
        notes = [ln for ln in lines if ln.startswith("#") and "|" not in ln
                 and not ln.startswith(THUMBS_NOTE)]
        header = [ln for ln in lines if ln.startswith("#") and "|" in ln]
        if len(header) != 1:
            raise SystemExit(f"{name}: expected one column header, "
                             f"found {len(header)}")
        cols = header[0].lstrip("# ").split("|")
        missing = [c for c in columns if c not in cols and c != "thumb_url"]
        if missing:
            raise SystemExit(f"{name}: no column {', '.join(missing)}")
        rows = []
        for ln in lines:
            if not ln.strip() or ln.startswith("#"):
                continue
            parts = ln.split("|")
            if len(parts) != len(cols):
                raise SystemExit(f"{name}: {len(parts)} fields where the "
                                 f"header names {len(cols)}: {ln[:60]}")
            rows.append(dict(zip(cols, parts)))
        print(f"{name}: {len(rows)} rows", flush=True)
        info = file_info(sorted({r["file_name"] for r in rows}), [],
                         endpoint=endpoint)
        for r in rows:
            r["thumb_url"] = (info.get(title_key(r["file_name"])) or {}
                              ).get("thumb_url")
        log = []
        check_thumbs(rows, log, key)
        for line in log:
            print("  " + line.replace("\t", "  "))
        with open(path, "w", encoding="utf-8") as fh:
            for ln in notes:
                fh.write(ln + "\n")
            fh.write(THUMBS_NOTE + time.strftime("%Y-%m-%d")
                     + "; no file was chosen afresh.\n")
            fh.write("# " + "|".join(columns) + "\n")
            for r in rows:
                fh.write("|".join(r.get(c) or "" for c in columns) + "\n")
        print(f"wrote {path}")


if __name__ == "__main__":
    main()
