# local_stackmatheditor — load tests (k6 and JMeter)

Smoke level for now: a handful of virtual users request the login page and the plugin's shipped
AMD module (`/lib/requirejs.php/-1/local_stackmatheditor/tex2max.js`, which serves exactly
`amd/build/tex2max.min.js`). Both plans are twins and assert the same things.

| File | Purpose |
|---|---|
| `stackmatheditor-smoke.js` | k6 plan; failed checks or thresholds make k6 exit non-zero |
| `stackmatheditor-smoke.jmx` | JMeter plan (properties `base_url`, `threads`, `rampup`, `loops`) |
| `check_jtl.py` | evaluates the JMeter result file — JMeter itself exits 0 even when every assertion failed |

## Run locally

```bash
make k6                                      # BASE_URL defaults to $CFG->wwwroot
make k6 BASE_URL=http://127.0.0.1:8000 VUS=10 DURATION=30s
make jmeter                                  # downloads JMeter 5.6.3 on first run (Java required)
make jmeter THREADS=10 LOOPS=20
```

The JMeter HTML dashboard ends up in `tests/load/jmeter-report/index.html`.

## Attempt load (k6 and JMeter twins)

`stackmatheditor-attempt.js` / `stackmatheditor-attempt.jmx`: every virtual user logs in as its
own seeded student (`sme_student01` …), starts or continues an attempt at "SME Load Quiz" (ten
STACK questions on one page) and then repeatedly loads the attempt page and calls
`local_stackmatheditor_get_config`. Data: `tests/playwright/seed.php` (idempotent, disposable test
sites only).

```bash
make k6-attempt LOAD_VUS=10 LOAD_DURATION=60
make jmeter-attempt LOAD_VUS=10 LOAD_DURATION=60
```

Thresholds (k6): checks > 99 %, failed requests < 1 %, attempt page p95 < 8 s, get_config
p95 < 1.5 s.
