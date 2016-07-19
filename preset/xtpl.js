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

	var DTD_TYPE = 'dtd';
	var TAG_TYPE = 'tag';
	var TEXT_TYPE = 'text';
	var COMMENT_TYPE = 'comment';
	var KEYWORD_TYPE = 'keyword';
	var HIDDEN_CLASS_TYPE = 'hidden:class';

	var ENTER_CODE = 10; // "\n"
	var SPACE_CODE = 32; // " "
	var DOT_CODE = 46; // "."
	var COMMA_CODE = 44; // ","
	var PIPE_CODE = 124; // "|"
	var SLASH_CODE = 47; // "/"
	var QUOTE_CODE = 34; // >>"<<
	var ASTERISK_CODE = 42; // "*"
	var OPEN_BRACE_CODE = 123; // "{"
	var CLOSE_BRACE_CODE = 125; // "}"
	var OPEN_BRACKET_CODE = 91; // "["
	var CLOSE_BRACKET_CODE = 93; // "]"
	var CLOSE_PARENTHESIS_CODE = 41; // ")"
	var HASHTAG_CODE = 35; // "#"

	var KEYWORDS = {};
	var _keyword;

	var NEXT_STATE_KEYWORD = '>KEYWORD';
	var NEXT_STATE_ENTRY_GROUP = 'entry_group';
	var NEXT_STATE_COMMENT_AWAIT = 'comment_await';
	var NEXT_STATE_ID_OR_CLASS = 'id_or_class';
	var NEXT_STATE_INLINE_ATTR = 'inline_attr';

	var NAME_STOPPER_NEXT_STATE = {};
	
	NAME_STOPPER_NEXT_STATE[DOT_CODE] = NEXT_STATE_ID_OR_CLASS;
	NAME_STOPPER_NEXT_STATE[HASHTAG_CODE] = NEXT_STATE_ID_OR_CLASS;

	NAME_STOPPER_NEXT_STATE[PIPE_CODE] = 'text';
	NAME_STOPPER_NEXT_STATE[SPACE_CODE] = NEXT_STATE_ENTRY_GROUP;
	NAME_STOPPER_NEXT_STATE[OPEN_BRACKET_CODE] = NEXT_STATE_INLINE_ATTR;

	var TAB_MODE = 'tab';
	var SPACE_MODE = 'space';

	var shortAttrType;
	var inlineAttrName;
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

	function setAttr(bone, name, value, glue) {
		var curValue = bone.raw.attrs[name];
		var newValue = arguments.length === 4 ? (curValue ? curValue + glue : '') + value : value;

		bone.raw.attrs[name] = newValue;
	}

	function setShortAttrValue(lex, bone) {
		var token = lex.takeToken();

		if (shortAttrType === DOT_CODE && /^[&%]/.test(token)) {
			token = bone.parent.raw.attrs.class.split(' ').pop() + token.substr(1);
		}

		setAttr(bone, shortAttrType === DOT_CODE ? 'class' : 'id', token, ' ');
	}

	function setInlineAttr(lex, bone) {
		inlineAttrName = lex.takeToken();
		!inlineAttrName && lex.error('Empty attribute name', bone);
		bone.raw.attrs[inlineAttrName] = true;
	}

	function closeEntry(bone, group, shorty) {
		if (group && !bone.group) {
			bone = closeEntry(bone);
		}

		bone = bone.parent;

		if (shorty && bone) {
			while (bone.shorty) {
				bone = bone.parent;
			}
		}

		return bone;
	}

	function markAsGroup(lex, bone) {
		bone.group = true;
		return '';
	}

	function closeGroup(lex, bone) {
		return closeEntry(bone, true);
	}

	function openOrCloseGroup(lex, parent) {
		var token = lex.getToken();
		var nextParent = (KEYWORDS[token] ? addKeyword : addEntry)(parent, token);

		if (lex.code === OPEN_BRACE_CODE) {
			markAsGroup(lex, nextParent);
			return KEYWORDS[token] ? [nextParent, parser.keyword.start(token)] : nextParent;
		} else {
			return closeGroup(lex, nextParent);
		}
	}

	function parseJS(lex, stopper) {
		var start = lex.idx;
		var offset = 0;

		// Валидируем выражение
		expressionParser.capture(lex, {
			onpeek: function (lex, bone) {
				offset = lex.code === stopper ? 0 : 1;
				return !(bone.type === '#root' && (lex.code === stopper || lex.prevCode === stopper));
			}
		});

		return lex.input.substring(start, lex.idx - offset).trim();
	}

	function fail(lex, bone) {
		lex.error(`Invalid character: \`${lex.getChar()}\``, bone);
	}

	// Create parser
	var parser = skeletik({
		'$ws': [' ', '\t', '\n'],
		'$id_or_class': ['.', '#'],
		'$name': ['a-z', 'A-Z', '-', '_', '0-9'],
		'$name_stopper': ['.', '#', '|', ' ', '\n', '\t', '/', '['],
		'$attr': ['a-z', 'A-Z', '-', '_', ':', '@', '0-9'],
		'$var_name_start': ['_', 'a-z', 'A-Z'],
		'$var_name_next': ['_', 'a-z', 'A-Z', '0-9']
	}, {
		'': {
			'!': 'dtd',
			'$name': '!entry',
			'$id_or_class': function (lex, parent) {
				shortAttrType = lex.code;
				return [addEntry(parent, 'div'), NEXT_STATE_ID_OR_CLASS];
			},
			'/': NEXT_STATE_COMMENT_AWAIT,
			'|': 'text',
			'}': closeGroup,
			'$ws': '->',
			'%': '!hidden_class',
			'': fail
		},

		'dtd': {
			'\n': function (lex, bone) {
				add(bone, DTD_TYPE, {value: lex.takeToken()});
			}
		},

		'entry': {
			'$name': '->',
			'$name_stopper': function (lex, parent) {
				var code = lex.code;
				var token = lex.takeToken();

				if (code === ENTER_CODE) {
					return closeEntry(addEntry(parent, token));
				} else if (code === SLASH_CODE) {
					return [closeEntry(addEntry(parent, token)), NEXT_STATE_COMMENT_AWAIT];
				} else if (KEYWORDS[token]) {
					return [addKeyword(parent, token), parser.keyword.start(token)];
				} else {
					var next = NAME_STOPPER_NEXT_STATE[code] || NAME_STOPPER_NEXT_STATE[SPACE_CODE];
					shortAttrType = code;
					return [addEntry(parent, token), next];
				}
			},
			'(': function (lex, parent) {
				var token = lex.takeToken();
				return KEYWORDS[token] ? [addKeyword(parent, token), parser.keyword.start(token)] : fail(lex, parent);
			},
			'{': openOrCloseGroup,
			'}': openOrCloseGroup,
			'': fail
		},

		'hidden_class': {
			'$ws': function (lex, bone) {
				shortAttrType = DOT_CODE;
				bone = add(bone, HIDDEN_CLASS_TYPE, {attrs: {}});
				setShortAttrValue(lex, bone);
				return [bone, '>entry_group'];
			} 
		},

		'id_or_class': {
			'$id_or_class': function (lex, bone) {
				setShortAttrValue(lex, bone);
				shortAttrType = lex.code;
				return '-->';
			},
			'[': function (lex, bone) {
				setShortAttrValue(lex, bone);
				return NEXT_STATE_INLINE_ATTR;
			},
			'}': function (lex, bone) {
				setShortAttrValue(lex, bone);
				return closeGroup(lex, bone);
			},
			'/': function (lex, bone) {
				setShortAttrValue(lex, bone);
				return [closeEntry(bone), NEXT_STATE_COMMENT_AWAIT];
			},
			'$ws': function (lex, bone) {
				setShortAttrValue(lex, bone);
				return lex.code === ENTER_CODE ? closeEntry(bone) : NEXT_STATE_ENTRY_GROUP;
			}
		},

		'entry_group': {
			'{': markAsGroup,
			'}': closeGroup,
			'>': function (lex, bone) { bone.shorty = true; },
			'+': function (lex, bone) { return bone.parent; },
			'|': 'text',
			'/': function (lex, bone) {
				return [closeEntry(bone), NEXT_STATE_COMMENT_AWAIT];
			},
			'\n': function (lex, bone) {
				return closeEntry(bone);
			},
			'$ws': '->',
			'': fail
		},

		'inline_attr': {
			']': function (lex, bone) {
				setInlineAttr(lex, bone);
				return lex.peek(+1) === OPEN_BRACKET_CODE ? NEXT_STATE_INLINE_ATTR : NEXT_STATE_ENTRY_GROUP;
			},
			'=': function (lex, bone) {
				setInlineAttr(lex, bone);
				return 'inline_attr_value_await';
			},
			'$ws': fail,
			'': '->'
		},

		'inline_attr_value_await': {
			'"': 'inline_attr_value',
			'': fail
		},

		'inline_attr_value': {
			'"': function (lex, bone) {
				if (lex.prevCode !== SLASH_CODE) {
					setAttr(bone, inlineAttrName, lex.takeToken());
					return 'inline_attr_value_end';
				}

				return '->';
			},
			'\n': fail,
			'': '->'
		},

		'inline_attr_value_end': {
			']': 'inline_attr_next',
			'': fail
		},

		'inline_attr_next': {
			'[': NEXT_STATE_INLINE_ATTR,
			'{': markAsGroup,
			'}': closeGroup,
			'\n': function (lex, bone) {
				return closeEntry(bone);
			},
			' ': NEXT_STATE_ENTRY_GROUP,
			'': fail
		},

		'comment_await': {
			'*': 'multi_comment',
			'/': 'comment',
			'': fail
		},

		'comment': {
			'\n': function (lex, parent) {
				addComment(parent, lex.takeToken());
			}
		},

		'multi_comment': {
			'/': function (lex, parent) {
				if (lex.prevCode === ASTERISK_CODE) {
					addComment(parent, lex.takeToken(0, -1));
				} else {
					return '->';
				}
			}
		},

		'text': {
			'\n': function (lex, bone) {
				addText(bone, lex.takeToken());
				return bone.group ? bone : closeEntry(bone, false, true);
			}
		},

		'KEYWORD': {
			'': function (lex, bone) {
				return _keyword.parse(lex, bone);
			}
		},

		'KEYWORD_END': {
			' ': '->',
			'{': markAsGroup,
			'\n': '',
			'': fail
		},

		'KW_TYPE:var': {
			'$var_name_start': '>KW_TYPE_NEXT:var',
			'': fail
		},
		
		'KW_TYPE_NEXT:var': {
			'$var_name_next': '->',
			'': function (lex, bone) {
				return _keyword.attr(bone, lex.takeToken());
			}
		},

		'KW_TYPE:js': {
			'': function (lex, bone) {
				return _keyword.attr(bone, parseJS(lex, CLOSE_PARENTHESIS_CODE));
			}
		}
	}, {
		onstart: function () {
			indentMode = void 0;
			prevIndent = 0;
		},

		onend: function (lex, bone) {
			if (indentMode || bone.shorty) {
				while (bone.type !== '#root') {
					bone = bone.parent;
					
					while (bone.shorty) {
						bone = bone.parent;
					}
				}
			}

			if (bone.type !== '#root') {
				lex.error(bone.raw.name + ' not closing');
			}

			return bone;
		},

		onindent: function (lex, bone) {
			if (lex.code === ENTER_CODE) {
				return;
			}

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

								while (bone.shorty) {
									bone = bone.parent;
								}

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

	parser.keyword = (function () {
		var _name;
		var _attr;
		var _cursor;
		var _variant;

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

		return {
			start: function (name) {
				_name = name;
				_cursor = 0;
				_keyword = KEYWORDS[name];
				_variant = 0;

				return NEXT_STATE_KEYWORD;
			},

			add: function (name, details, options) {
				var variants = [].concat(details).map(function (value) {
					return parse(value).raw.slice(0, -1);
				});
				var maxVariants = variants.length;

				options = options || {};

				KEYWORDS[name] = {
					attr: function (bone, value) {
						bone.raw.attrs[_attr] = value;
						return NEXT_STATE_KEYWORD;
					},

					parse: function (lex) {
						var code = lex.code;
						var seqCode = variants[_variant][_cursor];

						if (
							(seqCode === void 0) ||
							((code === OPEN_BRACE_CODE || code === ENTER_CODE) && options.optional)
						) {
							// Конец, либо необязательно
							return '>KEYWORD_END' 
						} else if (code === seqCode) {
							_cursor++;
						} else if (seqCode === SPACE_CODE) {
							_cursor++;
							return NEXT_STATE_KEYWORD;
						} else if (code === SPACE_CODE && seq[_cursor - 1] === SPACE_CODE) {
							// Продолжаем пропускать пробелы
						} else {
							if (maxVariants - _variant > 1) {
								for (var i = _variant; i < maxVariants; i++) {
									if (variants[i][_cursor] === code) {
										_variant = i;
										return this.parse(lex);
									}
								}
							}

							if (seqCode.attr) {
								_attr = seqCode.attr; 
								_cursor++;

								return '>KW_TYPE:' + seqCode.type;
							} else {
								fail(lex);
							}
						}

						return '-->';
					}
				};
			}
		}
	})();

	// Define keywords
	parser.keyword.add('if', ' ( @test:js )');
	
	parser.keyword.add('else', ' if ( @test:js )', {
		optional: true,
		validate: function (lex, bone) {
			var raw = bone.prev.raw;

			if (!(raw.name === 'if' || raw.name === 'else' && raw.attrs.test)) {
				lex.error('Unexpected token else', bone);
			}
		}
	});

	parser.keyword.add('for', [
		' ( @as:var in @data:js )',
		' ( [ @key:var , @as:var ] in @data:js )'
	]);

	parser.DTD_TYPE = DTD_TYPE;
	parser.TAG_TYPE = TAG_TYPE;
	parser.TEXT_TYPE = TEXT_TYPE;
	parser.COMMENT_TYPE = COMMENT_TYPE;
	parser.KEYWORD_TYPE = KEYWORD_TYPE;
	parser.HIDDEN_CLASS_TYPE = HIDDEN_CLASS_TYPE;

	// Export parser
	return parser;
});
