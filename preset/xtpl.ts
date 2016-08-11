import skeletik, {Lexer, Bone, SkeletikParser} from '../skeletik';
import * as utils from './utils';

export interface XBone extends Bone {
	group?:boolean;
	shorty?:boolean;
}

// Shortcut types
const ROOT_TYPE = utils.ROOT_TYPE;
const DTD_TYPE = utils.DTD_TYPE;
const TEXT_TYPE = utils.TEXT_TYPE;
const HIDDEN_CLASS_TYPE = utils.HIDDEN_CLASS_TYPE;
const DEFINE_TYPE = utils.DEFINE_TYPE;
const CALL_TYPE = utils.CALL_TYPE;
const EXPRESSION_TYPE = utils.EXPRESSION_TYPE;
const GROUP_TYPE = utils.GROUP_TYPE;

// Shortcut codes
const ENTER_CODE = utils.ENTER_CODE; // "\n"
const SPACE_CODE = utils.SPACE_CODE; // " "
const DOT_CODE = utils.DOT_CODE; // "."
const COMMA_CODE = utils.COMMA_CODE; // ","
const PIPE_CODE = utils.PIPE_CODE; // "|"
const SLASH_CODE = utils.SLASH_CODE; // "/"
const BACKSLASH_CODE = utils.BACKSLASH_CODE; // "\"
const ASTERISK_CODE = utils.ASTERISK_CODE; // "*"
const OPEN_BRACE_CODE = utils.OPEN_BRACE_CODE; // "{"
const CLOSE_BRACE_CODE = utils.CLOSE_BRACE_CODE; // "}"
const OPEN_BRACKET_CODE = utils.OPEN_BRACKET_CODE; // "["
const CLOSE_BRACKET_CODE = utils.CLOSE_BRACKET_CODE; // "]"
const OPEN_PARENTHESIS_CODE = utils.OPEN_PARENTHESIS_CODE; // "("
const CLOSE_PARENTHESIS_CODE = utils.CLOSE_PARENTHESIS_CODE; // ")"
const HASHTAG_CODE = utils.HASHTAG_CODE; // "#"
const EQUAL_CODE = utils.EQUAL_CODE; // "="
const LT_CODE = utils.LT_CODE; // "<"
const GT_CODE = utils.GT_CODE; // ">"
const PLUS_CODE = utils.PLUS_CODE; // "+"

const KEYWORDS = {};
let _keyword;

const CONTINUE = '->';
const REWIND = '-->';
const TO = '>';

const DTD = 'dtd';
const VAR_OR_TAG = 'var_or_tag';
const HIDDEN_CLASS = 'hidden_class';
const ENTRY = 'entry';
const ENTRY_WS_MODE = ENTRY + '_ws_mode';
const ENTRY_GROUP = ENTRY + '_group';
const ENTRY_STOPPER = ENTRY + '_stopper';
const ENTRY_STOPPER_AWAIT = ENTRY_STOPPER + '_await';
const COMMENT = 'comment';
const COMMENT_AWAIT = COMMENT + '_await';
const MULTI_COMMENT = 'multi_' + COMMENT;
const ID_OR_CLASS = 'id_or_class';
const INLINE_ATTR = 'inline_attr';
const INLINE_ATTR_AWAIT = INLINE_ATTR + '_await';
const INLINE_ATTR_NEXT = INLINE_ATTR + '_next';
const INLINE_ATTR_NEXT_WS = INLINE_ATTR_NEXT + '_ws';
const INLINE_ATTR_VALUE = INLINE_ATTR + '_value';
const INLINE_ATTR_VALUE_AWAIT = INLINE_ATTR_VALUE + '_await';
const INLINE_ATTR_VALUE_END = INLINE_ATTR_VALUE + '_end';
const TEXT = 'text';
const TEXT_AWAIT = TEXT + '_await';
const CLASS_ATTR = 'class_attr';
const KEYWORD = 'KEYWORD';
const KEYWORD_END = KEYWORD + '_END';
const KW_TYPE = 'KW_TYPE';
const KW_TYPE_VAR = KW_TYPE + '_var';
const KW_TYPE_VAR_NEXT = KW_TYPE_VAR + '_next';
const KW_TYPE_JS = KW_TYPE + '_js';
const FN_CALL = 'fn-call';
const DEFINE = 'define';
const DEFINE_ARGS = 'define_args';

