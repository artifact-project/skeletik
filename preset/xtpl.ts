import skeletik, {Lexer, Bone, SkeletikParser} from '../skeletik';
import expressionParser from './expression';

export interface XBone extends Bone {
	group?:boolean;
	shorty?:boolean;
}

// Bone types
export const DTD_TYPE = 'dtd';
export const TAG_TYPE = 'tag';
export const TEXT_TYPE = 'text';
export const COMMENT_TYPE = 'comment';
export const KEYWORD_TYPE = 'keyword';
export const HIDDEN_CLASS_TYPE = 'hidden:class';

// Codes
const ENTER_CODE = 10; // "\n"
const SPACE_CODE = 32; // " "
const DOT_CODE = 46; // "."
const COMMA_CODE = 44; // ","
const PIPE_CODE = 124; // "|"
const SLASH_CODE = 47; // "/"
const QUOTE_CODE = 34; // >>"<<
const ASTERISK_CODE = 42; // "*"
const OPEN_BRACE_CODE = 123; // "{"
const CLOSE_BRACE_CODE = 125; // "}"
const OPEN_BRACKET_CODE = 91; // "["
const CLOSE_BRACKET_CODE = 93; // "]"
const CLOSE_PARENTHESIS_CODE = 41; // ")"
const HASHTAG_CODE = 35; // "#"

const KEYWORDS = {};
let _keyword;

const NEXT_STATE_KEYWORD = '>KEYWORD';
const NEXT_STATE_ENTRY_GROUP = 'entry_group';
const NEXT_STATE_COMMENT_AWAIT = 'comment_await';
const NEXT_STATE_ID_OR_CLASS = 'id_or_class';
const NEXT_STATE_INLINE_ATTR = 'inline_attr';

const NAME_STOPPER_NEXT_STATE = {};

NAME_STOPPER_NEXT_STATE[DOT_CODE] = NEXT_STATE_ID_OR_CLASS;
NAME_STOPPER_NEXT_STATE[HASHTAG_CODE] = NEXT_STATE_ID_OR_CLASS;

NAME_STOPPER_NEXT_STATE[PIPE_CODE] = 'text';
NAME_STOPPER_NEXT_STATE[SPACE_CODE] = NEXT_STATE_ENTRY_GROUP;
NAME_STOPPER_NEXT_STATE[OPEN_BRACKET_CODE] = NEXT_STATE_INLINE_ATTR;

const TAB_MODE = 'tab';
const SPACE_MODE = 'space';

let shortAttrType:number;
let inlineAttrName:string;
let indentMode:string;
let indentSize:number;
let prevIndent:number;

function add(parent:Bone, type:string, raw?:any):Bone {
	return parent.add(type, raw).last;
}

function addText(parent:Bone, value:string):void {
	value = value.trim();
	value && add(parent, TEXT_TYPE, {value: value});
}

function addComment(parent:Bone, value:string):void {
	add(parent, COMMENT_TYPE, {value: value.trim()});
}

function addEntry(parent:Bone, name:string):Bone {
	return add(parent, TAG_TYPE, {name: name, attrs: {}});
}

function addKeyword(parent:Bone, name:string):Bone {
	return add(parent, KEYWORD_TYPE, {name: name, attrs: {}});
}

function setAttr(bone:Bone, name:string, value:string, glue?:string):void {
	const curValue = bone.raw.attrs[name];
	const newValue = arguments.length === 4 ? (curValue ? curValue + glue : '') + value : value;

	bone.raw.attrs[name] = newValue;
}

function setShortAttrValue(lex:Lexer, bone:Bone):void {
	let token = lex.takeToken();

	if (shortAttrType === DOT_CODE && /^[&%]/.test(token)) {
		token = bone.parent.raw.attrs.class.split(' ').pop() + token.substr(1);
	}

	setAttr(bone, shortAttrType === DOT_CODE ? 'class' : 'id', token, ' ');
}

function setInlineAttr(lex:Lexer, bone:Bone):void {
	inlineAttrName = lex.takeToken();
	!inlineAttrName && lex.error('Empty attribute name', bone);
	bone.raw.attrs[inlineAttrName] = true;
}

function closeEntry(bone:Bone, group?:boolean, shorty?:boolean):Bone {
	if (group && !(bone as XBone).group) {
		bone = closeEntry(bone);
	}

	bone = bone.parent;

	if (shorty && bone) {
		while ((bone as XBone).shorty) {
			bone = bone.parent;
		}
	}

	return bone;
}

