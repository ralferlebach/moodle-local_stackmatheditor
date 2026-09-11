#!/usr/bin/env python3
# This file is part of Moodle - https://moodle.org/
#
# Moodle is free software: you can redistribute it and/or modify
# it under the terms of the GNU General Public License as published by
# the Free Software Foundation, either version 3 of the License, or
# (at your option) any later version.
#
# Moodle is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with Moodle.  If not, see <https://www.gnu.org/licenses/>.
"""Evaluate a JMeter CSV result file and fail on failed samples.

JMeter exits 0 even when every assertion failed, so a green job would prove nothing. This script
reads the `success` column by its header name (not by position, which depends on the save
configuration) and exits 1 when any sample failed or no sample was recorded at all.

Usage: python3 tests/load/check_jtl.py results.jtl

@copyright 2026 Ralf Erlebach
@license   https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
"""

import csv
import sys
from collections import Counter


def main(path):
    """Summarise the result file and return the process exit code.

    :param path: Path to the CSV .jtl file.
    :return: 0 when all samples passed, 1 otherwise.
    """
    total = Counter()
    failed = Counter()
    messages = Counter()
    with open(path, newline='', encoding='utf-8') as handle:
        for row in csv.DictReader(handle):
            label = row.get('label', '?')
            total[label] += 1
            if row.get('success', '').lower() != 'true':
                failed[label] += 1
                message = ' '.join((row.get('failureMessage') or '').split())
                messages[(label, row.get('responseCode', ''), message)] += 1
    if not total:
        print(f'No samples in {path} - the plan did not run.')
        return 1
    for label in sorted(total):
        print(f'{label}: {total[label] - failed[label]}/{total[label]} passed')
    for (label, code, message), count in messages.most_common(10):
        print(f'  FAILED {count}x {label} (HTTP {code}): {message}')
    return 1 if sum(failed.values()) else 0


if __name__ == '__main__':
    if len(sys.argv) != 2:
        print('Usage: check_jtl.py <results.jtl>')
        sys.exit(1)
    sys.exit(main(sys.argv[1]))
