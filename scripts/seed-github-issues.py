#!/usr/bin/env python3
"""Create GitHub milestones, labels and issues from docs/DEVELOPMENT_PLAN.md.

Usage:
    python3 scripts/seed-github-issues.py --repo OWNER/REPO [--dry-run] [--only V1]

Requires the GitHub CLI (`gh auth login`). Idempotent: existing labels/milestones/issues
(matched by exact title) are skipped.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

PLAN = Path(__file__).resolve().parent.parent / "docs" / "DEVELOPMENT_PLAN.md"

VERSION_RE = re.compile(r"^## (V\d+) — (.+)$")
FEATURE_RE = re.compile(r"^### (F-\d+) · (.+)$")
META_RE = re.compile(
    r"^\*\*Size:\*\* (\S+) · \*\*Area:\*\* (\S+) · \*\*Depends on:\*\* (.+)$"
)
SIZE_COLORS = {"S": "c2e0c6", "M": "fef2c0", "L": "f9d0c4", "XL": "e99695"}


def parse_plan(text):
    features, versions = [], {}
    version = None
    current = None
    for line in text.splitlines():
        vm = VERSION_RE.match(line)
        if vm:
            version = vm.group(1)
            versions[version] = f"{version} {vm.group(2).strip()}"
            current = None
            continue
        fm = FEATURE_RE.match(line)
        if fm and version:
            current = {"id": fm.group(1), "title": fm.group(2).strip(),
                       "version": version, "lines": []}
            features.append(current)
            continue
        if line.startswith("## ") or line.startswith("### "):
            # section heading that is not a feature (e.g. "### M1 · Family", "## 11. ...")
            current = None
            if line.startswith("## ") and not VERSION_RE.match(line):
                version = None
            continue
        if current is not None:
            current["lines"].append(line)

    for f in features:
        meta = next((META_RE.match(l) for l in f["lines"] if META_RE.match(l)), None)
        if not meta:
            sys.exit(f"{f['id']}: missing or malformed **Size/Area/Depends on** line")
        f["size"], f["area"], deps = meta.groups()
        f["deps"] = [] if deps.strip() in ("—", "-") else [d.strip() for d in deps.split(",")]
        body = "\n".join(l for l in f["lines"] if not META_RE.match(l)).strip()
        body = re.sub(r"\n-{3,}\s*$", "", body).strip()
        f["body"] = body
    return versions, features


def validate(features):
    ids = {f["id"] for f in features}
    errors = []
    if len(ids) != len(features):
        errors.append("duplicate feature IDs")
    for f in features:
        for d in f["deps"]:
            if d not in ids:
                errors.append(f"{f['id']} depends on unknown {d}")
        if "Acceptance criteria" not in f["body"]:
            errors.append(f"{f['id']} has no acceptance criteria")
        if f["size"] not in SIZE_COLORS:
            errors.append(f"{f['id']} has invalid size {f['size']}")
    if errors:
        sys.exit("Plan validation failed:\n  " + "\n  ".join(errors))


def gh(*args, check=True):
    r = subprocess.run(["gh", *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        sys.exit(f"gh {' '.join(args)} failed:\n{r.stderr}")
    return r.stdout


def issue_body(f):
    deps = ", ".join(f["deps"]) or "none"
    return (
        f"**Feature:** {f['id']} · **Version:** {f['version']} · **Size:** {f['size']} · "
        f"**Area:** {f['area']}\n**Depends on:** {deps}\n\n{f['body']}\n\n---\n"
        "Follow `CLAUDE.md` and the Definition of Done in `docs/DEVELOPMENT_PLAN.md` §7."
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo", required=True)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", help="limit to one version, e.g. V1")
    a = ap.parse_args()

    versions, features = parse_plan(PLAN.read_text(encoding="utf-8"))
    validate(features)
    if a.only:
        features = [f for f in features if f["version"] == a.only]
        versions = {k: v for k, v in versions.items() if k == a.only}

    labels = {"type:feature": "1d76db"}
    for f in features:
        labels[f"version:{f['version'].lower()}"] = "5319e7"
        labels[f"size:{f['size']}"] = SIZE_COLORS[f["size"]]
        labels[f"area:{f['area']}"] = "bfdadc"

    if a.dry_run:
        print(f"Milestones ({len(versions)}):", *versions.values(), sep="\n  ")
        print(f"\nLabels ({len(labels)}):", ", ".join(sorted(labels)))
        print(f"\nIssues ({len(features)}):")
        for f in features:
            print(f"  [{versions[f['version']]}] {f['id']} · {f['title']}  "
                  f"(size:{f['size']}, area:{f['area']}, deps:{','.join(f['deps']) or '-'})")
        return

    for name, color in labels.items():
        gh("label", "create", name, "--color", color, "--repo", a.repo, "--force")

    existing_ms = {m["title"]: m["number"] for m in json.loads(
        gh("api", f"repos/{a.repo}/milestones?state=all&per_page=100"))}
    for title in versions.values():
        if title not in existing_ms:
            gh("api", f"repos/{a.repo}/milestones", "-f", f"title={title}")
            print("milestone created:", title)

    existing = {i["title"] for i in json.loads(gh(
        "issue", "list", "--repo", a.repo, "--state", "all", "--limit", "1000",
        "--json", "title"))}
    for f in features:
        title = f"{f['id']} · {f['title']}"
        if title in existing:
            print("skip (exists):", title)
            continue
        gh("issue", "create", "--repo", a.repo, "--title", title,
           "--body", issue_body(f), "--milestone", versions[f["version"]],
           "--label", ",".join(["type:feature", f"version:{f['version'].lower()}",
                                f"size:{f['size']}", f"area:{f['area']}"]))
        print("created:", title)


if __name__ == "__main__":
    main()
