# CD2 poll weighting framework (conceptual)

This document describes how **district-level poll outputs** should inform **county scoring** in Peoplebase without treating polls as county truth.

## Principles

1. **Districtwide benchmark only**  
   Head-to-head and ballot tests in `data/polls/ar_cd2/2025/` describe **AR-02 as a whole** for a given field window. They are **not** direct measurements of each county’s current vote share unless a poll explicitly publishes county-level tables (these PDFs do not provide that).

2. **Subgroup priors, not county facts**  
   Crosstab margins (e.g., by race, age band, urbanicity, party ID) define **relative** lean and **movability** of segments. Use them to set **priors** or **weights** in a model layer, not as substitutes for county election results, ACS demographics, or VR/VH facts.

3. **Not county-level truth**  
   Do **not** allocate district benchmarks to counties by a single implicit rule (e.g., uniform swing or raw demographic multiplication) without an explicit, documented allocation model. County scores should remain anchored to **observable** county data (election history, registration, turnout proxies, initiative signers).

## How poll insights can influence county scoring

- **Benchmark memo** (`benchmark_memo_2025-04-29.pdf`): use for **top-line** district mood (trial heats, approval, issue salience). Treat as a **prior on district competitiveness** and issue emphasis, then reconcile with county-level election trends in `cd2_county_master_v`.

- **Crosstabs** (`full_crosstabs_2025-04-24_to_2025-04-28.pdf`): use for **segment direction and gaps** (e.g., one candidate running stronger with Black voters than with white voters; urban vs rural; independents vs partisans). Encode these as **relative adjustments** to segment weights in analytics, not as literal county vote shares.

## Example hypotheses (illustrative — verify against PDFs)

These are **patterns often seen** in partisan surveys; each must be checked against the actual tables before use:

- **Black voters strongly favor Jones in crosstabs** → increases confidence that counties with **higher Black population share** (see `pct_black_population`) align with that segment prior; does **not** by itself set Jones’s county percentage.

- **Large-city voters favor Jones more than rural voters** → suggests **urbanicity / population density** as an effect modifier when interpreting county-level DEM trends; combine with ACS and geography, not poll margins alone.

- **Independents and moderates are more movable** → useful for **turnout and persuasion** scenarios; may down-weight counties where registration and history show rigid partisan bases unless VH/VR indicates different behavior.

- **Anti-incumbent sentiment matters** → can inform **issue salience and trial-heat interpretation** at the district level; translate to county scores only through an explicit incumbency or approval linkage, not by assumption.

## Integration sketch (no hard-coded coefficients)

1. Build county features from `cd2_county_master_v` (demographics, registration, turnout proxy, election trends, initiative signer rates).  
2. Load district benchmarks and crosstab segment margins from the PDFs (manually or via a future structured extract).  
3. Define a **small set of segment weights** (e.g., Black / white / Hispanic / urban / rural / ind / moderate) consistent with crosstabs **directionally**.  
4. Use those weights only to **adjust relative emphasis** among counties in a scenario or score — e.g., “if the district poll is right about segment gaps, which counties are more load-bearing for turnout or persuasion?”  
5. Reconcile so that **district aggregates implied by the county model** stay within a plausible band of the published benchmark (optional constraint), without overfitting sparse data.

## Out of scope (until supported)

- Parsing PDFs into the database (explicitly deferred).  
- Automated county-level poll estimates without an allocation model.  
- Treating subgroup margins as independent without design effects (use official methodology notes when available).
