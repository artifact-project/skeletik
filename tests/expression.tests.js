define(['qunit', 'skeletik/preset/expression'], function (QUnit, expressionParser) {
	'use strict';

	QUnit.module('skeletik:expression');

	expressionParser = expressionParser['default'];

	function testSyntax(name, cases, debug) {
		QUnit.test(name, function (assert) {
			cases.forEach(function (expr) {
				var actual = null;
				var expected = null;

				if (debug && debug !== 'trace') {
					debugger;
				}

				try {
					expressionParser(expr);
				} catch (err) {
					actual = err;
				}

				try {
					eval(expr);
				} catch (err) {
					if (!(err instanceof ReferenceError)) {
						expected = err;
					}
				}

				if (debug === 'trace') {
					console.log(actual, expected);
				}

				if (actual === expected) {
					ok(true, expr);
				} else {
					assert.deepEqual(actual && actual.toString(), expected && expected.toString(), expr);
					// deepEqual(actual.message, expected.message, expr);
				}
			});
		});
	}

	// expressionParser('/s/""');
	// return;

	QUnit.test('number', function (assert) {
		function testMe(tpl, res) {
			var frag = expressionParser(tpl);
			assert.deepEqual(frag.length, 1);
			assert.deepEqual(frag.first.type, 'number');
			assert.deepEqual(frag.first.raw, res);
		}

		testMe('0', '0');
		testMe('0.', '0.');
		testMe('.0', '.0');
	});

	QUnit.test('core', function (assert) {
		var frag = expressionParser('+1 - 2.3');

		assert.deepEqual(frag.length, 4);
		assert.deepEqual(frag.nodes[0].type, 'sign');
		assert.deepEqual(frag.nodes[0].raw, '+');

		assert.deepEqual(frag.nodes[1].type, 'number');
		assert.deepEqual(frag.nodes[1].raw, '1');

		assert.deepEqual(frag.nodes[2].type, 'sign');
		assert.deepEqual(frag.nodes[2].raw, '-');

		assert.deepEqual(frag.nodes[3].type, 'number');
		assert.deepEqual(frag.nodes[3].raw, '2.3');
	});

	testSyntax(
		'without errors',
		['x()', 'x ()', '(+1)', '[+1]', '"foo"', '""', '{}', '[]']
	);

	testSyntax(
		'numbers without errors',
		['0', '.0', '-1', '+2', '3.4', '+5.6', '-7.8', '.9', '-1.0', '+1.1']
	);

	testSyntax(
		'string:single',
		["''", "'xy'", "'x\\'y'"]
	);

	testSyntax(
		'string:quote',
		['""', '"xy"', '"x\\"y"']
	);

	testSyntax(
		'Invalid regular expression: missing /',
		['/']
	);

	testSyntax(
		'Invalid or unexpected token',
		['@', '#', "'", '"', '\\']
	);

	testSyntax(
		'Unexpected end of input',
		[
			'~', '+', '-', '(', '{', '[', '!',
			'x/', 'x-', 'x*', '""['
		]
	);

	testSyntax(
		'Unexpected token ) [PARENTHESIS]',
		['()', '-()']
	);

	testSyntax(
		'Unexpected token . [DOTS]',
		['..']
	)

	testSyntax(
		'Unexpected token',
		[
			',', '.', , '*', '&', '|', '^', ']', '}', ')', '%', '&', '=', '?', ':', '>', '<',
			'[+]', '(+)'
		]
	);

	testSyntax(
		'Unexpected string',
		['1""', 'f""', '/s/""', '(1)""', '[]""']
	);

	testSyntax(
		'Unexpected number',
		["''1", '(1)2', '[]3', '12.3.', '.0.']
	);

	testSyntax(
		'Unexpected identifier',
		["''x", '(1)x', '[]y']
	);

	// testSyntax(
	// 	'Unexpected token +',
	// 	['.0.+2']
	// );

	//QUnit.test('error', function () {
	//	try {
	//		debugger;
	//		expressionParser('123 + 123 + ([+])')
	//	} catch (err) {
	//		console.log(err);
	//		debugger;
	//	}
	//});
});
