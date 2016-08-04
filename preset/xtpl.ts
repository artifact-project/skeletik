import skeletik, {Lexer, Bone, SkeletikParser} from '../skeletik';
import expressionParser from './expression';

export interface XBone extends Bone {
	group?:boolean;
	shorty?:boolean;
}

// Bone types
export const ROOT_TYPE = '#root';
export const DTD_TYPE = 'dtd';
export const TAG_TYPE = 'tag';
export const TEXT_TYPE = 'text';
export const COMMENT_TYPE = 'comment';
export const KEYWORD_TYPE = 'keyword';
export const HIDDEN_CLASS_TYPE = 'hidden:class';
export const DEFINE_TYPE = 'define';
export const CALL_TYPE = 'call';
export const EXPRESSION_TYPE = 'expression';

// Codes
const ENTER_CODE = 10; // "\n"
const SPACE_CODE = 32; // " "
const DOT_CODE = 46; // "."
const COMMA_CODE = 44; // ","
const PIPE_CODE = 124; // "|"
const SLASH_CODE = 47; // "/"
const BACKSLASH_CODE = 92; // "\"
const ASTERISK_CODE = 42; // "*"
const OPEN_BRACE_CODE = 123; // "{"
const CLOSE_BRACE_CODE = 125; // "}"
const OPEN_BRACKET_CODE = 91; // "["
const CLOSE_BRACKET_CODE = 93; // "]"
const OPEN_PARENTHESIS_CODE = 40; // "("
const CLOSE_PARENTHESIS_CODE = 41; // ")"
const HASHTAG_CODE = 35; // "#"
const EQUAL_CODE = 61; // "="
const GT_CODE = 62; // ">"
const PLUS_CODE = 43; // "+"

const KEYWORDS = {};
let _keyword;

const ENTRY_GROUP_STATE = 'entry_group';
const COMMENT_AWAIT_STATE = 'comment_await';
const ID_OR_CLASS_STATE = 'id_or_class';
const INLINE_ATTR_STATE = 'inline_attr';

const TO_KEYWORD_STATE = '>KEYWORD';
const TO_ENTRY_GROUP_STATE = `>${ENTRY_GROUP_STATE}`;

const STOPPER_TO_STATE = {
	[ENTER_CODE]: {
		close: true
	},
	
	[SLASH_CODE]: {
		to: COMMENT_AWAIT_STATE,
		close: true,
	},

	[DOT_CODE]: (token) => (token === 'class') ? {add: false, to: 'class_attr'} : {to: ID_OR_CLASS_STATE},
	
	[HASHTAG_CODE]: ID_OR_CLASS_STATE,

	[PIPE_CODE]: 'text:await',
	[OPEN_BRACKET_CODE]: INLINE_ATTR_STATE,
	[EQUAL_CODE]: DEFINE_TYPE,
	[OPEN_PARENTHESIS_CODE]: 'fn-call',

	[OPEN_BRACE_CODE]: TO_ENTRY_GROUP_STATE,
	[CLOSE_BRACE_CODE]: TO_ENTRY_GROUP_STATE,

	[GT_CODE]: TO_ENTRY_GROUP_STATE,
	[PLUS_CODE]: TO_ENTRY_GROUP_STATE,
};

const DEFINE_TYPES = {
	[OPEN_BRACE_CODE]: ['brace', CLOSE_BRACE_CODE], // {}
	[OPEN_BRACKET_CODE]: ['bracket', CLOSE_BRACKET_CODE], // []
	[OPEN_PARENTHESIS_CODE]: ['parenthesis', CLOSE_PARENTHESIS_CODE], // ()
};

const nameStoppersWithSpace = ['|', '/', '(', '>', '+', '{', '}', '=', '\n'];
const nameStoppersWithoutSpace = ['.', '#', '['];

const TAB_INDENT = 'tab';
const SPACE_INDENT = 'space';

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

