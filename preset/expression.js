(function (factory) {
	'use strict';

	if (typeof define === 'function' && define.amd) {
		define(['skeletik'], factory);
	} else if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('skeletik'));
	} else {
		window.skeletik.preset.expression = factory(window.skeletik);
	}
})(function (skeletik) {
	'use strict';

	// Tokens
	var T_ROOT = '#root';
	var T_ID = 'identifier';
	var T_SIGN = 'sign';
	var T_STRING = 'string';
	var T_NUMBER = 'number';
	var T_REGEXP = 'regexp';
	var T_BRACE = 'brace'; // {}
	var T_BRACKET = 'bracket'; // []
	var T_PARENTHESIS = 'parenthesis'; // ()

	var DOT_CODE = 46; // "."

	var IS_GROUP = {};
	IS_GROUP[T_BRACE] = T_BRACE;
	IS_GROUP[T_BRACKET] = T_BRACKET;
	IS_GROUP[T_PARENTHESIS] = T_PARENTHESIS;

	var CHR_TO_GROUP = {
		'{': T_BRACE, '}': T_BRACE,
		'[': T_BRACKET, ']': T_BRACKET,
		'(': T_PARENTHESIS, ')': T_PARENTHESIS
	};

	var _code;
	var _slashes = 0;

	function add(lex, parent, type, raw) {
		var last = parent.last;

		if (last !== void 0){
			if (type === T_STRING &&  last.type !== T_SIGN) {
				lex.error('Unexpected string', parent);
			}
			else if ((last.type === T_STRING || last.type === T_BRACKET || last.type === T_PARENTHESIS) && (type === T_NUMBER || type === T_ID)) {
				lex.error('Unexpected ' + type, parent);
			}
		}

		return parent.add(type, raw).last;
	}

	function validate(lex, root) {
		var last = root.last;
		var rootType = root.type;

		if (rootType === T_REGEXP) {
			lex.error('Invalid regular expression: missing /');
		}
		else if (rootType !== T_ROOT) {
			if (rootType === T_STRING) {
				lex.error('Unexpected token ILLEGAL', root);
			} else {
				lex.error('Unexpected end of input', root);
			}
		}
		else if (last) {
			if (last.type === T_SIGN) {
				if (last.prev || last.raw === '+' || last.raw === '/' || last.raw === '-' || last.raw === '!' || last.raw === '~') {
					lex.error('Unexpected end of input', root);
				} else {
					lex.error('Unexpected token ' + last.raw, root);
				}
			}
		}
	}

	function openGroup(lex, bone) {
		var chr = lex.takeChar();
		return add(lex, bone, CHR_TO_GROUP[chr]);
	}

	function closeGroup(lex, bone) {
		var chr = lex.takeChar();
		var type = CHR_TO_GROUP[chr];
		var parent = bone.parent;

		if (type !== bone.type || bone.last && bone.last.type === T_SIGN) {
			lex.error('Unexpected token ' + chr, bone);
		}

		if (chr === ')' && bone.type === type && (!bone.nodes.length && (!bone.prev || bone.prev.type !== T_ID))) {
			// lex.error('Unexpected end of input', bone);
			lex.error('Unexpected token ' + chr, bone);
		}

		return parent;
	}

	function openString(lex, bone) {
		_code = lex.code;
		_slashes = 1;

		return [add(lex, bone, T_STRING), 'string'];
	}

	function closeString(lex, bone) {
		if (lex.code === _code) { // chr: "
			if (!(_slashes % 2)) {
				bone.raw = lex.takeToken(0, 1).slice(1, -1);
				return bone.parent;
			}
		}

		_slashes = 0;

		return '->';
	}

	function fail(lex, bone) {
		lex.error('Unexpected token ' + lex.takeChar(), bone);
	}

	// Export parser
	var expression = skeletik({
		'$id': ['a-z', 'A-Z', '_', '$'],
		'$number': ['0-9'],
		'$sign': ['+', '*', '/', '%', '-', '!', '?', ':', '.', '&', '|', '^', '~', ',', '=', '>', '<']
	}, {
		'': {
			'"': openString,
			"'": openString,

			'{': openGroup,
			'}': closeGroup,

			'[': openGroup,
			']': closeGroup,

			'(': openGroup,
			')': closeGroup,

			'\r': '|->',
			'\n': '|->',
			' ': '|->',
			'\t': '|->',
			';': '|->',

			'/': function (lex, bone) {
				if (bone.last && bone.last.type === T_SIGN || !bone.last && (!bone.parent || IS_GROUP[bone.type])) {
					lex.takeChar();

					return [
						add(lex, bone, T_REGEXP, {source: '', flags: ''}),
						'regexp'
					];
				}
				else {
					bone.add(T_SIGN, lex.takeChar());
				}
			},

			'$id': 'id',

			'$sign': function (lex, bone) {
				var last = bone.last;

				if (last && lex.code === DOT_CODE && last.type === T_NUMBER) {
					last.isFloat && lex.error('Unexpected end of input');
					last.isFloat = true;
				} else {
					add(lex, bone, T_SIGN, lex.takeChar());
				}
			},

			'$number': 'number',

			'': function (lex, bone) {
				lex.error('Unexpected token ILLEGAL', bone);
			}
		},

		'regexp': {
			'/': function (lex, bone) {
				bone.raw.source = lex.takeToken(0, 1).slice(0, -1);
				return bone.parent;
			}
		},

		'id': {
			'$id': 'id',
			'': function (lex, bone) {
				add(lex, bone, T_ID, lex.takeToken());
			}
		},

		'number': {
			'$number': '->',
			'': function (lex, bone) {
				var last = bone.last;
				var token = lex.takeToken();

				if (last && last.type === T_NUMBER) {
					last.raw += token;
				} else if (last && last.type === T_SIGN && last.raw === '.') {
					last.raw += token;
					last.type = T_NUMBER;
					last.isFloat = true;
				} else {
					add(lex, bone, T_NUMBER, token);
				}
			}
		},

		'string': {
			'\\': function () {
				_slashes++;
				return '->';
			},

			'"': closeString,
			"'": closeString,

			'': function () {
				_slashes = 0;
				return '->';
			}
		}
	}, {
		onend: validate
	});

	expression.varName = skeletik({
		'$start': ['a-z', 'A-Z', '_'],
		'$body': ['a-z', 'A-Z', '_', '0-9']
	}, {
		'': {
			' ': '|->',
			'$start': 'body',
			'': fail
		},

		'body': {
			'$body': '->',
			'\n': function (lex, bone) {
				bone.raw = lex.takeToken();
			},
			'': fail
		}
	});

	// Export
	return expression;
});
