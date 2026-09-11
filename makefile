# Makefile for local_stackmatheditor
# Mirrors the moodle-plugin-ci check suite used in GitHub Actions and drives the local test tools.
# All checks run to completion even if individual steps report errors.
#
# Targets:
#   make all            — fix + full check suite (default)
#   make fix            — auto-fix PHP style + PHPDoc, rebuild AMD
#   make check          — check-only (no auto-fix)
#   make clear          — clear terminal
#
# Individual checks:
#   make lint-php       — PHPCS, Moodle coding standard
#   make lint-phpdoc    — Moodle PHPDoc checker (needs local/moodlecheck)
#   make lint-js        — ESLint on amd/src
#   make lint-gherkin   — Gherkin lint of the Behat features
#   make lint-mustache  — Mustache syntax (skipped while there is no templates/)
#   make lint-cpd       — PHP Copy/Paste Detector (informational)
#   make lint-md        — PHP Mess Detector (informational)
#
# Auto-fixers / build:
#   make fix-lint-php   — phpcbf
#   make fix-phpdoc     — tools/fix_phpdoc.php
#   make amd            — rebuild amd/build (commit the result!)
#
# Tests:
#   make jest           — Jest unit tests of the AMD conversion modules (tests/jest)
#   make phpunit        — PHPUnit testsuite of this plugin
#   make behat          — Behat scenarios of this plugin (needs Selenium + behat_wwwroot)
#   make behat-stack    — prepare STACK CAS in the Behat site (run once after behat init)
#   make playwright     — Playwright smoke against the running dev site (SME_ADMIN_PASS=...)
#   make k6             — k6 smoke load test (BASE_URL defaults to $CFG->wwwroot)
#   make jmeter         — JMeter smoke load test (downloads JMeter on first run)
#
# Setup only:
#   make jest-setup | playwright-setup | jmeter-setup
#
# Paths are auto-detected from the makefile's own location: the plugin lives at
# <MOODLE_ROOT>/local/stackmatheditor. Override on the command line if necessary:
#   make lint-php MOODLE_ROOT=/var/www/html/moodle45_aliseadele

THIS_DIR      := $(patsubst %/,%,$(dir $(abspath $(lastword $(MAKEFILE_LIST)))))
PLUGIN_DIR    ?= $(THIS_DIR)
MOODLE_ROOT   ?= $(abspath $(PLUGIN_DIR)/../..)
PLUGIN_NAME   ?= local_stackmatheditor
PLUGIN_REL    ?= local/stackmatheditor
PHP           ?= $(shell which php 2>/dev/null || echo /usr/bin/php)
PHPCS         ?= phpcs
PHPCBF        ?= phpcbf
NPX           ?= npx
NPM           ?= npm
K6            ?= k6

# --- Browser / load / unit test tooling ------------------------------------
JEST_DIR       ?= $(PLUGIN_DIR)/tests/jest
PLAYWRIGHT_DIR ?= $(PLUGIN_DIR)/tests/playwright
LOAD_DIR       ?= $(PLUGIN_DIR)/tests/load
JMETER_VERSION ?= 5.6.3
JMETER_HOME    ?= $(LOAD_DIR)/apache-jmeter-$(JMETER_VERSION)
JMETER         ?= $(JMETER_HOME)/bin/jmeter

# Base URL read from the site's own config.php ($CFG->wwwroot) via ABORT_AFTER_CONFIG, so only
# the config is loaded. Lazily evaluated: only the playwright / load targets expand it.
MOODLE_WWWROOT = $(shell $(PHP) -r "define('CLI_SCRIPT',1); define('ABORT_AFTER_CONFIG',1); @include '$(MOODLE_ROOT)/config.php'; echo isset(\$$CFG->wwwroot) ? \$$CFG->wwwroot : '';" 2>/dev/null)

