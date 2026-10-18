# Deploying the API to Railway

The service does not build from source. Its source is a **published image**:

    ghcr.io/ilakhan17/proofstep/api:sha-<commit>

So a deploy is not a build — it is pointing the service at a newer tag. `.github/workflows/images.yml`
publishes one per commit to `main`, after the same Dockerfile has been built for amd64 and arm64 and
smoke-tested. Production therefore runs the exact artefact CI exercised, rather than a second one
assembled from the same source by a different tool.

## What not to do

`railway up` uploads the working directory and asks Railway to build it. That is the wrong tool
here, and it fails anyway: Railway's automatic builder detects Python and uv, then gives up —

    ↳ Detected Python
    ↳ Using uv
    ✖ No start command detected.

It is right to give up. This is a uv *workspace*: the root holds no application, no `main.py`, and
no `app.py`. The API lives at `apps/api/src/proofstep_api/main.py` beside four sibling packages, and
there is nothing at the root for a heuristic to start. Setting `build.builder` in `railway.json`
does not help either — with an image source there is no build step for it to configure.

## Deploying

Point the service at the tag for the commit you want and redeploy. The image must exist first, which
means `images.yml` must have finished for that commit:

    docker manifest inspect ghcr.io/ilakhan17/proofstep/api:sha-$(git rev-parse HEAD)

## Why the API fell a month behind

The last deploy before 2026-10-18 was 2026-09-17. This service is not connected to the repository,
so pushing does not deploy it, while the dashboard on Vercel deploys on every push. The two drifted
for a month, and nothing reported it: Railway keeps serving the last good deployment, so a failed
deploy looks like silence rather than an outage.

Worth fixing properly — either connect the service to GitHub, or have `images.yml` update the tag
once it has published. Until then, a deploy is a manual step that someone has to remember.

## The pre-deploy command

    /usr/local/bin/entrypoint.sh migrate

The full path rather than bare `migrate`, so it works whether or not Railway applies the image's
ENTRYPOINT: if it does, the entrypoint's `*) exec "$@"` branch runs it; if it does not, it is an
executable path. One spelling covers both.

Migrations run as the owning role through `MIGRATION_DATABASE_URL`, which this service sets. The
application itself connects as the unprivileged role and cannot reshape the schema — `docs/HARDENING.md`
explains why that separation carries weight.
