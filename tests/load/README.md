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

## Next steps

Once the pipelines are green, the plans grow towards the real read path of the editor: the
`local_stackmatheditor_get_config` web service (needs a seeded quiz with STACK questions and a
token) and a quiz attempt page with the editor injected.
