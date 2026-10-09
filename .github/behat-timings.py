#!/usr/bin/env python3
"""Turn the Behat timing records into JSON, CSV and a Markdown summary (#96, part A).

    python3 .github/behat-timings.py <records.jsonl> <output directory> [--top=10]

behat_local_stackmatheditor.php appends one JSON line per scenario to the file named by
SME_BEHAT_TIMINGS. This script writes, into the output directory:

    behat-timings.json  every scenario, plus the totals per feature and for the suite
    behat-timings.csv   one row per scenario: feature, scenario, line, start, duration, result
    behat-timings.md    totals per feature (slowest first) and the N slowest scenarios

and prints the Markdown to stdout, for the job summary. A missing or empty records file is an
error: a Behat run that recorded nothing is not a measured run.
"""

import csv
import json
import os
import sys


def main(argv):
    """Read the records and write the reports."""
    if len(argv) < 3:
        print(__doc__)
        return 2
    source, target = argv[1], argv[2]
    top = 10
    for arg in argv[3:]:
        if arg.startswith('--top='):
            top = int(arg.split('=', 1)[1])

    records = []
    if os.path.isfile(source):
        with open(source, encoding='utf-8') as handle:
            records = [json.loads(line) for line in handle if line.strip()]
    if not records:
        print(f'No Behat timing records in {source}.', file=sys.stderr)
        return 1

    features = {}
    for record in records:
        entry = features.setdefault(record['feature'], {'feature': record['feature'], 'scenarios': 0,
                                                        'duration': 0.0, 'failed': 0})
        entry['scenarios'] += 1
        entry['duration'] = round(entry['duration'] + float(record['duration']), 3)
        entry['failed'] += 0 if record['result'] == 'passed' else 1
    byfeature = sorted(features.values(), key=lambda f: f['duration'], reverse=True)
    total = round(sum(float(r['duration']) for r in records), 3)
    slowest = sorted(records, key=lambda r: float(r['duration']), reverse=True)[:top]

    os.makedirs(target, exist_ok=True)
    with open(os.path.join(target, 'behat-timings.json'), 'w', encoding='utf-8') as handle:
        json.dump({'total': {'scenarios': len(records), 'duration': total,
                             'first_start': min(r['start'] for r in records),
                             'last_start': max(r['start'] for r in records)},
                   'features': byfeature, 'scenarios': records}, handle, indent=2, ensure_ascii=False)
    with open(os.path.join(target, 'behat-timings.csv'), 'w', encoding='utf-8', newline='') as handle:
        writer = csv.writer(handle)
        writer.writerow(['feature', 'scenario', 'line', 'start', 'duration', 'result', 'casrepair'])
        for record in records:
            writer.writerow([record['feature'], record['scenario'], record.get('line', ''), record['start'],
                             record['duration'], record['result'], record.get('casrepair', '')])

    lines = ['### Behat timings', '',
             f'{len(records)} scenarios, {total:.1f} s in the scenarios themselves.', '',
             '| Feature | Scenarios | Seconds | Not passed |', '|---|---:|---:|---:|']
    lines += [f"| {f['feature']} | {f['scenarios']} | {f['duration']:.1f} | {f['failed']} |" for f in byfeature]
    lines += ['', f'Slowest {len(slowest)}:', '', '| Seconds | Feature | Scenario |', '|---:|---|---|']
    lines += [f"| {float(r['duration']):.1f} | {r['feature']} | {r['scenario']} |" for r in slowest]
    markdown = '\n'.join(lines) + '\n'
    with open(os.path.join(target, 'behat-timings.md'), 'w', encoding='utf-8') as handle:
        handle.write(markdown)
    print(markdown)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
