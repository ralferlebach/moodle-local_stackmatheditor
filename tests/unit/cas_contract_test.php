<?php
// This file is part of Moodle - https://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <https://www.gnu.org/licenses/>.

namespace local_stackmatheditor;

/**
 * The math contracts reach a real STACK (#34, #96).
 *
 * tests/fixtures/math_contracts.json is the single source of truth for what the toolbar promises:
 * a piece of LaTeX, the Maxima string tex2max makes of it, and what STACK has to do with that
 * string. tests/jest/math_contracts.test.js proves the first half against the real tex2max. This
 * test proves the second half against the real STACK:
 *
 * - the parser part needs no CAS and always runs: the Maxima string goes through the same
 *   student-input parser and filters an algebraic input uses when a student's answer arrives;
 * - the CAS part puts every answer through STACK's own CAS-side validation and then lets Maxima
 *   evaluate it, with the packages the contract names loaded. Without a configured CAS it skips,
 *   unless SME_REQUIRE_CAS=1 - then a missing CAS is a failure, so CI cannot turn green by
 *   skipping.
 *
 * It also keeps the fixture honest: every group and every visible button has a contract, and no
 * contract names a button that does not exist.
 *
 * Replaces the sixteen browser scenarios of tests/behat/cas_contract.feature, which asked STACK
 * the same question one page load at a time.
 *
 * @package    local_stackmatheditor
 * @copyright  2026 Ralf Erlebach
 * @license    https://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 * @covers     \local_stackmatheditor\definitions
 */
final class cas_contract_test extends \advanced_testcase {
    /**
     * Visible buttons without a contract of their own, as "group|template" => reason.
     *
     * Empty on purpose: every button has a contract, including the brackets and the Greek
     * capitals that look like Latin letters. Add an entry only with a reason a reviewer accepts.
     */
    private const NO_OWN_CONTRACT = [];

    /**
     * What definitions::export_for_js() delivers on a site with default settings.
     *
     * tests/jest/math_contracts.test.js converts with exactly these values (SITE_DEFAULTS there);
     * this test fails when the PHP defaults move and the Jest suite would silently keep the old
     * ones.
     */
    private const SITE_DEFAULTS = [
        'vectorFormat'        => 'matrix',
        'normFunction'        => 'norm',
        'coordinateSeparator' => '|',
    ];

    /**
     * Site settings that make the vector differential operators visible.
     *
     * Without them the group has no buttons, and a gate that only sees the default toolbar would
     * never ask for their contracts.
     */
    private const DIFF_OPS = [
        'gradient'   => 'grad',
        'divergence' => 'div',
        'curl'       => 'curl',
        'laplacian'  => 'laplacian',
    ];

    /**
     * "Insert stars for implied multiplication only".
     *
     * Variable mode 'stack' leaves implicit multiplication to STACK ("2x", "x^2y"), so this is the
     * strictest setting under which the editor's output is meant to be read. It does not split
     * multi-letter names, so "alpha" stays alpha.
     */
    private const INSERT_STARS = 1;

    /** Keys every contract must have. */
    private const REQUIRED_KEYS = ['id', 'group', 'latex', 'maxima', 'packages', 'cas', 'browserSmoke'];

    /**
     * Load the STACK classes this test talks to.
     *
     * @return void
     */
    protected function setUp(): void {
        global $CFG;

        parent::setUp();

        $stack = $CFG->dirroot . '/question/type/stack';
        require_once($stack . '/stack/input/factory.class.php');
        require_once($stack . '/stack/options.class.php');
        require_once($stack . '/stack/cas/cassecurity.class.php');
        require_once($stack . '/stack/cas/ast.container.class.php');
        require_once($stack . '/stack/cas/cassession2.class.php');
        require_once($stack . '/stack/cas/secure_loader.class.php');
        require_once($stack . '/tests/fixtures/test_maxima_configuration.php');
    }

    /**
     * The contracts, as decoded from the fixture.
     *
     * @return array List of contracts.
     */
    private function contracts(): array {
        $path = __DIR__ . '/../fixtures/math_contracts.json';
        $this->assertFileExists($path);

        $contracts = json_decode(file_get_contents($path), true);
        $this->assertIsArray($contracts, 'tests/fixtures/math_contracts.json is not valid JSON');

        return $contracts;
    }

    /**
     * Show every button a site can offer, including the operators that need a setting.
     *
     * @return array The button catalogue.
     */
    private function full_catalogue(): array {
        $this->resetAfterTest();
        foreach (self::DIFF_OPS as $semantic => $function) {
            set_config('diffop' . $semantic, $function, 'local_stackmatheditor');
        }

        return definitions::export_button_catalogue();
    }