function markAsGroup(lex:Lexer, bone:Bone):string {
	(bone as XBone).group = true;
	return '';
}

function closeGroup(lex:Lexer, bone:Bone):Bone {
	return closeEntry(bone, true);
}

function openOrCloseGroup(lex:Lexer, parent:Bone):Bone|[Bone,string] {
	var token = lex.getToken();
	var nextParent = (KEYWORDS[token] ? addKeyword : addEntry)(parent, token);

	if (lex.code === OPEN_BRACE_CODE) {
		markAsGroup(lex, nextParent);
		return KEYWORDS[token] ? [nextParent, keywords.start(token)] : nextParent;
	} else {
		return closeGroup(lex, nextParent);
	}
}

export function parseJS(lex:Lexer, stopper:number) {
	const start = lex.idx;
	let offset = 0;

	// Валидируем выражение
	expressionParser.capture(lex, {
		onpeek: function (lex, bone) {
			offset = lex.code === stopper ? 0 : 1;
			return !(bone.type === '#root' && (lex.code === stopper || lex.prevCode === stopper));
		}
	});

	return lex.input.substring(start, lex.idx - offset).trim();
}

function fail(lex:Lexer, bone?:Bone):void {
	lex.error(`Invalid character: \`${lex.getChar()}\``, bone);
}