# Load-test parameters (override on the command line).
BASE_URL       ?= $(or $(MOODLE_WWWROOT),http://127.0.0.1:8000)
VUS            ?= 5
DURATION       ?= 15s
THREADS        ?= 5
RAMPUP         ?= 5
LOOPS          ?= 10

# Playwright credentials: the admin password of the site under test is required.
SME_ADMIN_USER ?= admin
SME_ADMIN_PASS ?=

.PHONY: all fix check clear \
        lint-php lint-phpdoc lint-js lint-gherkin lint-mustache lint-cpd lint-md \
        fix-lint-php fix-phpdoc amd \
        jest jest-setup phpunit behat behat-stack \
        playwright playwright-setup k6 jmeter jmeter-setup

# ---------------------------------------------------------------------------
# all / fix / check
# ---------------------------------------------------------------------------
all: clear fix check
	@echo ""
	@echo "=== All checks complete. Review output above for errors. ==="

fix: clear fix-phpdoc fix-lint-php amd lint-js
	@echo ""
	@echo "=== All fixes complete. ==="

check: clear lint-php lint-phpdoc lint-mustache lint-gherkin lint-cpd lint-js amd jest phpunit
	@echo ""
	@echo "=== All checks complete. Review output above for errors. ==="

clear:
	clear

# ---------------------------------------------------------------------------
# PHP
# ---------------------------------------------------------------------------
lint-php:
	@echo "=== phpcs (Moodle standard) ==="
	-cd $(PLUGIN_DIR) && $(PHPCS) \
		--standard=moodle \
		--extensions=php \
		--severity=1 \
		--no-cache \
		--ignore=*/node_modules/*,*/thirdparty/* \
		.

fix-lint-php:
	@echo ""
	@echo "=== phpcbf (auto-fix) ==="
	-cd $(PLUGIN_DIR) && $(PHPCBF) \
		--standard=moodle \
		--extensions=php \
		--ignore=*/node_modules/*,*/thirdparty/* \
		.

lint-phpdoc:
	@echo ""
	@echo "=== PHPDoc (local_moodlecheck) ==="
	-cd $(MOODLE_ROOT) && $(PHP) local/moodlecheck/cli/moodlecheck.php \
		--path=$(PLUGIN_REL) \
		--format=text 2>&1 | grep -B1 '    Line' | grep -v '^--$$' || true

fix-phpdoc:
	@echo ""
	@echo "=== fix_phpdoc (tools/fix_phpdoc.php) ==="
	-$(PHP) $(PLUGIN_DIR)/tools/fix_phpdoc.php $(PLUGIN_DIR)

lint-mustache:
	@echo ""
	@echo "=== Mustache syntax check ==="
	@if [ -d $(PLUGIN_DIR)/templates ]; then \
		$(PHP) $(PLUGIN_DIR)/tools/mustache_check.php \
			$(PLUGIN_DIR)/templates 2>&1 | grep -v '^OK:' || true; \
	else \
		echo "No templates/ directory — Mustache check skipped."; \
	fi

lint-cpd:
	@echo ""
	@echo "=== PHP Copy/Paste Detector ==="
	-cd $(PLUGIN_DIR) && phpcpd --min-lines 5 --min-tokens 70 \
		--exclude tests --exclude tools --exclude thirdparty . || true

lint-md:
	@echo ""
	@echo "=== PHP Mess Detector ==="
	-cd $(PLUGIN_DIR) && phpmd . text cleancode,codesize,controversial,design,naming,unusedcode \
		--exclude tests,tools,thirdparty,db/upgrade.php || true

# ---------------------------------------------------------------------------
# JavaScript (AMD) — always inside the Moodle tree, whose Grunt/ESLint config applies
# ---------------------------------------------------------------------------
lint-js:
	@echo ""
	@echo "=== ESLint (amd/src) ==="
	-cd $(MOODLE_ROOT) && $(NPX) grunt eslint --root=. \
		--files=$(PLUGIN_REL)/amd/src/ \
		--show-lint-warnings

lint-gherkin:
	@echo ""
	@echo "=== Gherkin lint ==="
	-cd $(MOODLE_ROOT) && $(NPX) grunt gherkinlint --root=.

# Rollup needs entry points, not a directory (a directory causes E_RESOLVE), hence the list.
# The committed amd/build must match what this produces: CI rebuilds on MOODLE_405_STABLE and
# fails on a stale file.
amd:
	@echo ""
	@echo "=== AMD rebuild (grunt amd, this plugin only) ==="
	-cd $(MOODLE_ROOT) && files=$$(find $(PLUGIN_REL)/amd/src -name '*.js' \
		| tr '\n' ',' | sed 's/,$$//'); \
		$(NPX) grunt amd --root=. --force --files="$$files"

# ---------------------------------------------------------------------------
# Jest — unit tests of amd/src (own package.json in tests/jest, never in the plugin root:
# moodle-plugin-ci would otherwise run an extra npm install in the plugin)
# ---------------------------------------------------------------------------
jest-setup:
	@echo ""
	@echo "=== Jest setup (npm ci in tests/jest) ==="
	cd $(JEST_DIR) && $(NPM) ci --no-audit --no-fund

jest:
	@echo ""
	@echo "=== Jest ==="
	@if [ ! -d $(JEST_DIR)/node_modules ]; then \
		echo "First run: installing Jest..."; \
		cd $(JEST_DIR) && $(NPM) ci --no-audit --no-fund; \
	fi
	cd $(JEST_DIR) && $(NPM) test

# ---------------------------------------------------------------------------
# PHPUnit
# One-time setup — config.php needs $CFG->phpunit_prefix and $CFG->phpunit_dataroot, then:
#   php admin/tool/phpunit/cli/init.php
# ---------------------------------------------------------------------------
phpunit:
	@echo ""
	@echo "=== PHPUnit ==="
	@if ! $(PHP) -r \
		"define('CLI_SCRIPT',1); require '$(MOODLE_ROOT)/config.php'; \
		exit(empty(\$$CFG->phpunit_dataroot) ? 1 : 0);" 2>/dev/null; then \
		echo "SKIP: phpunit_dataroot not configured."; \
		echo "      Add to config.php: \$$CFG->phpunit_dataroot = '...';"; \
	else \
		reinit_check=$$(cd $(MOODLE_ROOT) && $(PHP) vendor/bin/phpunit \
			--testsuite $(PLUGIN_NAME)_testsuite \
			--testdox 2>&1 | head -5); \
		if printf '%s\n' "$$reinit_check" | grep -q "initialised for different version"; then \
			echo "PHPUnit environment outdated — reinitialising..."; \
			cd $(MOODLE_ROOT) && $(PHP) admin/tool/phpunit/cli/init.php; \
		fi; \
		tmpout=$$(mktemp); \
		cd $(MOODLE_ROOT) && $(PHP) vendor/bin/phpunit \
			--testsuite $(PLUGIN_NAME)_testsuite \
			--testdox > "$$tmpout" 2>&1; \
		phpunit_exit=$$?; \
		grep -v "^ ✔\|^ ✓\|^ ↩" "$$tmpout" || true; \
		rm -f "$$tmpout"; \
		exit $$phpunit_exit; \
	fi

# ---------------------------------------------------------------------------
# Behat
# One-time setup — config.php needs $CFG->behat_prefix, behat_dataroot and
# behat_wwwroot = 'http://127.0.0.1:8000' (not localhost: ::1 yields HTTP 0), then:
#   php admin/tool/behat/cli/init.php && make behat-stack
# A running Selenium/ChromeDriver and a PHP server on behat_wwwroot are required.
# ---------------------------------------------------------------------------
behat-stack:
	@echo ""
	@echo "=== STACK CAS in the Behat site (platform=linux, genuine connect) ==="
	cd $(MOODLE_ROOT) && $(PHP) $(PLUGIN_DIR)/.github/stack-behat-init.php

behat:
	@echo ""
	@echo "=== Behat (@stack_init preflight, then all plugin scenarios) ==="
	cd $(MOODLE_ROOT) && $(PHP) admin/tool/behat/cli/run.php \
		--tags="@stack_init&&~@broken&&~@wip"
	cd $(MOODLE_ROOT) && $(PHP) admin/tool/behat/cli/run.php \
		--tags="@local_stackmatheditor&&~@broken&&~@wip&&~@stack_init"

# ---------------------------------------------------------------------------
# Playwright — needs the RUNNING dev site with this plugin installed.
# seed.php verifies the installation and exports SME_BASE_URL ($CFG->wwwroot).
# ---------------------------------------------------------------------------
playwright-setup:
	@echo ""
	@echo "=== Playwright setup (npm ci + Chromium) ==="
	cd $(PLAYWRIGHT_DIR) && $(NPM) ci --no-audit --no-fund && $(NPM) run install-browsers

playwright: clear
	@echo ""
	@echo "=== Playwright smoke (needs a running Moodle site) ==="
	@if [ -z "$(SME_ADMIN_PASS)" ]; then \
		echo "Missing SME_ADMIN_PASS. Usage: make playwright SME_ADMIN_PASS='<admin password>'"; \
		exit 1; \
	fi
	@if [ ! -d $(PLAYWRIGHT_DIR)/node_modules ]; then \
		echo "First run: installing Playwright + Chromium..."; \
		cd $(PLAYWRIGHT_DIR) && $(NPM) ci --no-audit --no-fund && $(NPM) run install-browsers; \
	fi
	cd $(PLAYWRIGHT_DIR) && eval "$$($(PHP) seed.php)" && \
		SME_ADMIN_USER='$(SME_ADMIN_USER)' SME_ADMIN_PASS='$(SME_ADMIN_PASS)' $(NPM) test
	@echo "Report: npx playwright show-report $(PLAYWRIGHT_DIR)/playwright-report"

# ---------------------------------------------------------------------------
# Load tests — smoke level (login page + shipped AMD module)
# ---------------------------------------------------------------------------
k6: clear
	@echo ""
	@echo "=== k6 smoke against $(BASE_URL) ==="
	@command -v $(K6) >/dev/null 2>&1 || { echo "k6 is not installed - see https://grafana.com/docs/k6/latest/set-up/install-k6/"; exit 1; }
	$(K6) run -e BASE_URL='$(BASE_URL)' -e VUS='$(VUS)' -e DURATION='$(DURATION)' \
		--summary-export=$(LOAD_DIR)/k6-summary.json \
		$(LOAD_DIR)/stackmatheditor-smoke.js

jmeter-setup:
	@echo ""
	@echo "=== JMeter setup ==="
	@if [ -x $(JMETER) ]; then \
		echo "JMeter $(JMETER_VERSION) already present at $(JMETER_HOME)."; \
	else \
		echo "Downloading Apache JMeter $(JMETER_VERSION)..."; \
		cd $(LOAD_DIR) && \
		curl -fsSL https://archive.apache.org/dist/jmeter/binaries/apache-jmeter-$(JMETER_VERSION).tgz -o jmeter.tgz && \
		tar xzf jmeter.tgz && rm -f jmeter.tgz && \
		echo "Installed to $(JMETER_HOME)."; \
	fi

# JMeter exits 0 even when assertions fail; check_jtl.py decides.
jmeter: clear jmeter-setup
	@echo ""
	@echo "=== JMeter smoke against $(BASE_URL) ==="
	@command -v java >/dev/null 2>&1 || { echo "Java (JRE 8+) is required to run JMeter."; exit 1; }
	rm -rf $(LOAD_DIR)/jmeter-report $(LOAD_DIR)/stackmatheditor-smoke.jtl
	cd $(LOAD_DIR) && $(JMETER) -n -t stackmatheditor-smoke.jmx \
		-Jbase_url='$(BASE_URL)' -Jthreads='$(THREADS)' -Jrampup='$(RAMPUP)' -Jloops='$(LOOPS)' \
		-l stackmatheditor-smoke.jtl -j jmeter.log -e -o jmeter-report
	python3 $(LOAD_DIR)/check_jtl.py $(LOAD_DIR)/stackmatheditor-smoke.jtl
	@echo "HTML dashboard: $(LOAD_DIR)/jmeter-report/index.html"
