# -*- coding: utf-8 -*-
"""
Harvest the photograph of every car article already accepted into this
database, with the attribution needed to display it.

    python3 tools/wikimedia_images.py               # full run, ~26 requests
    python3 tools/wikimedia_images.py --limit 100   # a sample, for a trial

Reads:   harvest/car_specs.txt      the articles the spec harvest accepted
Writes:  harvest/article_images.txt the accepted rows
         harvest/article_images.log every article, and why it was refused

No image is downloaded and none is stored. What is stored is a *reference*
and its attribution: which file an article leads with, who took it, and
under what licence. The pixels are fetched from upload.wikimedia.org by
whatever renders the page, under Wikimedia's terms, and this repository
redistributes nothing.

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
article title or a chassis id, not cutting into a run of digits, so
"Brabham BT46 Lauda.jpg" does not name the BT4. A
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

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HARVEST = os.path.join(ROOT, "harvest")

API = "https://en.wikipedia.org/w/api.php"
UA = ("formula-1-data/2.14 (https://github.com/Alex-Farley/formula-1-data; "
      "article lead-image attribution harvest)")

# Batch size. The API caps titles at 50 for an unauthenticated client and
# silently truncates past it, so this is a limit, not a tuning knob.
BATCH = 50

# Pacing. The API rate-limits an anonymous client hard: a run at 0.4 s between
# batches returned 429 partway through and lost the pass. 1.5 s completes.
DELAY = 1.5

COLUMNS = ["article", "file_name", "repository", "licence", "licence_url",
           "artist", "credit", "description_url", "width", "height",
           "name_matches"]

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


def api(session_delay=DELAY, **params):
    """One API call, with the backoff a 429 actually needs."""
    params.setdefault("format", "json")
    params.setdefault("formatversion", "2")
    url = API + "?" + urllib.parse.urlencode(params)
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


def names_car(file_name, article, chassis_ids):
    """Does the file's own name name the car? Recorded as `name_matches`.

    A name matches where it does not cut into a run of digits at either
    end, so the BT4 is not named by "Brabham BT46", while "Ferrari553F1.jpg",
    "Brabham BT11A" and "2020 Formula One tests Barcelona, Alfa Romeo C39"
    still name theirs. `chassis_ids` is car_specs.txt's field, joined with
    "+" for a family article that several chassis share.
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
            if (not (at not in seps and fn[at - 1].isdigit()
                     and want[0].isdigit())
                    and not (end not in seps and fn[end].isdigit()
                             and want[-1].isdigit())):
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


def file_info(files, log):
    """'File:...' -> dict of repository, licence and attribution."""
    info = {}
    for n, batch in enumerate(batches(files), 1):
        print(f"  file metadata, batch {n}: {len(batch)} files", flush=True)
        d = api(action="query", prop="imageinfo",
                iiprop="url|size|extmetadata", iiurlwidth="800",
                titles="|".join(batch))
        for p in d.get("query", {}).get("pages", []) or []:
            name = title_key(p.get("title"))
            ii = (p.get("imageinfo") or [{}])[0]
            em = ii.get("extmetadata", {}) or {}
            get = lambda k: (em.get(k) or {}).get("value")
            info[name] = {
                "repository": p.get("imagerepository"),
                "licence": plain(get("LicenseShortName")),
                "licence_url": plain(get("LicenseUrl")),
                "artist": plain(get("Artist")),
                "credit": plain(get("Credit")),
                "description_url": ii.get("descriptionurl"),
                "attribution_required": (get("AttributionRequired") or ""),
                "width": ii.get("thumbwidth") or ii.get("width"),
                "height": ii.get("thumbheight") or ii.get("height"),
            }
    return info


def admit(article, file_name, meta, chassis_ids, log):
    """Apply the three checks. Returns a row, or None with a logged reason."""
    if meta is None:
        log.append(f"{article}\tREFUSED\tno metadata for {file_name}")
        return None

    # 1. Commons only. A local en.wiki file is local because it is non-free.
    if meta["repository"] != "shared":
        log.append(f"{article}\tREFUSED\t{file_name} is hosted "
                   f"{meta['repository']!r}, not on Commons")
        return None

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
        "repository": meta["repository"],
        "licence": meta["licence"],
        "licence_url": meta["licence_url"],
        "artist": meta["artist"],
        "credit": meta["credit"],
        "description_url": meta["description_url"],
        "width": meta["width"],
        "height": meta["height"],
        "name_matches": matches,
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--limit", type=int, default=0,
                    help="only the first N articles, for a trial run")
    ap.add_argument("--only", default=None,
                    help="only articles containing this substring")
    args = ap.parse_args()

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


if __name__ == "__main__":
    main()