const TO_TEXT = TO + TEXT;
const TO_ENTRY = TO + ENTRY;
const TO_ENTRY_GROUP = TO + ENTRY_GROUP;
const TO_ENTRY_STOPPER = TO + ENTRY_STOPPER;
const TO_ENTRY_STOPPER_AWAIT = TO + ENTRY_STOPPER_AWAIT;
const TO_ENTRY_WS_MODE = TO + ENTRY_WS_MODE;
const TO_KW_TYPE_VAR_NEXT = TO + KW_TYPE_VAR_NEXT;
const TO_KEYWORD = TO + KEYWORD;
const TO_KEYWORD_END = TO + KEYWORD_END;

const ID_ATTR_NAME = 'id';
const CLASS_ATTR_NAME = 'class';

interface INextState {
	to?:string;
	add?:boolean;
	close?:boolean;
	(token:string):INextState;
}

const STOPPER_TO_STATE = {
	[ENTER_CODE]: {
		close: true
	},
	
	[SLASH_CODE]: {
		to: COMMENT_AWAIT,
		close: true,
	},

	[DOT_CODE]: (token) => (token === CLASS_ATTR_NAME) ? {add: false, to: CLASS_ATTR} : {to: ID_OR_CLASS},
	
	[HASHTAG_CODE]: ID_OR_CLASS,

	[PIPE_CODE]: TEXT_AWAIT,
	[OPEN_BRACKET_CODE]: INLINE_ATTR_AWAIT,
	[EQUAL_CODE]: DEFINE_TYPE,
	[OPEN_PARENTHESIS_CODE]: FN_CALL,

	[OPEN_BRACE_CODE]: TO_ENTRY_GROUP,
	[CLOSE_BRACE_CODE]: TO_ENTRY_GROUP,

	[GT_CODE]: TO_ENTRY_GROUP,
	[PLUS_CODE]: TO_ENTRY_GROUP,
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
let tagNameChain:any[] = [];
let attrValueChain:any[] = [];

// Shortcut methods
const add = utils.add;
const addTag = utils.addTag;
const addComment = utils.addComment;
const addKeyword = utils.addKeyword;
const fail = utils.fail;
const parseXML = utils.parseXML;
const parseJS = utils.parseJS;
const parseJSCallArgs = utils.parseJSCallArgs;
const expressionMixin = utils.expressionMixin;

function addToText(bone:Bone, token:string):void {
	if (token) {
		const value = bone.raw.value;

		if (typeof value === 'string') {
			bone.raw.value += token;
		} else {
			value.push(token);
		}
	}
}

function addAttrValue(lex:Lexer, bone:Bone, name:string, values:any[]):void {
	let list = bone.raw.attrs[name];
	
	if (list === void 0) {
		list = bone.raw.attrs[name] = [];
	}

	attrValueChain = [];

	if (name === ID_ATTR_NAME && list.length) {
		lex.error('Duplicate attribute "id" is not allowed', bone);
	}

	list.push(values);
}

function takeInlineAttrName(lex:Lexer, bone) {
	inlineAttrName = lex.takeToken();
	!inlineAttrName && lex.error('Empty attribute name', bone);
}

function setInlineAttr(lex:Lexer, bone:Bone, values):void {
	takeInlineAttrName(lex, bone);
	addAttrValue(lex, bone, inlineAttrName, values)
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

function inheritEntryHandle(returns?:boolean) {
	let retVal:any = {type: 'inherit', raw: this};
	
	if (returns !== true) {
		attrValueChain.push(retVal);
		retVal = REWIND;
	}

	return retVal;
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
	'$ws_mode': ['<', '>']
}, {
	'': {
		'$stn': CONTINUE,
		'!': DTD,
		'|': TEXT_AWAIT,
		'/': COMMENT_AWAIT,
		'}': closeGroup,
		'$name': '!' + ENTRY,
		'$id_or_class': (lex:Lexer, parent:Bone):[Bone,string] => {
			if (lex.peek(+1) === PIPE_CODE) {
				// HTML fragment
				lex.skipNext(2);
				parseXML(lex, parent);
			} else {
				shortAttrType = lex.code;
				return [addTag(parent, 'div'), ID_OR_CLASS];
			}
		},
		'%': '!' + HIDDEN_CLASS,
		'$': VAR_OR_TAG,
		'': fail
	},

	[DTD]: {
		'\n': (lex, bone) => { add(bone, DTD_TYPE, {value: lex.takeToken()}); }
	},

	[VAR_OR_TAG]: {
		'{': (lex, parent) => {
			const expr = parseJS(lex, CLOSE_BRACE_CODE, 1);
			tagNameChain.push({type: EXPRESSION_TYPE, raw: expr});
			return TO_ENTRY;
		},
		'': fail
	},

	[ENTRY]: expressionMixin(() => tagNameChain, {
		' ': TO_ENTRY_STOPPER_AWAIT,
		'$name': CONTINUE,
		'$name_stopper': TO_ENTRY_STOPPER,
		'': fail
	}),

	[ENTRY_STOPPER_AWAIT]: {
		' ': CONTINUE,
		'$name_stopper_after_space': TO_ENTRY_STOPPER,
		'': (lex, parent) => {
			const token = lex.takeToken().trim();
			return KEYWORDS[token] ? [addKeyword(parent, token), keywords.start(token)] : fail(lex, parent);
		}
	},

	[ENTRY_STOPPER]: {
		'': (lex:Lexer, parent:Bone):string|Bone|[Bone, string] => {
			const code = lex.code;
			const token = lex.takeToken().trim();
			let state = <INextState><any>STOPPER_TO_STATE[code];

			switch (typeof state) {
				case 'string': state = <INextState><any>{to: state}; break;
				case 'function': state = state(token); break;
			}

			shortAttrType = code;

			if (KEYWORDS[token]) {
				return [addKeyword(parent, token), keywords.start(token)];
			} else if (state.add !== false && (token || tagNameChain.length)) {
				parent = addTag(parent, token, tagNameChain);
			}

			return [state.close ? closeEntry(parent) : parent, state.to || ''];
		}
	},

	[CLASS_ATTR]: expressionMixin(() => attrValueChain, {
		'&': inheritEntryHandle.bind('self'),
		':': (lex, bone) => {
			const token = lex.takeToken();

			token && attrValueChain.push(token);
			
			addAttrValue(lex, bone, CLASS_ATTR_NAME, [{
				type: GROUP_TYPE,
				test: parseJS(lex, ENTER_CODE, 1),
				raw: attrValueChain
			}]);

			attrValueChain = [];
		}
	}),

	[HIDDEN_CLASS]: {
		'$name_stopper': (lex, bone) => {
			bone = add(bone, HIDDEN_CLASS_TYPE, {attrs: {}});
			addAttrValue(lex, bone, CLASS_ATTR_NAME, [inheritEntryHandle.call('parent', true), lex.takeToken(1).trim()]);

			return [bone, SPACE_CODE === lex.code ? ENTRY_STOPPER_AWAIT : TO_ENTRY_GROUP];
		}
	},

	[ID_OR_CLASS]: expressionMixin(() => attrValueChain, {
		'&': inheritEntryHandle.bind('parent'),
		'$name_stopper': (lex, bone) => {
			const code = lex.code;
			const token = lex.takeToken().trim();

			token && attrValueChain.push(token);
			addAttrValue(lex, bone, shortAttrType === DOT_CODE ? CLASS_ATTR_NAME : ID_ATTR_NAME, attrValueChain);
			
			shortAttrType = code;

			return (HASHTAG_CODE === code || DOT_CODE === code)
				? REWIND
				: (SPACE_CODE === code ? ENTRY_STOPPER_AWAIT : TO_ENTRY_STOPPER)
			;
		}
	}),

	[ENTRY_GROUP]: {
		'{': markAsGroup,
		'}': closeGroup,
		'>': (lex, bone) => { (bone as XBone).shorty = true; },
		'+': (lex, bone) => bone.parent,
		'|': TEXT_AWAIT,
		'/': (lex, bone) => [closeEntry(bone), COMMENT_AWAIT],
		'\n': (lex, bone) => closeEntry(bone),
		' ': CONTINUE,
		'': fail // todo: покрыть тестом
	},

	[INLINE_ATTR_AWAIT]: {
		'$stn': CONTINUE,
		'$name': '!' + INLINE_ATTR,
		'$ws_mode': TO_ENTRY_WS_MODE,
		'': fail
	},

	[ENTRY_WS_MODE]: {
		'$ws_mode': (lex, bone) => {
			bone.raw[lex.takeChar() === '<' ? 'wsBefore' : 'wsAfter'] = true;
			return REWIND;
		},
		']': INLINE_ATTR_NEXT,
		'': fail
	},

	[INLINE_ATTR]: {
		']': (lex, bone) => {
			setInlineAttr(lex, bone, [true]);
			return INLINE_ATTR_NEXT;
		},
		'$stn': (lex, bone) => {
			setInlineAttr(lex, bone, [true]);
			return INLINE_ATTR_NEXT_WS;
		},
		'=': (lex, bone) => (takeInlineAttrName(lex, bone), INLINE_ATTR_VALUE_AWAIT),
		'$ws': fail,
		'': CONTINUE
	},

	[INLINE_ATTR_NEXT_WS]: {
		'$stn': CONTINUE,
		'$name': '!' + INLINE_ATTR,
		']': INLINE_ATTR_NEXT,
		'': fail
	},

	[INLINE_ATTR_VALUE_AWAIT]: {
		'"': INLINE_ATTR_VALUE,
		'': fail
	},

	[INLINE_ATTR_VALUE]: expressionMixin(() => attrValueChain, {
		'"': (lex, bone) => {
			if (lex.prevCode !== SLASH_CODE) {
				const token = lex.takeToken();
				token && attrValueChain.push(token);
				addAttrValue(lex, bone, inlineAttrName, attrValueChain);
				return INLINE_ATTR_VALUE_END;
			}

			return CONTINUE;
		},
		'\n': fail,
		'': CONTINUE
	}),

	[INLINE_ATTR_VALUE_END]: {
		'$stn': INLINE_ATTR_NEXT_WS,
		']': INLINE_ATTR_NEXT,
		'': fail
	},

	[INLINE_ATTR_NEXT]: {
		'[': INLINE_ATTR_AWAIT,
		' ': ENTRY_STOPPER_AWAIT,
		'$name_stopper': TO_ENTRY_GROUP,
		'': fail
	},

	[COMMENT_AWAIT]: {
		'*': MULTI_COMMENT,
		'/': COMMENT,
		'': fail
	},

	[COMMENT]: {
		'\n': (lex, parent) => { addComment(parent, lex.takeToken()); }
	},

	[MULTI_COMMENT]: {
		'/': (lex, parent) => {
			if (lex.prevCode === ASTERISK_CODE) {
				addComment(parent, lex.takeToken(0, -1));
			} else {
				return CONTINUE;
			}
		}
	},

	[TEXT_AWAIT]: {
		' ': CONTINUE,
		'': (lex, parent) => {
			const multiline = (lex.takeChar() === '>' && PIPE_CODE === lex.prevCode);

			if (multiline) {
				lex.lastIdx++;
				!(parent as XBone).group && ((parent as XBone).shorty = true);
			}

			return [add(parent, TEXT_TYPE, {multiline, value: ''}), TO_TEXT];
		},
	},

	[TEXT]: expressionMixin((bone) => {
		let value = bone.raw.value;
		(typeof value === 'string') && (bone.raw.value = value = []);
		return value;
	}, {
		'|': (lex, bone):string|[Bone, string] => {
			if (bone.raw.multiline && LT_CODE === lex.prevCode) {
				addToText(bone, lex.takeToken(0, -1));
				return ENTRY_GROUP;
			} else {
				return CONTINUE;
			}
		},

		'\n': (lex, bone) => {
			if (bone.raw.multiline) {
				return CONTINUE;
			}

			addToText(bone, lex.takeToken());

			const parent = bone.parent;

			return (parent.type === ROOT_TYPE || (parent as XBone).group)
				? parent
				: closeEntry(parent, false, true);
		}
	}),

	[KEYWORD]: {
		'': (lex, bone) => _keyword.parse(lex, bone)
	},

	[KEYWORD_END]: {
		' ': CONTINUE,
		'{': markAsGroup,
		'\n': '',
		'': fail
	},

	[KW_TYPE_VAR]: {
		'$var_name_start': TO_KW_TYPE_VAR_NEXT,
		'': fail
	},

	[KW_TYPE_VAR_NEXT]: {
		'$var_name_next': CONTINUE,
		'': (lex, bone) => _keyword.attr(bone, lex.takeToken())
	},

	[KW_TYPE_JS]: {
		'': (lex, bone) => _keyword.attr(bone, parseJS(lex, CLOSE_PARENTHESIS_CODE))
	},

	[DEFINE]: {
		' ': CONTINUE,
		'$define_type': (lex, bone) => {
			const type = DEFINE_TYPES[lex.code];
			const raw = bone.raw;

			bone.type = DEFINE_TYPE;
			raw.type = type[0];
			raw.attrs = [];
			raw.opened = lex.code;
			raw.closed = type[1];

			return DEFINE_ARGS;
		},
		'': fail,
	},

	[DEFINE_ARGS]: {
		'$name': CONTINUE,
		'': (lex, bone) => {
			const code = lex.code;
			const raw = bone.raw;

			if (COMMA_CODE === code || SPACE_CODE === code || raw.closed === code) {
				const token = lex.takeToken().trim();
				token && raw.attrs.push(token);
				return raw.closed === code ? ENTRY_GROUP : REWIND;
			} else {
				fail(lex, bone)
			}
		}
	},

	[FN_CALL]: {
		'': (lex, bone) => {
			bone.type = CALL_TYPE;
			bone.raw.args = parseJSCallArgs(lex);
			return ENTRY_GROUP;
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
		const code = lex.code;

		if (
			ENTER_CODE === code ||
			lex.state === TEXT ||
			(SLASH_CODE === code && lex.peek(+1) === SLASH_CODE)
		) {
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

			if (lex.state !== MULTI_COMMENT && lex.state !== INLINE_ATTR_NEXT_WS) {
				// todo: delta > 1
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
			'$name': CONTINUE,
			'': (lex, bone) => {
				bone.raw.push({attr: _attr, type: lex.takeToken()});
				return TO;
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

			return TO_KEYWORD;
		},

		add(name:string, details:string|string[], options:any = {}) {
			const variants:Array<any[]> = [].concat(details).map((value) => parse(value).raw.slice(0, -1));
			const maxVariants = variants.length;

			KEYWORDS[name] = {
				attr(bone:Bone, value:string) {
					bone.raw.attrs[_attr] = value;
					return TO_KEYWORD;
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
						return TO_KEYWORD_END; 
					} else if (code === seqCode) {
						_cursor++;
					} else if (seqCode === SPACE_CODE) {
						_cursor++;
						return TO_KEYWORD;
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

							return TO + KW_TYPE + '_' + seqCode.type;
						} else {
							fail(lex, bone);
						}
					}

					return REWIND;
				}
			};
		}
	}
})();
