define(['qunit', 'skeletik'], function (QUnit, skeletik) {
	'use strict';

	QUnit.module('skeletik');

	QUnit.test('ranges:fail', function (assert) {
		try {
			skeletik({'-': ['1']}, {});
		} catch (err) {
			assert.equal(err.message, "skeletik#ranges: 'name' of range can consist only 'a-z', '_' or '$'");
		}
	});

	QUnit.test('a + b', function (assert) {
		var parser = skeletik({
			'$e': ['a', 'b']
		}, {
			'': {
				'$e': '!expr',
				'+': function (lex, bone) {
					bone.add('#s', lex.takeChar());
				}
			},
			'expr': {
				'': function (lex, bone) {
					bone.add('#e', lex.takeToken());
					return '>';
				}
			}
		});

		assert.deepEqual(JSON.stringify(parser('a + b'), null, 2), JSON.stringify({
			type: '#root',
			nodes: [
				{type: '#e', raw: 'a', nodes: []},
				{type: '#s', raw: '+', nodes: []},
				{type: '#e', raw: 'b', nodes: []}
			]
		}, null, 2));
	});
});
