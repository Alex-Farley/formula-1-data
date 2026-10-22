# The repository's settings on GitHub

What GitHub shows about this repository that nothing in the repository sets:
its description, website and topics. They are kept here so that the next
person to change them starts from the wording on the record. The rest of
what this file once held — unpacking a v2.6 archive, choosing a licence,
creating the remote — described a setup that has long since been done, and
went with SD-17.

## Description

> Formula One since 1950 as one SQLite database: every championship race,
> entry, qualifying session and standings table, cross-checked against
> independent sources on every build, with every disagreement on the record.
> Browse it at lapledger.org.

It names the first season and no last one, on purpose. Nothing rebuilds the
description, so an end year in it goes stale the day a season is added: it
read 1950–2026 here and on GitHub after the database, the site and the README
had all moved to 1950–2027 (SD-12). Those three are derived from the season
register on every build — `meta.coverage_seasons`, which `verify.py` holds to
it, is the database's own statement of the span. Set the description with
`gh repo edit --description "..."`.

## Website and topics

Website: `https://lapledger.org`.

Topics: `formula1`, `f1`, `motorsport`, `sqlite`, `dataset`, `open-data`,
`sports-data`.
