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

	var TAG_TYPE = 'tag';
	var TEXT_TYPE = 'text';
	var COMMENT_TYPE = 'comment';
	var KEYWORD_TYPE = 'keyword';

	var ENTER_CODE = 10; // "\n"
	var SPACE_CODE = 32; // " "
	var DOT_CODE = 46; // "."
	var COMMA_CODE = 44; // ","
	var PIPE_CODE = 124; // "|"
	var SLASH_CODE = 47; // "/"
	var QUOTE_CODE = 34; // >>"<<
	var ASTERISK_CODE = 42;
	var OPEN_BRACE_CODE = 123; // "{"
	var OPEN_BRACKET_CODE = 91; // "["
	var CLOSE_BRACKET_CODE = 93; // "]"
	var CLOSE_PARENTHESIS_CODE = 41; // ")"

	var KEYWORDS = {
		'if': 1,
		'else': 1,
		'for': 1
	};

	var NAME_STOPPER_NEXT_STATE = {};
	NAME_STOPPER_NEXT_STATE[DOT_CODE] = 'class_name';
	NAME_STOPPER_NEXT_STATE[PIPE_CODE] = 'entry_text';
	NAME_STOPPER_NEXT_STATE[SPACE_CODE] = 'entry_group';
	NAME_STOPPER_NEXT_STATE[OPEN_BRACKET_CODE] = 'inline_attr';

	var inlineAttrName;
	var inlineAttrValueState;

	var TAB_MODE = 'tab';
	var SPACE_MODE = 'space';

	var indentMode;
	var indentSize;
	var prevIndent;

	function add(parent, type, raw) {
		return parent.add(type, raw).last;
	}

	function addText(parent, value) {
		value = value.trim();
		value && add(parent, TEXT_TYPE, {value: value});
	}

	function addComment(parent, value) {
		add(parent, COMMENT_TYPE, {value: value.trim()});
	}

	function addEntry(parent, name) {
		return add(parent, TAG_TYPE, {name: name, attrs: {}});
	}

	function addKeyword(parent, name) {
		return add(parent, KEYWORD_TYPE, {name: name, attrs: {}});
	}

	function setAttr(bone, name, value, force) {
		var curValue = bone.raw.attrs[name];
		bone.raw.attrs[name] = force ? value : (curValue ? curValue + ' ' : '') + value;
	}

	function addClassName(lex, bone) {
		setAttr(bone, 'class', lex.takeToken());
	}

	function setInlineAttr(lex, bone) {
		inlineAttrName = lex.takeToken();
		inlineAttrValueState = 0;
		!inlineAttrName && lex.error('Empty attribute name', bone);
		bone.raw.attrs[inlineAttrName] = true;
	}

	function closeEntry(bone, group) {
		if (group && !bone.group) {
			bone = closeEntry(bone);
		}

		bone = bone.parent;

		while (bone.shorty) {
			bone = bone.parent;
		}

		return bone;
	}

	function markAsGroup(lex, bone) {
		lex.takeChar();
		bone.group = true;
		return '';
	}

	function closeGroup(lex, bone) {
		lex.takeChar();
		return closeEntry(bone, true);
	}

	function openOrCloseGroup(lex, parent) {
		var token = lex.getToken();
		var nextParent = KEYWORDS[token] ? addKeyword(parent, token) : addEntry(parent, token);

		if (lex.code === OPEN_BRACE_CODE) {
			markAsGroup(lex, nextParent);
			return KEYWORDS[token] ? [nextParent, 'keyword_' + token] : nextParent;
		} else {
			return closeGroup(lex, nextParent);
		}
	}

	function parseJS(lex, stopper) {
		var start = lex.idx;
		var end;
		var code;

		expressionParser.capture(lex, {
			onpeek: function (lex, bone) {
				end = lex.idx;
				code = lex.code;
				return !(bone.type === '#root' && lex.code === stopper);
			}
		});
		lex.code = code;

		return lex.input.substring(start, end).trim();
	}

	function parseJSArg(lex, skipFirstChar) {
		var start = lex.idx + 1;
		var trim = true;

		skipFirstChar && lex.skip(1);

		expressionParser.varName.capture(lex, {
			onpeek: function (lex) {
				if (trim && lex.code === SPACE_CODE) {
					return;
				} else {
					trim = false;
					return !(lex.code === SPACE_CODE || lex.code === COMMA_CODE);
				}
			}
		});

		lex.rewind(-1);

		return lex.input.substring(start, lex.idx + 1).trim();
	}

	function next(state) {
		if (typeof state === 'string') {
			return function (lex, bone) {
				lex.takeChar();
				return state;
			};
		} else {
			return function (lex) {
				var retVal = state.apply(this, arguments);
				lex.takeChar();
				return retVal;
			};
		}
	}
	
	function fail(lex, bone) {
		lex.error(`Invalid character: \`${lex.getChar()}\``, bone);
	}

	// Export parser
	return skeletik({
		'$ws': [' ', '\t', '\n'],
		'$name': ['a-z', 'A-Z', '-', '_', '0-9'],
		'$var': ['a-z', 'A-Z', '_', '0-9'],
		'$name_stopper': ['.', '|', ' ', '\n', '\t', '/', '['],
		'$attr': ['a-z', 'A-Z', '-', '_', ':', '@', '0-9']
	}, {
		'': {
			'$name': 'entry',
			'.': next(function (lex, parent) {
				return [addEntry(parent, 'div'), 'class_name'];
			}),
			'/': 'comment_await',
			'|': next('text'),
			'}': closeGroup,
			'$ws': '->',
			'': fail
		},

		'entry': {
			'$name': '->',
			'$name_stopper': next(function (lex, parent) {
				var code = lex.code;
				var token = lex.takeToken().trim();

				if (code === ENTER_CODE) {
					return closeEntry(addEntry(parent, token));
				} else if (code === SLASH_CODE) {
					return [closeEntry(addEntry(parent, token)), 'comment_await'];
				} else if (KEYWORDS[token]) {
					return [addKeyword(parent, token), 'keyword_' + token];
				} else {
					var next = NAME_STOPPER_NEXT_STATE[code] || NAME_STOPPER_NEXT_STATE[SPACE_CODE];
					return [addEntry(parent, token), next];
				}
			}),
			'(': function (lex, parent) {
				var token = lex.takeToken();
				return KEYWORDS[token] ? [addKeyword(parent, token), 'keyword_' + token] : fail(lex, parent);
			},
			'{': openOrCloseGroup,
			'}': openOrCloseGroup,
			'': fail
		},

		'class_name': {
			'.': next(function (lex, bone) {
				addClassName(lex, bone);
				return 'class_name';
			}),
			'}': function (lex, bone) {
				addClassName(lex, bone);
				return closeGroup(lex, bone);
			},
			'/': 'comment_await',
			'$ws': function (lex, bone) {
				addClassName(lex, bone);
				return lex.code === ENTER_CODE ? closeEntry(bone) : 'entry_group';
			}
		},

		'entry_group': {
			'{': markAsGroup,
			'}': closeGroup,
			'>': next(function (lex, bone) { bone.shorty = true; }),
			'+': next(function (lex, bone) { return bone.parent; }),
			'|': next('entry_text'),
			'/': function (lex, bone) {
				return [closeEntry(bone), 'comment_await'];
			},
			'\n': function (lex, bone) {
				return closeEntry(bone);
			},
			'$ws': '->',
			'': fail
		},

		'inline_attr': {
			']': next(function (lex, bone) {
				setInlineAttr(lex, bone);
				return lex.peek(+1) === OPEN_BRACKET_CODE ? 'inline_attr' : 'entry_group';
			}),
			'=': next(function (lex, bone) {
				setInlineAttr(lex, bone);
				return lex.peek(+1) === QUOTE_CODE ? 'inline_attr_value' : fail(lex, bone);
			}),
			' ': fail,
			'': '->'
		},

		'inline_attr_value': {
			'"': function (lex, bone) {
				if (inlineAttrValueState && (lex.prevCode !== SLASH_CODE)) {
					setAttr(bone, inlineAttrName, lex.takeToken(+1), true);

					if (lex.peek(+1) === CLOSE_BRACKET_CODE) {
						lex.takeChar();
						lex.takeChar();
						return 'inline_attr_next';
					} else {
						return fail(lex, bone);
					}
				} else {
					inlineAttrValueState = 1;
				}

				return 'inline_attr_value';
			},
			'\n': fail,
			'': '->'
		},

		'inline_attr_next': {
			'[': next('inline_attr'),
			'{': markAsGroup,
			'}': closeGroup,
			'\n': function (lex, bone) {
				return closeEntry(bone);
			},
			' ': next('entry_group'),
			'': fail
		},

		'comment_await': {
			'*': next('multi_comment'),
			'/': next('comment'),
			'': fail
		},

		'entry_text': {
			'\n': next(function (lex, bone) {
				addText(bone, lex.takeToken());
				return closeEntry(bone);
			})
		},

		'comment': {
			'\n': function (lex, parent) {
				addComment(parent, lex.takeToken());
			}
		},

		'multi_comment': {
			'/': function (lex, parent) {
				if (lex.prevCode === ASTERISK_CODE) {
					addComment(parent, lex.takeToken(0, +1).slice(0, -2));
				} else {
					return '->';
				}
			}
		},

		'text': {
			'\n': next(function (lex, parent) {
				addText(parent, lex.takeToken(+1));
			})
		},

		'keyword_if': {
			'(': function (lex, bone) {
				lex.takeChar();
				bone.raw.attrs.test = parseJS(lex, CLOSE_PARENTHESIS_CODE);
				lex.takeChar();
				return 'keyword_end';
			},
			' ': '->',
			'': fail
		},

		'keyword_else': {
			'__events': {
				start: function (lex, bone) {
					var raw = bone.prev.raw;

					if (!(raw.name === 'if' || raw.name === 'else' && raw.attrs.test)) {
						lex.error('Unexpected token else', bone);
					}
				}
			},
			' ': '->',
			'': function (lex) {
				var token = lex.getToken();

				if (token === ' if') {
					lex.rewind(-1);
					return 'keyword_if';
				} else if (' if'.substr(0, token.length) === token) {
					return '->';
				} else {
					lex.rewind(-2);
					return 'keyword_end';
				}
			}
		},

		'keyword_for': {
			'(': function (lex, bone) {
				bone.raw.attrs.as = parseJSArg(lex, true);
				return 'keyword_for_data';
			},
			'': fail
		},

		'keyword_for_data': {
			' ': '|->',
			'': function (lex, bone) {
				var token = lex.getToken(0, +1).trim();

				if (token === 'i') {
					return '->';
				} else if (token === 'in') {
					bone.raw.attrs.data = parseJS(lex, CLOSE_PARENTHESIS_CODE);
					return 'keyword_end';
				}

				fail(lex, bone);
			}
		},

		'keyword_end': {
			' ': '->',
			'{': markAsGroup,
			'\n': '',
			'': fail
		}
	}, {
		onstart: function () {
			indentMode = void 0;
			prevIndent = 0;
		},

		onend: function (lex, bone) {
			if (indentMode) {
				while (bone.type !== '#root') {
					bone = bone.parent;
				}
			}

			if (bone.type !== '#root') {
				lex.error(bone.raw.name + ' not closing');
			}

			return bone;
		},

		onindent: function (lex, bone) {
			if (lex.indent.tab && lex.indent.space) {
				lex.error('Mixed spaces and tabs');
			}

			var mode = lex.indent.tab ? TAB_MODE : (lex.indent.space ? SPACE_MODE : indentMode);

			if (indentMode === void 0) {
				indentMode = mode;
				indentSize = lex.indent[mode];
			} else if (mode !== indentMode) {
				lex.error('Expected indentation with ' + indentMode + ' character', bone, -1);
			}

			if (mode !== void 0) {
				var indent = lex.indent[mode] / indentSize;
				var delta = indent - prevIndent;

				if (indent !== (indent|0) || (delta > 1)) {
					lex.error(
						'Expected indentation of ' +
						indentSize * (indent|0) +
						' ' +
						mode +
						' characters but found ' +
						lex.indent[mode] +
						'.',
						bone,
						-1
					);
				}

				prevIndent = indent;

				if (lex.state !== 'multi_comment') {
					if (delta === 1 && !bone.group) {
						bone = bone.last;
					} else if (delta < 0){
						if (bone.group) {
							(delta < -1) && lex.error('Wrong indent'); // todo: нормальную ошибку
						} else {
							while (delta++) {
								bone = bone.parent;

								if (bone === void 0) {
									lex.error('An error occurred while closing tags');
								}
							}
						}
					}

					return bone;
				}
			}
		}
	});
});
