import { Footer, Header, REPO } from "@/components/Chrome"
import { Snippet, Step, Warn } from "@/components/Doc"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Self-hosting Proofstep",
  description:
    "Run the whole stack on one host with Docker Compose, then send your first trace. Ten minutes, with the parts that go wrong called out.",
}

/**
 * The self-hosting guide.
 *
 * Written against what actually happens rather than the happy path: every step that has a way to
 * fail silently says how to tell. The row-level-security check in step 5 is the one that matters
 * most — it is the difference between tenant isolation being enforced and merely installed, and
 * nothing else in the system's behaviour reveals which you have.
 */
export default function Docs() {
  return (
    <>
      <Header />
      <main id="main" className="mx-auto max-w-5xl px-6 pt-16 pb-8">
        <h1 className="max-w-[30ch] text-[2.25rem] font-semibold leading-[1.1] tracking-[-0.02em]">
          Run Proofstep on your own machine
        </h1>
        <p className="mt-5 max-w-measure text-muted">
          One host, one compose file. About ten minutes, most of it waiting for images to pull. At
          the end you will have a dashboard, an API, and a trace in it that you sent.
        </p>

        <div className="mt-8 border border-rule bg-raised px-5 py-4">
          <p className="max-w-measure text-sm">
            <span className="font-medium">Before you start:</span> Docker and Docker Compose, and
            about 2&nbsp;GB of free memory. No Python, Node, or database setup — everything runs in
            containers.
          </p>
        </div>

        {/* ── The install ──────────────────────────────────────────────────────────── */}
        <div className="mt-12">
          <h2 className="text-xl font-semibold tracking-tight">Install</h2>

          <Step n={1} title="Get the repository">
            <p>
              The images come from a registry, but the compose file and the secret-generation script
              live in the repository.
            </p>
            <Snippet>{`git clone https://github.com/IlaKhan17/proofstep
cd proofstep`}</Snippet>
          </Step>

          <Step n={2} title="Generate secrets">
            <p>
              Writes four random secrets to <code className="font-mono text-sm">secrets/</code> at
              mode 600, and a <code className="font-mono text-sm">.env.prod</code> with the one
              value that has to appear in two places already filled in.
            </p>
            <Snippet>./scripts/init_secrets.sh</Snippet>
            <p className="text-sm">
              Files rather than environment variables, because an environment variable is readable
              from <code className="font-mono text-xs">/proc</code>, shows up in{" "}
              <code className="font-mono text-xs">docker inspect</code>, and lands in crash reports.
              It refuses to overwrite: regenerating the signing key would sign every existing
              session out.
            </p>
          </Step>

          <Step n={3} title="Pin a version">
            <p>
              Open <code className="font-mono text-sm">.env.prod</code> and set the image tag. Pin a
              real version rather than tracking a moving tag — otherwise a container restart can
              change the code with no deploy.
            </p>
            <Snippet label=".env.prod">{`PROOFSTEP_TAG=0.1.0
WEB_PORT=3000`}</Snippet>
          </Step>

          <Step n={4} title="Start it">
            <p>
              Postgres, Redis, object storage, the API, the worker, and the dashboard. Migrations
              run once in their own step before the API starts, as a separate service — three
              replicas racing the same schema change is a deadlock waiting for a slow morning.
            </p>
            <Snippet>docker compose -f docker-compose.prod.yml --env-file .env.prod up -d</Snippet>
            <p>
              The dashboard is on <code className="font-mono text-sm">http://localhost:3000</code>.
              Sign up and you land in a workspace with a project already made.
            </p>
          </Step>

          <Step n={5} title="Check that isolation is actually on">
            <p>
              This is the one check worth doing by hand, because nothing else in the system&rsquo;s
              behaviour reveals the answer.
            </p>
            <Snippet>{`docker compose -f docker-compose.prod.yml --env-file .env.prod \\
  exec api python -c "import urllib.request;print(urllib.request.urlopen('http://127.0.0.1:8000/readyz').read().decode())"`}</Snippet>
            <Snippet label="what you want to see">
              {`{"status":"ready","checks":{"database":"ok",
 "row_level_security":"enforced (26/26 tables)"}}`}
            </Snippet>
            <Warn title="If it says not_enforced, stop and fix it">
              Every row-level-security policy in the database exists and does nothing. Postgres
              exempts superusers and owners from policies unconditionally, so the application must
              connect as a role that is neither. The compose stack provisions one for you; if this
              reports otherwise, the application is connecting as the wrong role and tenant data is
              separated by application code alone.
            </Warn>
          </Step>

          <Step n={6} title="Prove the whole path works">
            <p>
              Signs up, mints a key, sends a trace, reads it back. Four requests that between them
              cross the dashboard&rsquo;s proxy, the API&rsquo;s auth, the unprivileged database
              role, ingestion, object storage, and every policy on the way through.
            </p>
            <Snippet>./scripts/smoke_stack.sh http://127.0.0.1:3000</Snippet>
          </Step>
        </div>

        {/* ── First trace ──────────────────────────────────────────────────────────── */}
        <div className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight">Send your first trace</h2>
          <p className="mt-3 max-w-measure text-muted">
            In the dashboard: <span className="text-ink">Settings → API keys → Create</span>, with
            the <code className="font-mono text-sm">ingest</code> and{" "}
            <code className="font-mono text-sm">read</code> scopes. The token is shown once.
          </p>

          <Snippet label="install">pip install proofstep</Snippet>

          <Snippet label="instrument">
            {`import proofstep

proofstep.init(
    endpoint="http://127.0.0.1:8000",
    api_key="ps_prod_...",
    environment="production",
)

async def handle(prospect_id: str) -> dict:
    with proofstep.capture("outbound") as captured:
        # State a policy can read. A rule cannot check what the trace does not carry.
        proofstep.set_state(unsubscribed=False)

        with proofstep.start_span("draft", span_type="llm") as span:
            span.set_output({"subject": "..."})

        with proofstep.start_span("gmail.send", span_type="tool",
                                  tool_name="gmail.send") as span:
            span.set_args({"to": "buyer@example.com"})

    return {"trace": captured[0].trace_id}`}
          </Snippet>

          <div className="mt-6 max-w-measure space-y-4 text-muted">
            <p>
              <span className="text-ink">Arguments are not decoration.</span> Trajectory policies
              match on <code className="font-mono text-sm">args.*</code>, so a tool call whose
              arguments never reach the trace cannot be audited — the rule has nothing to read.
            </p>
            <p>
              <span className="text-ink">Credentials never leave your process.</span> Access tokens,
              refresh tokens, API keys, passwords, session cookies, and{" "}
              <code className="font-mono text-sm">Authorization</code> headers are stripped in the
              SDK before export, and the server scrubs again as a backstop.
            </p>
            <p>
              <span className="text-ink">Already on OpenTelemetry?</span> Point your OTLP exporter
              at <code className="font-mono text-sm">/v1/otlp/v1/traces</code> and keep the
              instrumentation you have.
            </p>
          </div>
        </div>

        {/* ── Going public ─────────────────────────────────────────────────────────── */}
        <div className="mt-16">
          <h2 className="text-xl font-semibold tracking-tight">Putting it on a domain</h2>
          <p className="mt-3 max-w-measure text-muted">
            An overlay adds Caddy in front and gets certificates that renew themselves. Two
            hostnames, not one — a browser reaching the dashboard carries a session cookie and an
            SDK reaching the API carries a key, and serving both from one origin means the browser
            attaches that cookie to requests it has no business authenticating.
          </p>

          <Snippet label=".env.prod">
            {`PROOFSTEP_DOMAIN=proofstep.example.com
PROOFSTEP_API_DOMAIN=api.proofstep.example.com
ACME_EMAIL=you@example.com
DASHBOARD_URL=https://proofstep.example.com
CORS_ORIGINS=https://proofstep.example.com
FORWARDED_ALLOW_IPS=172.16.0.0/12`}
          </Snippet>
          <Snippet>
            {`docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml \\
  --env-file .env.prod up -d`}
          </Snippet>

          <Warn title="Port 80 has to be open before you start">
            It carries the certificate challenge, so a host that blocks it never gets a certificate
            and never comes up at all — which looks like a total outage rather than a TLS problem.
            Failed requests are rate-limited to five per hostname per week, so point DNS at the host
            and confirm it resolves first.
          </Warn>
        </div>

        {/* ── Further ──────────────────────────────────────────────────────────────── */}
        <div className="mt-16 border-t border-rule pt-10">
          <h2 className="text-xl font-semibold tracking-tight">Then what</h2>
          <ul className="mt-5 max-w-measure space-y-3">
            {[
              [
                "QUICKSTART.md",
                "A suite, a policy, and a failing CI gate, in fifteen minutes.",
                "docs/QUICKSTART.md",
              ],
              [
                "SDK_AND_CLI.md",
                "The public API, the suite YAML reference, and the GitHub Action.",
                "docs/SDK_AND_CLI.md",
              ],
              [
                "DEPLOYING.md",
                "Kubernetes manifests, and the checks that belong before production.",
                "docs/DEPLOYING.md",
              ],
              [
                "OPERATIONS.md",
                "Roles, secret rotation, backups, email, and the spend ceiling.",
                "docs/OPERATIONS.md",
              ],
              ["HARDENING.md", "What is deliberately not done, and why.", "docs/HARDENING.md"],
            ].map(([name, blurb, path]) => (
              <li key={name} className="border-l-2 border-rule pl-4">
                <a
                  href={`${REPO}/blob/main/${path}`}
                  className="font-mono text-sm text-signal underline underline-offset-2"
                >
                  {name}
                </a>
                <p className="text-muted">{blurb}</p>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <Footer />
    </>
  )
}