    /**
     * Run a Maxima string through the parser of an algebraic input, as a student's answer.
     *
     * This is the half of stack_input::validate_student_response() that runs without a CAS:
     * the input's own filters (insert stars, forbidden words, allowed words, the security map)
     * applied to exactly what the editor writes into the input.
     *
     * @param array $contract Contract.
     * @return array [bool valid, string errors, \stack_ast_container parsed answer]
     */
    private function parse(array $contract): array {
        $input = \stack_input_factory::make('algebraic', 'ans1', 'x', new \stack_options(), [
            'insertStars'  => self::INSERT_STARS,
            'sameType'     => false,
            'lowestTerms'  => false,
            'allowWords'   => $contract['allowWords'] ?? '',
        ]);
        $options = new \stack_options();
        $options->set_option('simplify', false);

        // Protected in STACK: the public entry point would start a CAS session as well.
        $method = new \ReflectionMethod($input, 'validate_contents');
        [$valid, $errors, , , $caslines] = $method->invoke(
            $input,
            [$contract['maxima']],
            new \stack_cas_security(),
            $options
        );

        return [
            (bool) $valid,
            trim(strip_tags(implode(' ', array_filter($errors)))),
            $caslines[0],
        ];
    }

    /**
     * Make the STACK test CAS available, or skip - or fail when CI requires it.
     *
     * @return void
     */
    private function require_cas(): void {
        // Only an explicit configuration counts. STACK's own check also accepts the platform its
        // installer stored ("linux-optimised" after building maxima_opt_auto into the PHPUnit
        // dataroot), and that image is not guaranteed to survive the dataroot resets (qtype_stack's
        // own CI copies it out first) - whether the CAS answered would depend on what ran before.
        // Platform 'none' is STACK's documented "no CAS for the tests".
        $configured = defined('QTYPE_STACK_TEST_CONFIG_PLATFORM') && QTYPE_STACK_TEST_CONFIG_PLATFORM !== 'none';
        if (!$configured || !\qtype_stack_test_config::is_test_config_available()) {
            if (getenv('SME_REQUIRE_CAS') === '1') {
                $this->fail('SME_REQUIRE_CAS=1, but no STACK CAS is configured for PHPUnit. Define the '
                    . 'QTYPE_STACK_TEST_CONFIG_* constants in config.php (see qtype_stack '
                    . 'doc/en/Developer/Unit_tests.md).');
            }
            $this->markTestSkipped('No STACK CAS configured for PHPUnit; the parser part has run. '
                . 'Set SME_REQUIRE_CAS=1 to make this a failure.');
        }

        $this->resetAfterTest();
        \stack_utils::clear_config_cache();
        \qtype_stack_test_config::setup_test_maxima_connection();

        // A CAS that is configured but does not answer is a broken setup, not a skip.
        $probe = \stack_ast_container::make_from_teacher_source('1+1', 'cas probe');
        $session = new \stack_cas_session2([$probe], new \stack_options());
        $session->instantiate();
        $this->assertTrue(
            $probe->is_correctly_evaluated() && $probe->get_value() === '2',
            'The STACK CAS is configured but does not answer: ' . $session->get_errors()
        );
    }

    /**
     * The fixture has the shape both test suites rely on.
     *
     * @return void
     */
    public function test_the_fixture_is_well_formed(): void {
        $contracts = $this->contracts();
        $this->assertGreaterThan(16, count($contracts));

        $ids = [];
        $smoke = [];
        foreach ($contracts as $index => $contract) {
            foreach (self::REQUIRED_KEYS as $key) {
                $this->assertArrayHasKey($key, $contract, "contract #$index has no '$key'");
            }
            $id = $contract['id'];
            $this->assertMatchesRegularExpression('/^[a-z0-9]+(-[a-z0-9]+)*$/', $id, "'$id' is not kebab-case");
            $this->assertArrayNotHasKey($id, $ids, "the id '$id' is used twice");
            $ids[$id] = true;

            $this->assertNotSame('', trim($contract['latex']), "$id: no LaTeX");
            $this->assertNotSame('', trim($contract['maxima']), "$id: no Maxima");
            $this->assertIsArray($contract['packages'], "$id: packages must be a list");
            $this->assertIsBool($contract['browserSmoke'], "$id: browserSmoke must be true or false");
            if ($contract['browserSmoke']) {
                $smoke[] = $id;
            }

            $this->assertContains($contract['cas'], ['accept', 'known-defect'], "$id: unknown cas '{$contract['cas']}'");
            if ($contract['cas'] === 'known-defect') {
                // A known defect is pinned, not hidden: it says what is wrong and where it shows.
                $this->assertNotEmpty($contract['defect'] ?? '', "$id: a known defect needs a description");
                $this->assertContains($contract['defectStage'] ?? '', ['parser', 'cas'], "$id: defectStage");
                $this->assertArrayNotHasKey('value', $contract, "$id: a known defect has no expected value");
            } else {
                $this->assertArrayNotHasKey('defect', $contract, "$id: 'defect' without cas 'known-defect'");
                $this->assertArrayNotHasKey('defectStage', $contract, "$id: 'defectStage' without a defect");
            }
        }

        $this->assertCount(1, $smoke, 'exactly one contract is the browser smoke test');
    }

