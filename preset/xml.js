(function (factory) {
	'use strict';

	if (typeof define === 'function' && define.amd) {
		define(['skeletik'], factory);
	} else if (typeof module === 'object' && module.exports) {
		module.exports = factory(require('skeletik'));
	} else {
		window.skeletik.preset.xml = factory(window.skeletik);
	}
})(function (skeletik) {
	'use strict';

	var TAG_TYPE = 'tag';
	var TEXT_TYPE = 'text';
	var COMMENT_TYPE = 'comment';
	var CDATA_TYPE = 'cdata';

	var QUOTE_CODE = 34;
	var MINUS_CODE = 45;
	var RIGHT_BRACE_CODE = 93;

	var _attr;
	var _slashes = 0;

	function add(parent, type, raw) {
		return parent.add(type, raw).last;
	}

	function addTag(parent, name) {
		return add(parent, TAG_TYPE, {
			name: name,
			attrs: {}
		});
	}

	function addText(parent, value) {
		value && add(parent, TEXT_TYPE, {value: value});
	}

	function addComment(parent, value) {
		add(parent, COMMENT_TYPE, {value: value});
	}

	function addCDATA(parent, value) {
		add(parent, CDATA_TYPE, {value: value});
	}

	function setBooleanAttr(lex, bone) {
		bone.raw.attrs[lex.takeToken()] = true;
	}

	function fail(lex, bone) {
		lex.error(`Invalid character \`${lex.getChar()}\``, bone);
	}

	// Export parser
	return skeletik({
		'$ws': [' ', '	', '\n'],
		'$name': ['a-z', 'A-Z', '-', ':', '0-9'],
		'$name_start': ['a-z', 'A-Z', '_'],
		'$attr': ['a-z', 'A-Z', '-', '_', ':', '@', '0-9']
	}, {
		'': {
			'<': 'entry:open',
			'': '!text'
		},

		'entry:open': {
			'$name_start': '!tag:name',
			'/': 'tag:close',
			'!': 'comment-or-cdata',
			'': fail
		},

		'comment-or-cdata': {
			'-': 'comment:await',
			'[': 'cdata:await',
			'': 'text'
		},

		'comment:await': {
			'-': 'comment:value',
			'': 'text'
		},

		'comment:value': {
			'>': function (lex, parent) {
				if (lex.prevCode === MINUS_CODE && lex.peek(-2) === MINUS_CODE) {
					addComment(parent, lex.takeToken().slice(0, -2));
					return '';
				} else {
					return '->';
				}
			},
			'': '->'
		},

		'cdata:await': {
			'': function (lex) {
				var token = lex.getToken();

				if (token === 'CDATA[') {
					return '!cdata:value';
				} else if (token.length === 6) {
					return 'text';
				}

				return '->';
			}
		},

		'cdata:value': {
			'>': function (lex, parent) {
				if (lex.prevCode === RIGHT_BRACE_CODE && lex.peek(-2) === RIGHT_BRACE_CODE) {
					addCDATA(parent, lex.takeToken().slice(0, -2));
					return '';
				} else {
					return '->';
				}
			}
		},

		'text': {
			'<': function (lex, parent) {
				addText(parent, lex.takeToken());
				return 'entry:open';
			},
			'': '->'
		},

		'tag:name': {
			'$name': '->',

			'/': function (lex, parent) {
				addTag(parent, lex.takeToken());
				return 'tag:end';
			},

			'>': function (lex, parent) {
				var name = lex.takeToken();
				return [addTag(parent, name), ''];
			},

			'$ws': function (lex, parent) {
				return [addTag(parent, lex.takeToken()), 'tag:attrs'];
			}
		},

		'tag:close': {
			'$name': '->',
			'>': function (lex, bone) {
				var name = lex.takeToken();
				var mustName = bone.raw && bone.raw.name;

				if (mustName !== name) {
					lex.error('Wrong closing tag "' + name + '", must be "' + mustName + '"', bone);
				}

				return [bone.parent, ''];
			},
			'': fail
		},

		'tag:end': {
			'>': '',
			'': fail
		},

		'tag:attrs': {
			'$attr': '!tag:attr',
			'$ws': '->',
			'/': function (lex, bone) {
				return [bone.parent, 'tag:end'];
			},
			'>': '',
			'': fail
		},

		'tag:attr': {
			'$attr': '->',

			'$ws': function (lex, bone) {
				setBooleanAttr(lex, bone);
				return 'tag:attrs';
			},

			'/': function (lex, bone) {
				setBooleanAttr(lex, bone);
				return [bone.parent, 'tag:end'];
			},

			'=': function (lex) {
				_attr = lex.takeToken();
				return 'tag:attr:value:await';
			},

			'': fail
		},
		
		'tag:attr:value:await': {
			'"': function () {
				_slashes = 0;
				return 'tag:attr:value:read';
			},
			'': fail
		},

		'tag:attr:value:read': {
			'\\': function () {
				_slashes++;
				return '->';
			},

			'"': function (lex, bone) {
				if (lex.code === QUOTE_CODE) { // chr: "
					if (!(_slashes % 2)) {
						bone.raw.attrs[_attr] = lex.takeToken();
						return 'tag:attrs';
					}
				}
		
				_slashes = 0;
				return '->';
			},

			'': function () {
				_slashes = 0;
				return '->';
			}
		}
	}, {
		onend: function (lex, bone) {
			if (lex.lastIdx < lex.length) {
				addText(bone, lex.getToken(0, -1));
			}

			if (bone.type !== '#root') {
				lex.error('<' + bone.raw.name + '/> must be closed', bone);
			}
		}
	});
});