function addEntry(parent:Bone, name):Bone {
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

function takeShortAttrValue(lex:Lexer, bone:Bone):void {
	const token = lex.takeToken().trim();
	const attr = shortAttrType === DOT_CODE ? 'class' : 'id';

	if (attr === 'id' && bone.raw.attrs.id) {
		lex.error('Duplicate attribute "id" is not allowed', bone);
	}

	setShortAttrValue(bone, attr, token);
}

function setShortAttrValue(bone:Bone, name:string, value:string, expression?:string, selfNesting?:boolean) {
	let newValue = value;

	if (name === 'class' && /^[&%]/.test(newValue)) {
		newValue = (selfNesting ? bone : bone.parent).raw.attrs.class.split(' ').shift() + newValue.substr(1);
	}

	if (expression) {
		newValue = `{${expression} ? "${newValue}" : ""}`;
	}

	setAttr(bone, name, newValue, ' ');
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

export function parseJS(lex:Lexer, stopper:number, initialOffset:number = 0) {
	const start = lex.idx + initialOffset;
	let offset = 0;

	// Валидируем выражение
	expressionParser.capture(lex, {
		onpeek(lex, bone) {
			offset = lex.code === stopper ? 0 : 1;
			return !(bone.type === ROOT_TYPE && (lex.code === stopper || lex.prevCode === stopper));
		}
	});

	return lex.input.substring(start, lex.idx - offset).trim();
}

export function parseJSCallArgs(lex:Lexer) {
	const args = [];
	let idx = lex.idx;

	expressionParser.capture(lex, {
		onpeek(lex, bone) {
			const exit = (bone.type === ROOT_TYPE && (lex.code === CLOSE_PARENTHESIS_CODE));

			if (exit || bone.type === ROOT_TYPE && lex.code === COMMA_CODE) {
				const token = lex.input.substring(idx, lex.idx).trim();
				token && args.push(token);
				idx = lex.idx + 1;
			}

			return !exit;
		}
	});

	return args;
}


function fail(lex:Lexer, bone?:Bone):void {
	lex.error(`Invalid character: \`${lex.getChar()}\`, state: ${lex.state}`, bone);
}

let currentExpression

function expressionMixin(getter:(bone:Bone) => any[], states) {
	states['$'] = (lex:Lexer, bone) => {
		if (lex.prevCode !== BACKSLASH_CODE && lex.peek(+1) === OPEN_BRACE_CODE) {
			const state = lex.state;
			const token = lex.takeToken();
			const expr = parseJS(lex, CLOSE_BRACE_CODE).slice(2);
			const list = getter(bone);

			token && list.push(token);
			list.push({type: EXPRESSION_TYPE, value: expr});

			return '>' + state;
		}

		return '->';
	};

	return states;
}

// Create parser
export default <SkeletikParser>skeletik({
	'$stn': [' ', '\t', '\n'],
	'$id_or_class': ['.', '#'],
	'$name': ['a-z', 'A-Z', '-', '_', '0-9'],
	'$name_stopper': nameStoppersWithoutSpace.concat(nameStoppersWithSpace),
	'$name_stopper_after_space': nameStoppersWithSpace,
	'$attr': ['a-z', 'A-Z', '-', '_', ':', '@', '0-9'],
	'$var_name_start': ['_', 'a-z', 'A-Z'],
	'$var_name_next': ['_', 'a-z', 'A-Z', '0-9'],
	'$define_type': ['[', '{', '('],
}, {
	'': {
		'$stn': '->',
		'!': 'dtd',
		'|': 'text:await',
		'/': COMMENT_AWAIT_STATE,
		'}': closeGroup,
		'$name': '!entry',
		'$id_or_class': (lex:Lexer, parent:Bone):[Bone,string] => {
			shortAttrType = lex.code;
			return [addEntry(parent, 'div'), ID_OR_CLASS_STATE];
		},
		'%': '!hidden_class',
		'$': 'var_or_tag',
		'': fail
	},

	'dtd': {
		'\n': (lex, bone) => { add(bone, DTD_TYPE, {value: lex.takeToken()}); }
	},

	'var_or_tag': {
		'{': (lex, parent) => {
			const expr = parseJS(lex, CLOSE_BRACE_CODE, 1);
			return [addEntry(parent, [{type: 'expression', value: expr}]), '>entry'];
		},
		'': fail
	},

	'entry': {
		' ': '>entry_stopper:await',
		'$name': '->',
		'$name_stopper': '>entry_stopper',
		'': fail
	},

	'entry_stopper:await': {
		' ': '->',
		'$name_stopper_after_space': '>entry_stopper',
		'': (lex, parent) => {
			const token = lex.takeToken().trim();
			return KEYWORDS[token] ? [addKeyword(parent, token), keywords.start(token)] : fail(lex, parent);
		}
	},

	'entry_stopper': {
		'': (lex:Lexer, parent:Bone):string|Bone|[Bone, string] => {
			const code = lex.code;
			const token = lex.takeToken().trim();
			let state = STOPPER_TO_STATE[code];

			switch (typeof state) {
				case 'string': state = {to: state}; break;
				case 'function': state = (state as Function)(token); break;
			}

			if (window['DEBUG'])
				debugger;

			shortAttrType = code;

			if (KEYWORDS[token]) {
				return [addKeyword(parent, token), keywords.start(token)];
			} else if (token && state.add !== false) {
				parent = addEntry(parent, token);
			}

			return [state.close ? closeEntry(parent) : parent, state.to || ''];
		}
	},

	'class_attr': {
		':': (lex, bone) => {
			inlineAttrName = lex.takeToken();
			setShortAttrValue(bone, 'class', inlineAttrName, parseJS(lex, ENTER_CODE, 1), true);
		}
	},

	'hidden_class': {
		'$name_stopper': (lex, bone) => {
			bone = add(bone, HIDDEN_CLASS_TYPE, {attrs: {}});
			setShortAttrValue(bone, 'class', lex.takeToken().trim());

			return [bone, SPACE_CODE === lex.code ? 'entry_stopper:await' : TO_ENTRY_GROUP_STATE];
		}
	},

	'id_or_class': {
		'$name_stopper': (lex, bone) => {
			const code = lex.code;
			
			takeShortAttrValue(lex, bone);
			shortAttrType = code;

			return (HASHTAG_CODE === code || DOT_CODE === code)
				? '-->'
				: (SPACE_CODE === code ? 'entry_stopper:await' : '>entry_stopper')
			;
		}
	},

	'entry_group': {
		'{': markAsGroup,
		'}': closeGroup,
		'>': (lex, bone) => { (bone as XBone).shorty = true; },
		'+': (lex, bone) => bone.parent,
		'|': 'text:await',
		'/': (lex, bone) => [closeEntry(bone), COMMENT_AWAIT_STATE],
		'\n': (lex, bone) => closeEntry(bone),
		' ': '->',
		'': (lex, bone) => {debugger}
	},

	'inline_attr': {
		']': (lex, bone) => {
			setInlineAttr(lex, bone);
			return lex.peek(+1) === OPEN_BRACKET_CODE ? INLINE_ATTR_STATE : ENTRY_GROUP_STATE;
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
		'[': INLINE_ATTR_STATE,
		' ': 'entry_stopper:await',
		'$name_stopper': TO_ENTRY_GROUP_STATE,
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

	'text:await': {
		' ': '->',
		'': (lex, parent) => {
			lex.takeChar();
			return [add(parent, TEXT_TYPE, {value: ''}), '>text'];
		},
	},

	'text': expressionMixin((bone) => {
		let value = bone.raw.value;
		(typeof value === 'string') && (bone.raw.value = value = []);
		return value;
	}, {
		'\n': (lex, bone) => {
			const token = lex.takeToken();
			const parent = bone.parent;

			if (token) {
				const value = bone.raw.value;

				if (typeof value === 'string') {
					bone.raw.value += token;
				} else {
					value.push(token);
				}
			}

			return (parent.type === ROOT_TYPE || (parent as XBone).group)
				? parent
				: closeEntry(parent, false, true);
		}
	}),

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
	},

	'define': {
		' ': '->',
		'$define_type': (lex, bone) => {
			const type = DEFINE_TYPES[lex.code];
			bone.type = DEFINE_TYPE;
			bone.raw.type = type[0];
			bone.raw.attrs = [];
			bone.raw.opened = lex.code;
			bone.raw.closed = type[1];
			return 'define:args';
		},
		'': fail,
	},

	'define:args': {
		'$name': '->',
		'': (lex, bone) => {
			const code = lex.code;
			const raw = bone.raw;

			if (COMMA_CODE === code || SPACE_CODE === code || raw.closed === code) {
				const token = lex.takeToken().trim();
				token && raw.attrs.push(token);
				return raw.closed === code ? ENTRY_GROUP_STATE : '-->';
			} else {
				fail(lex, bone)
			}
		}
	},

	'fn-call': {
		'': (lex, bone) => {
			bone.type = CALL_TYPE;
			bone.raw.args = parseJSCallArgs(lex);
			return ENTRY_GROUP_STATE;
		}
	}
}, {
	onstart: () => {
		indentMode = void 0;
		prevIndent = 0;
	},

	onend: (lex, bone) => {
		if (indentMode || (bone as XBone).shorty) {
			while (bone.type !== ROOT_TYPE) {
				bone = bone.parent;

				while ((bone as XBone).shorty) {
					bone = bone.parent;
				}
			}
		}

		if (bone.type !== ROOT_TYPE) {
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

		const mode = lex.indent.tab ? TAB_INDENT : (lex.indent.space ? SPACE_INDENT : indentMode);

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

// Keywords
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

			return TO_KEYWORD_STATE;
		},

		add(name:string, details:string|string[], options:any = {}) {
			const variants:Array<any[]> = [].concat(details).map((value) => parse(value).raw.slice(0, -1));
			const maxVariants = variants.length;

			KEYWORDS[name] = {
				attr(bone:Bone, value:string) {
					bone.raw.attrs[_attr] = value;
					return TO_KEYWORD_STATE;
				},

				parse(lex:Lexer, bone:Bone) {
					const code = lex.code;
					const seqCode = variants[_variant][_cursor];
					const prevSeqCode = variants[_variant][_cursor - 1];

					if (
						(seqCode === void 0) ||
						((code === OPEN_BRACE_CODE || code === ENTER_CODE) && options.optional)
					) {
						// Конец, либо необязательно
						options.validate && options.validate(lex, bone);
						return '>KEYWORD_END' 
					} else if (code === seqCode) {
						_cursor++;
					} else if (seqCode === SPACE_CODE) {
						_cursor++;
						return TO_KEYWORD_STATE;
					} else if (code === SPACE_CODE && prevSeqCode === SPACE_CODE) {
						// Продолжаем пропускать пробелы
					} else {
						if (maxVariants - _variant > 1) {
							for (var i = _variant; i < maxVariants; i++) {
								if (variants[i][_cursor] === code) {
									_variant = i;
									return this.parse(lex, bone);
								}
							}
						}

						if (seqCode.attr) {
							_attr = seqCode.attr; 
							_cursor++;

							return '>KW_TYPE:' + seqCode.type;
						} else {
							fail(lex, bone);
						}
					}

					return '-->';
				}
			};
		}
	}
})();