    /**
     * Every visible button has a contract, unless it is a named exception.
     *
     * @return void
     */
    public function test_every_visible_button_has_a_contract(): void {
        $covered = [];
        foreach ($this->contracts() as $contract) {
            if (isset($contract['button'])) {
                $covered[$contract['group'] . '|' . $contract['button']] = true;
            }
        }

        $missing = [];
        foreach ($this->full_catalogue() as $button) {
            $key = $button['group'] . '|' . $button['template'];
            if (!isset($covered[$key]) && !array_key_exists($key, self::NO_OWN_CONTRACT)) {
                $missing[] = $key;
            }
        }

        $this->assertSame(
            [],
            $missing,
            'These visible buttons have no contract in tests/fixtures/math_contracts.json. Add one '
                . '(group and button = the template), or list the button in NO_OWN_CONTRACT and in '
                . 'NO_OWN_CONTRACT of tests/jest/math_contracts.test.js with a reason.'
        );
    }

    /**
     * No group can exist without a contract.
     *
     * @return void
     */
    public function test_every_group_has_a_contract(): void {
        $groups = [];
        foreach ($this->contracts() as $contract) {
            $groups[$contract['group']] = true;
        }

        $this->full_catalogue();
        foreach (array_keys(definitions::get_element_groups()) as $group) {
            $this->assertArrayHasKey($group, $groups, "the toolbar group '$group' has no contract");
        }
    }

    /**
     * A contract never names a group or a button the toolbar does not have.
     *
     * @return void
     */
    public function test_every_contract_names_a_real_button(): void {
        $buttons = [];
        foreach ($this->full_catalogue() as $button) {
            $buttons[$button['group'] . '|' . $button['template']] = true;
        }
        $groups = definitions::get_element_groups();

        foreach ($this->contracts() as $contract) {
            $this->assertArrayHasKey($contract['group'], $groups, "{$contract['id']}: unknown group");
            if (isset($contract['button'])) {
                $this->assertArrayHasKey(
                    $contract['group'] . '|' . $contract['button'],
                    $buttons,
                    "{$contract['id']}: the group '{$contract['group']}' has no button '{$contract['button']}'"
                );
            }
        }
    }

    /**
     * A contract loads exactly the packages its group declares.
     *
     * @return void
     */
    public function test_packages_follow_the_group_requirements(): void {
        $groups = definitions::get_element_groups();

        foreach ($this->contracts() as $contract) {
            $declared = [];
            foreach ($groups[$contract['group']]['requires'] ?? [] as $requirement) {
                // STACK's own libraries (geometry.mac) are loaded everywhere; nothing to load.
                if ($requirement['type'] !== dependency_resolver::TYPE_CORE) {
                    $declared[] = $requirement['package'];
                }
            }
            $packages = $contract['packages'];
            sort($declared);
            sort($packages);
            $this->assertSame($declared, $packages, "{$contract['id']}: packages differ from the group's requirements");
        }
    }

    /**
     * The Jest suite converts with the real default settings.
     *
     * @return void
     */
    public function test_the_jest_site_defaults_are_the_real_defaults(): void {
        $this->resetAfterTest();
        $exported = definitions::export_for_js();

        foreach (self::SITE_DEFAULTS as $key => $value) {
            $this->assertSame($value, $exported[$key], "export_for_js()['$key'] changed - update SITE_DEFAULTS here and in Jest");
        }
        foreach (array_keys(self::DIFF_OPS) as $semantic) {
            $this->assertSame('', $exported['diffOps'][$semantic], "diffOps.$semantic is no longer off by default");
        }
    }

    /**
     * STACK's student-input parser reads every contract's Maxima string. No CAS needed.
     *
     * @return void
     */
    public function test_the_stack_parser_accepts_every_contract(): void {
        $failures = [];
        $checked = 0;

        foreach ($this->contracts() as $contract) {
            [$valid, $errors] = $this->parse($contract);
            $checked++;
            $expectrejection = $contract['cas'] === 'known-defect' && $contract['defectStage'] === 'parser';

            if ($expectrejection && $valid) {
                $failures[] = "{$contract['id']}: the known parser defect is gone - STACK now accepts "
                    . "'{$contract['maxima']}'. Set cas to 'accept' and drop defect/defectStage.";
            } else if (!$expectrejection && !$valid) {
                $failures[] = "{$contract['id']}: STACK rejects '{$contract['maxima']}': $errors";
            }
        }

        $this->assertSame([], $failures, implode("\n", $failures));
        $this->assertSame(count($this->contracts()), $checked);
    }

