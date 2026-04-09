#!/usr/bin/env python3
"""
First-pass voter modeling from VR + VH only (Arkansas wide CSVs).

Outputs per-voter:
  - partisan_score_1_10: 1 = Republican-leaning, 10 = Democratic-leaning
  - dem_likelihood_0_1: aligned propensity (derived from the same partisan axis)
  - turnout_likelihood_0_1: recent general-election participation (weighted)
  - libertarian_high_prob: registration or primary-history libertarian signal
  - component fields for transparency

Usage:
  python scripts/voter_score_pass1.py --vr data/vr.csv --vh data/vh.csv -o data/out/voter_scores_pass1.csv
  python scripts/voter_score_pass1.py --limit 5000 -o data/out/sample.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple


def _norm_cell(s: Optional[str]) -> str:
    if s is None:
        return ""
    return str(s).strip()


def _party_letter(cell: str) -> Optional[str]:
    """First letter of party code (R, D, L, G, O, ...)."""
    t = _norm_cell(cell).upper()
    if not t:
        return None
    return t[0]


@dataclass(frozen=True)
class VrRow:
    party: str  # raw CDE_PARTY
    status: str  # CDE_REGISTRANT_STATUS


def load_vr(path: str, limit: Optional[int]) -> Dict[str, VrRow]:
    out: Dict[str, VrRow] = {}
    with open(path, newline="", encoding="utf-8", errors="replace") as f:
        r = csv.DictReader(f)
        for i, row in enumerate(r):
            if limit is not None and i >= limit:
                break
            vid = _norm_cell(row.get("VoterID") or row.get("voter_id"))
            if not vid:
                continue
            out[vid] = VrRow(
                party=_norm_cell(row.get("CDE_PARTY") or row.get("party") or ""),
                status=_norm_cell(row.get("CDE_REGISTRANT_STATUS") or ""),
            )
    return out


def classify_vh_columns(header: Sequence[str]) -> Tuple[List[str], List[str]]:
    """Return (general_how_voted_cols, primary_party_voted_cols)."""
    general_how: List[str] = []
    primary_party: List[str] = []
    for c in header:
        if c.endswith("HowVoted"):
            if "General" in c and "Primary" not in c:
                general_how.append(c)
            continue
        if c.endswith("PartyVoted"):
            if "General" in c:
                continue
            primary_party.append(c)
    return general_how, primary_party


def registration_axis(party_raw: str) -> float:
    """
    Map registration to [-1, 1]: R=-1, D=+1, unknown/other=0.
    Libertarian/Green get neutral on the D/R axis (handled via libertarian flag separately).
    """
    letter = _party_letter(party_raw)
    if letter == "R":
        return -1.0
    if letter == "D":
        return 1.0
    if letter in ("L", "G", "O") or party_raw.upper() == "NP":
        return 0.0
    return 0.0


def primary_tally(row: Dict[str, str], primary_party_cols: Sequence[str]) -> Tuple[int, int, int]:
    d = r = l = 0
    for col in primary_party_cols:
        letter = _party_letter(row.get(col, ""))
        if letter == "D":
            d += 1
        elif letter == "R":
            r += 1
        elif letter == "L":
            l += 1
    return d, r, l


def general_turnout(
    row: Dict[str, str],
    general_how_cols: Sequence[str],
    weights: Sequence[float],
) -> Tuple[float, int, int]:
    """
    Weighted participation on listed general elections.
    Returns (score 0..1, voted_count, n_elections).
    """
    voted = 0
    n = len(general_how_cols)
    if n == 0:
        return 0.0, 0, 0
    wsum = sum(weights[:n]) if len(weights) >= n else float(n)
    acc = 0.0
    for i, col in enumerate(general_how_cols):
        w = weights[i] if i < len(weights) else 1.0
        if _norm_cell(row.get(col, "")):
            voted += 1
            acc += w
    return (acc / wsum) if wsum > 0 else 0.0, voted, n


def combine_partisan(reg_axis: float, d: int, r: int, l: int) -> float:
    """
    Return combined partisan axis in [-1, 1].
    Primary D/R history dominates when present; registration fills in otherwise.
    (Libertarian primary votes do not move the D/R axis; see libertarian_flag.)
    """
    denom = d + r
    if denom > 0:
        hist = (d - r) / float(denom)
        return max(-1.0, min(1.0, 0.45 * reg_axis + 0.55 * hist))
    return max(-1.0, min(1.0, reg_axis))


def axis_to_1_10(axis: float) -> int:
    """Map [-1, 1] to 1..10 inclusive."""
    t = (axis + 1.0) / 2.0
    x = 1 + int(round(9 * t))
    return max(1, min(10, x))


def libertarian_flag(party_raw: str, d: int, r: int, l: int) -> bool:
    letter = _party_letter(party_raw)
    if letter == "L":
        return True
    total = d + r + l
    if l >= 2:
        return True
    if total == 0:
        return False
    if l >= 1 and d == 0 and r == 0:
        return True
    if l >= max(d, r) and l >= 1:
        return True
    return False


def status_turnout_mult(status: str) -> float:
    s = status.upper()
    if s == "A":
        return 1.0
    if s == "I":
        return 0.45
    return 0.55


def process(
    vr_path: str,
    vh_path: str,
    out_path: str,
    vr_limit: Optional[int],
    vh_limit: Optional[int],
) -> None:
    vr = load_vr(vr_path, vr_limit)
    os.makedirs(os.path.dirname(os.path.abspath(out_path)) or ".", exist_ok=True)

    with open(vh_path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.DictReader(f)
        header = reader.fieldnames
        if not header:
            raise SystemExit("VH file has no header")
        general_how, primary_party = classify_vh_columns(header)

        # Prefer recent generals; reorder by year when the column name contains a year.
        def year_key(col: str) -> int:
            m = re.search(r"(20\d{2})", col)
            if m:
                return int(m.group(1))
            if "SPSN16" in col:
                return 2016
            if "2014" in col:
                return 2014
            return 0

        general_how_sorted = sorted(general_how, key=year_key)
        # Weights: emphasize 2020, 2022, 2024 if present
        year_w: Dict[str, float] = {}
        for c in general_how_sorted:
            y = year_key(c)
            if y >= 2024:
                year_w[c] = 1.0
            elif y >= 2022:
                year_w[c] = 0.95
            elif y >= 2020:
                year_w[c] = 0.9
            elif y >= 2018:
                year_w[c] = 0.65
            elif y >= 2016:
                year_w[c] = 0.5
            else:
                year_w[c] = 0.35
        weights = [year_w[c] for c in general_how_sorted]

        fieldnames = [
            "VoterID",
            "CDE_PARTY",
            "CDE_REGISTRANT_STATUS",
            "partisan_score_1_10",
            "dem_likelihood_0_1",
            "turnout_likelihood_0_1",
            "libertarian_high_prob",
            "primary_d",
            "primary_r",
            "primary_l",
            "reg_axis",
            "history_axis",
            "generals_voted",
            "generals_count",
            "vh_only",
        ]

        n = 0
        with open(out_path, "w", newline="", encoding="utf-8") as outf:
            w = csv.DictWriter(outf, fieldnames=fieldnames)
            w.writeheader()
            for row in reader:
                if vh_limit is not None and n >= vh_limit:
                    break
                n += 1
                vid = _norm_cell(row.get("VoterID") or row.get("voter_id"))
                if not vid:
                    continue
                vr_row = vr.get(vid)
                party_raw = vr_row.party if vr_row else ""
                status = vr_row.status if vr_row else ""

                reg_axis = registration_axis(party_raw)
                d, r, l = primary_tally(row, primary_party)
                denom = d + r
                history_axis = (d - r) / float(denom) if denom > 0 else reg_axis
                axis = combine_partisan(reg_axis, d, r, l)
                p10 = axis_to_1_10(axis)
                dem_l = (axis + 1.0) / 2.0

                tscore, gv, gc = general_turnout(row, general_how_sorted, weights)
                tscore *= status_turnout_mult(status)

                lib = libertarian_flag(party_raw, d, r, l)

                w.writerow(
                    {
                        "VoterID": vid,
                        "CDE_PARTY": party_raw,
                        "CDE_REGISTRANT_STATUS": status,
                        "partisan_score_1_10": p10,
                        "dem_likelihood_0_1": f"{dem_l:.4f}",
                        "turnout_likelihood_0_1": f"{min(1.0, max(0.0, tscore)):.4f}",
                        "libertarian_high_prob": "1" if lib else "0",
                        "primary_d": d,
                        "primary_r": r,
                        "primary_l": l,
                        "reg_axis": f"{reg_axis:.4f}",
                        "history_axis": f"{history_axis:.4f}",
                        "generals_voted": gv,
                        "generals_count": gc,
                        "vh_only": "1" if vr_row is None else "0",
                    }
                )

    print(f"Wrote {n} rows to {out_path}")


def main() -> None:
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    default_vr = os.path.join(root, "data", "vr.csv")
    default_vh = os.path.join(root, "data", "vh.csv")
    default_out = os.path.join(root, "data", "out", "voter_scores_pass1.csv")

    ap = argparse.ArgumentParser(description="VR+VH first-pass voter scores (Python)")
    ap.add_argument("--vr", default=default_vr, help="Path to vr.csv")
    ap.add_argument("--vh", default=default_vh, help="Path to vh.csv")
    ap.add_argument("-o", "--output", default=default_out, help="Output CSV path")
    ap.add_argument("--vr-limit", type=int, default=None, help="Load at most N VR rows (testing)")
    ap.add_argument("--limit", type=int, default=None, help="Process at most N VH rows")
    args = ap.parse_args()

    if not os.path.isfile(args.vr):
        print(f"VR file not found: {args.vr}", file=sys.stderr)
        sys.exit(1)
    if not os.path.isfile(args.vh):
        print(f"VH file not found: {args.vh}", file=sys.stderr)
        sys.exit(1)

    process(args.vr, args.vh, args.output, args.vr_limit, args.limit)


if __name__ == "__main__":
    main()
