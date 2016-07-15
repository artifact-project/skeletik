define(['qunit', 'skeletik/preset/xtpl-keywords'], function (QUnit, xtplKeywords) {
	'use strict';

	QUnit.module('skeletik:xtpl-keywords');

	QUnit.test('else if', function (assert) {
		// var rules = xtplKeywords('if (@test:js)');
		var rules = xtplKeywords('( [ @key:name , @as:name ] in @data:js )');
		console.log(rules);

		assert.deepEqual(rules, {
			'for': {
				'': function (lex, bone) {
					var code = lex.code;
					var chr = seq[idx];

					if (code === chr) {
						idx++;
					} else if (code === 32 && seq[idx - 1] === 32) {
						// ничего
					} else if (chr.attr) {
						idx++;
						return 'attr_start_type:' + chr.type;
					} else {
						fail();
					}
				},
			}
		});
	});
});