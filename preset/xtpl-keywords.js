(function (factory) {
	'use strict';

	if (typeof define === 'function' && define.amd) {
		define(['skeletik', 'skeletik/preset/expression'], factory);
	} else if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('skeletik'), require('skeletik/preset/expression'));
	} else {
		window.skeletik.preset.xtpl = factory(window.skeletik, window.skeletik.preset.expression);
	}
})(function (skeletik, expressionParser) {
	'use strict';

	var _attr;
	var _spaces = false;

	function fail(lex, bone) {
		lex.error(`Invalid character: \`${lex.getChar()}\``, bone);
	}

	var parse = skeletik({
		'$ws': [' ', '\t', '\n'],
		'$seq': ['a-z', 'A-Z'],
		'$name': ['a-z', 'A-Z', '-']
	}, {
		'': {
			'@': 'attr',
			'': function (lex, bone) {
				bone.raw.push(lex.code);
			},
		},

		'attr': {
			':': function (lex, bone) {
				_attr = lex.takeToken();
				return 'attr:type';
			}
		},

		'attr:type': {
			'$name': '->',
			'': function (lex, bone) {
				bone.raw.push({attr: _attr, type: lex.takeToken()});
				return '>';
			}
		}
	}, {
		onstart: function (lex, bone) {
			bone.raw = [];
		}
	});

	return function (pattern) {
		return parse(pattern.trim()).raw;
	}
});