// Create parser
export default <SkeletikParser>skeletik({
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
		'$id_or_class': (lex:Lexer, parent:Bone):[Bone,string] => {
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
		'\n': (lex, bone) => { add(bone, DTD_TYPE, {value: lex.takeToken()}); }
	},

	'entry': {
		'$name': '->',
		'$name_stopper': (lex:Lexer, parent:Bone):Bone|[Bone, string] => {
			const code:number = lex.code;
			const token:string = lex.takeToken();

			if (code === ENTER_CODE) {
				return closeEntry(addEntry(parent, token));
			} else if (code === SLASH_CODE) {
				return [closeEntry(addEntry(parent, token)), NEXT_STATE_COMMENT_AWAIT];
			} else if (KEYWORDS[token]) {
				return [addKeyword(parent, token), keywords.start(token)];
			} else {
				const next:string = NAME_STOPPER_NEXT_STATE[code] || NAME_STOPPER_NEXT_STATE[SPACE_CODE];
				shortAttrType = code;
				return [addEntry(parent, token), next];
			}
		},
		'(': (lex:Lexer, parent:Bone) => {
			const token = lex.takeToken();
			!KEYWORDS[token] && fail(lex, parent);
			return [addKeyword(parent, token), keywords.start(token)];
		},
		'{': openOrCloseGroup,
		'}': openOrCloseGroup,
		'': fail
	},

	'hidden_class': {
		'$ws': (lex, bone) => {
			shortAttrType = DOT_CODE;
			bone = add(bone, HIDDEN_CLASS_TYPE, {attrs: {}});
			setShortAttrValue(lex, bone);
			return [bone, '>entry_group'];
		} 
	},

	'id_or_class': {
		'$id_or_class': (lex, bone) => {
			setShortAttrValue(lex, bone);
			shortAttrType = lex.code;
			return '-->';
		},
		'[': (lex, bone) => {
			setShortAttrValue(lex, bone);
			return NEXT_STATE_INLINE_ATTR;
		},
		'}': (lex, bone) => {
			setShortAttrValue(lex, bone);
			return closeGroup(lex, bone);
		},
		'/': (lex, bone) => {
			setShortAttrValue(lex, bone);
			return [closeEntry(bone), NEXT_STATE_COMMENT_AWAIT];
		},
		'$ws': (lex, bone) => {
			setShortAttrValue(lex, bone);
			return lex.code === ENTER_CODE ? closeEntry(bone) : NEXT_STATE_ENTRY_GROUP;
		}
	},

	'entry_group': {
		'{': markAsGroup,
		'}': closeGroup,
		'>': (lex, bone) => { (bone as XBone).shorty = true; },
		'+': (lex, bone) => bone.parent,
		'|': 'text',
		'/': (lex, bone) => [closeEntry(bone), NEXT_STATE_COMMENT_AWAIT],
		'\n': (lex, bone) => closeEntry(bone),
		'$ws': '->',
		'': fail
	},

	'inline_attr': {
		']': (lex, bone) => {
			setInlineAttr(lex, bone);
			return lex.peek(+1) === OPEN_BRACKET_CODE ? NEXT_STATE_INLINE_ATTR : NEXT_STATE_ENTRY_GROUP;
		},
		'=': (lex, bone) => {
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
		'"': (lex, bone) => {
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
		'\n': (lex, bone) => closeEntry(bone),
		' ': NEXT_STATE_ENTRY_GROUP,
		'': fail
	},

	'comment_await': {
		'*': 'multi_comment',
		'/': 'comment',
		'': fail
	},

	'comment': {
		'\n': (lex, parent) => { addComment(parent, lex.takeToken()); }
	},

	'multi_comment': {
		'/': (lex, parent) => {
			if (lex.prevCode === ASTERISK_CODE) {
				addComment(parent, lex.takeToken(0, -1));
			} else {
				return '->';
			}
		}
	},

	'text': {
		'\n': (lex, bone) => {
			addText(bone, lex.takeToken());
			return (bone as XBone).group ? bone : closeEntry(bone, false, true);
		}
	},

	'KEYWORD': {
		'': (lex, bone) => _keyword.parse(lex, bone)
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
		'': (lex, bone) => _keyword.attr(bone, lex.takeToken())
	},

	'KW_TYPE:js': {
		'': (lex, bone) => _keyword.attr(bone, parseJS(lex, CLOSE_PARENTHESIS_CODE))
	}
}, {
	onstart: () => {
		indentMode = void 0;
		prevIndent = 0;
	},

	onend: (lex, bone) => {
		if (indentMode || (bone as XBone).shorty) {
			while (bone.type !== '#root') {
				bone = bone.parent;
				
				while ((bone as XBone).shorty) {
					bone = bone.parent;
				}
			}
		}

		if (bone.type !== '#root') {
			lex.error(bone.raw.name + ' not closing');
		}

		return bone;
	},

	onindent: (lex, bone) => {
		if (lex.code === ENTER_CODE) {
			return;
		}

		if (lex.indent.tab && lex.indent.space) {
			lex.error('Mixed spaces and tabs');
		}

		const mode = lex.indent.tab ? TAB_MODE : (lex.indent.space ? SPACE_MODE : indentMode);

		if (indentMode === void 0) {
			indentMode = mode;
			indentSize = lex.indent[mode];
		} else if (mode !== indentMode) {
			lex.error('Expected indentation with ' + indentMode + ' character', bone, -1);
		}

		if (mode !== void 0) {
			const indent = lex.indent[mode] / indentSize;
			let delta = indent - prevIndent;

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
				if (delta === 1 && !(bone as XBone).group) {
					bone = bone.last;
				} else if (delta < 0){
					if ((bone as XBone).group) {
						(delta < -1) && lex.error('Wrong indent'); // todo: нормальную ошибку
					} else {
						while (delta++) {
							bone = bone.parent;

							while ((bone as XBone).shorty) {
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

export const keywords = (function () {
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
			'': (lex, bone) => { bone.raw.push(lex.code); },
		},

		'attr': {
			':': (lex, bone) => {
				_attr = lex.takeToken();
				return 'attr:type';
			}
		},

		'attr:type': {
			'$name': '->',
			'': (lex, bone) => {
				bone.raw.push({attr: _attr, type: lex.takeToken()});
				return '>';
			}
		}
	}, {
		onstart: (lex, bone) => { bone.raw = []; }
	});

	return {
		start(name:string):string {
			_name = name;
			_cursor = 0;
			_keyword = KEYWORDS[name];
			_variant = 0;

			return NEXT_STATE_KEYWORD;
		},

		add(name:string, details:string|string[], options?:any) {
			const variants:Array<any[]> = [].concat(details).map((value) => parse(value).raw.slice(0, -1));
			const maxVariants = variants.length;

			options = options || {};

			KEYWORDS[name] = {
				attr(bone:Bone, value:string) {
					bone.raw.attrs[_attr] = value;
					return NEXT_STATE_KEYWORD;
				},

				parse(lex:Lexer) {
					const code = lex.code;
					const seqCode = variants[_variant][_cursor];
					const prevSeqCode = variants[_variant][_cursor];

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
					} else if (code === SPACE_CODE && prevSeqCode === SPACE_CODE) {
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
keywords.add('if', ' ( @test:js )');

keywords.add('else', ' if ( @test:js )', {
	optional: true,
	validate: function (lex, bone) {
		var raw = bone.prev.raw;

		if (!(raw.name === 'if' || raw.name === 'else' && raw.attrs.test)) {
			lex.error('Unexpected token else', bone);
		}
	}
});

keywords.add('for', [
	' ( @as:var in @data:js )',
	' ( [ @key:var , @as:var ] in @data:js )'
]);
