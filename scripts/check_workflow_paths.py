#!/usr/bin/env python
"""Every path a workflow names must exist.

    uv run python scripts/check_workflow_paths.py

A `pytest` invocation pointing at a file that has moved does not fail loudly. It prints "no tests
ran" and exits 4, which reads as a red X in a list of red Xs and says nothing about the cause. The
job looks like it is running a suite. It is running nothing.

That is what happened to `tests/test_reference_suites.py`: it moved out of `packages/cli/tests/`
when the domain examples were separated from the platform, CI kept the old path, and the reference
suites — the ten end-to-end suites that are the product's own evidence it works — stopped being
exercised on every push. Nobody noticed, because the job had been failing for other reasons too.

The check is deliberately dumb: scan the workflow files for anything that looks like a repository
path, and assert it exists. A dumb check that runs is worth more than a clever one that needs
maintaining, and the failure mode it guards is exactly "someone moved a file".
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORKFLOWS = ROOT / ".github" / "workflows"

#: Top-level directories that are ours. Anything starting with one of these and looking like a path
#: is a repository path; anything else is a container image, a URL, or an action reference.
OWNED = ("packages/", "apps/", "tests/", "scripts/", "infra/", "docs/")

PATH_PATTERN = re.compile(r"(?:" + "|".join(OWNED) + r")[A-Za-z0-9_./-]+")

#: Paths that are created *by* a workflow rather than committed, so they are legitimately absent.
#: Listed explicitly, because the alternative — skipping anything that does not exist — would defeat
#: the whole check.
GENERATED = {
    "tests/load/results",
}


#: `uses: ./path` — a local composite action. Caught separately from the prefixes above because it
#: has no `packages/`-style prefix to match on, which is exactly how one got missed: the repository
#: rename left `.github/actions/evalforge` in place while every reference pointed at
#: `.github/actions/proofstep`. The workflow that used it happened to be PR-only in a repository
#: with no PRs, so it never ran and never reported the broken path.
LOCAL_ACTION_PATTERN = re.compile(r"uses:\s*\./([A-Za-z0-9_./-]+)")


def local_action_targets(text: str) -> set[str]:
    """A local action resolves to a directory holding action.yml or action.yaml."""
    return set(LOCAL_ACTION_PATTERN.findall(text))


def main() -> int:
    missing: list[tuple[str, str]] = []
    for workflow in sorted(WORKFLOWS.glob("*.yml")):
        text = workflow.read_text()
        for target in sorted(local_action_targets(text)):
            directory = ROOT / target
            if not (directory / "action.yml").exists() and not (directory / "action.yaml").exists():
                missing.append((workflow.name, f"{target}/ (no action.yml)"))
        for match in sorted(set(PATH_PATTERN.findall(text))):
            # Trailing punctuation from shell quoting or YAML.
            candidate = match.rstrip(".,'\"")
            if candidate in GENERATED:
                continue
            if not (ROOT / candidate).exists():
                missing.append((workflow.name, candidate))

    if missing:
        print("workflow paths that do not exist:\n", file=sys.stderr)
        for workflow, candidate in missing:
            print(f"  {workflow}: {candidate}", file=sys.stderr)
        print(
            "\nBoth failures are quiet ones. A moved test file leaves pytest exiting 4 with "
            '"no tests ran" — a red X with no cause. A missing action directory fails the job '
            'with "action not found", and only when that workflow actually runs, which may be '
            "never.",
            file=sys.stderr,
        )
        return 1

    print("✓ every path named in a workflow exists")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