    /**
     * STACK's CAS validates every answer and Maxima evaluates it.
     *
     * Accepted contracts share one session per package set rather than one each: a cold Maxima
     * costs seconds, and STACK evaluates the statements of a session independently. A known defect
     * gets a session of its own, because a Maxima syntax error ends the whole session and would
     * take every other contract in it along.
     *
     * @return void
     */
    public function test_the_cas_accepts_and_evaluates_every_contract(): void {
        $this->require_cas();

        $batches = [];
        foreach ($this->contracts() as $contract) {
            if ($contract['cas'] === 'known-defect' && $contract['defectStage'] === 'parser') {
                // Never reaches the CAS; the parser test pins it.
                continue;
            }
            $packages = $contract['packages'];
            sort($packages);
            $key = $contract['cas'] === 'known-defect' ? $contract['id'] : 'accept';
            $batches[$key . ':' . implode(',', $packages)][] = $contract;
        }

        $failures = [];
        $evaluated = 0;
        foreach ($batches as $batch => $contracts) {
            $failures = array_merge($failures, $this->evaluate($batch, $contracts, $evaluated));
        }

        $this->assertSame([], $failures, implode("\n", $failures));
        $this->assertGreaterThan(100, $evaluated, 'the CAS must have seen the contracts');
    }

    /**
     * Validate and evaluate a batch of contracts in one CAS session.
     *
     * For each contract the session holds two statements:
     * - the answer as validate_student_response() sends it when the student leaves the field (the
     *   student-parsed expression inside STACK's typeless validation);
     * - the same expression with its nouns turned back into verbs, evaluated with simplification,
     *   which is what an expected value is compared with: a student's integrate(...) reaches the
     *   CAS as an inert nounint(...) on purpose, and the contract is about what it means.
     *
     * @param string $batch Batch key, "<accept|contract id>:<packages>".
     * @param array $contracts Contracts of this batch.
     * @param int $evaluated Counter of contracts that went through the CAS.
     * @return array Failure messages.
     */
    private function evaluate(string $batch, array $contracts, int &$evaluated): array {
        $failures = [];
        $statements = [];
        [, $packages] = explode(':', $batch, 2);
        foreach (array_filter(explode(',', $packages)) as $package) {
            // Trusted code: STACK refuses load() in question variables, so this is the only way a
            // test can provide a share package.
            $statements[] = new \stack_secure_loader('load("' . $package . '")', 'math contract package');
        }

        $checks = [];
        foreach ($contracts as $index => $contract) {
            [$valid, $errors, $validation] = $this->parse($contract);
            if (!$valid) {
                $failures[] = "{$contract['id']}: STACK's parser rejects '{$contract['maxima']}': $errors";
                continue;
            }
            $validation->set_cas_validation_context('smeans' . $index, false, 'und', 'typeless', false, 0);
            $value = \stack_ast_container::make_from_teacher_source(
                $validation->get_inputform(true, 0),
                'math contract ' . $contract['id'],
                new \stack_cas_security()
            );
            $statements[] = $validation;
            $statements[] = $value;
            $checks[] = [$contract, $validation, $value];
        }

        $session = new \stack_cas_session2($statements, new \stack_options());
        $this->assertTrue($session->get_valid(), "session $batch: " . $session->get_errors());
        $session->instantiate();

        foreach ($checks as [$contract, $validation, $value]) {
            $evaluated++;
            $problems = trim(strip_tags(
                $validation->get_errors() . ' ' . $validation->get_feedback() . ' ' . $value->get_errors()
            ));
            $ok = $problems === '' && $validation->is_correctly_evaluated() && $value->is_correctly_evaluated();

            if ($contract['cas'] === 'known-defect') {
                if ($ok) {
                    $failures[] = "{$contract['id']}: the known CAS defect is gone - STACK now accepts "
                        . "'{$contract['maxima']}'. Set cas to 'accept' and drop defect/defectStage.";
                }
                continue;
            }
            if (!$ok) {
                $failures[] = "{$contract['id']}: the CAS refuses '{$contract['maxima']}': $problems";
                continue;
            }
            if (isset($contract['value'])) {
                $actual = str_replace(' ', '', $value->get_value());
                $expected = str_replace(' ', '', $contract['value']);
                if ($actual !== $expected) {
                    $failures[] = "{$contract['id']}: Maxima evaluates '{$contract['maxima']}' to "
                        . "'$actual', the contract expects '$expected'";
                }
            }
        }

        return $failures;
    }
}
