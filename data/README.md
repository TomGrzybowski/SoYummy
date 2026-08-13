# Source data

These files are byte-for-byte copies of the input delivered in
`F:/Projekty/SoYummy/data_So_yammy`. The original folder is intentionally never modified.

Expected import totals:

- 14 categories
- 574 ingredients
- 285 recipes

`pnpm db:seed` validates these totals and upserts records, so rerunning it is safe.
