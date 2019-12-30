import {skeletikFactory as skeletik, charCode, Bone, Lexer} from '../../src/skeletik/skeletik';

export type Pos = [number, number];
export type Loc = {start: Pos; end: Pos};

function createSeq(seq: string, nextState: string, strict = false) {
	let cursor = 0;
	let length = seq.length;

	return (lex: Lexer) => {
		if (lex.code === seq.charCodeAt(cursor)) {
			cursor++;

			if (cursor === length) {
				cursor = 0;
				return nextState;
			} else {
				return '->';
			}
		}

		cursor = 0;
		return strict ? '->' : '';
	};
}

function fail(lex: Lexer, bone: Bone) {
	lex.error(`Invalid character \`${lex.getChar()}\`, state: ${lex.state}`, bone);
}

function getPos(lex: Lexer, offset = 0): Pos {
	return [lex.line, lex.column + offset];
}

const KEYWORDS: {[name: string]: boolean | string} = {
	'IF': true,
	'IFDEF': true,
	'IFNOT': true,
	'IFNOTDEF': true,
	'ELSE': true,
	'ELSEIF': true,
	'ELSEIFDEF': true,
	'ELSEIFNOT': true,
	'ELSEIFNOTDEF': true,
	'INCLUDE': 'shorty',
	'FOR': true,
	'CONTINUE': 'shorty',
	'BREAK': 'shorty',
};

const OPERANDS = {
	[charCode('&')]: 1,
	[charCode('|')]: 1,
};

const PARENTHESES = {
	[charCode('(')]: 1,
	[charCode(')')]: -1,
};

const C_LT = charCode('<');
const C_GT = charCode('>');
const C_HASH = charCode('#');
const C_ACCENT = charCode('!');
const C_MINUS = charCode('-');
const C_SPACE = charCode(' ');

let expr = '';
let isClose = false;
let openParentheses = 0;
let startPos: Pos;

function addText(lex: Lexer, bone: Bone, trim?: boolean) {
	const token = lex.takeToken();
	const len = token.length;

	if (!len) {
		return;
	}

	if (bone.last && bone.last.type === '#text') {
		bone.last.raw.value += token;
		// bone.last.raw.loc.end = getPos(lex, 0);
	} else {
		bone.add(new Bone('#text', {
			// loc: {start: getPos(lex, -len + 1), end: null},
			value: token,
		}));
	}

	return bone.last;
}


export const mpop = skeletik({
	'$ws': [' '],
	'$name': ['A-Z', 'a-z', '_', '0-9', '/'],
	'$cmd': ['A-Z'],
	'$start_expr': ['!', 'A-Z', 'a-z', '0-9'],
	'$expr': ['A-Z', 'a-z', '_', '0-9', '!'],
}, {
	'': {
		// __events: {
		// 	leave: (lex) => {
		// 		if (lex.code === C_LT || lex.code === C_HASH) {
		// 			startPos = getPos(lex);
		// 		}
		// 	},
		// },

		'<': (lex, bone) => {
			// <`!--`
			if (lex.peek(+1) === C_ACCENT && lex.peek(+2) === C_MINUS && lex.peek(+3)) {
				addText(lex, bone);
				lex.skipNext(3);
				return 'START_COMMENT';
			} else {
				return '->';
			}
		},

		'#': (lex, bone) => {
			if (lex.peek(+1) === C_HASH && lex.range.$expr(lex.peek(+2))) {
				addText(lex, bone);
				lex.skipNext(1);
				return 'AWAIT_FUNC_OR_VALUE';
			} else {
				return '->';
			}
		},

		'': '->',
	},

	'AWAIT_FUNC_OR_VALUE': {
		'$name': '->',
		'(': (lex, bone) => {
			const token = lex.getToken();

			if (token === 'SetVars') {
				return 'SET_VARS:NAME';
			} else {
				return [bone.add('CALL', {
					// loc: {
					// 	start: startPos,
					// 	end: null,
					// },
					name: token,
					args: [],
				}).last, 'FUNC:ARGS'];
			}
		},
		'#': (lex, bone) => {
			if (lex.peek(+1) === C_HASH) {
				bone.add('VALUE', {
					// loc: {
					// 	start: startPos,
					// 	end: getPos(lex, 2),
					// },
					name: lex.getToken(),
				});
				lex.skipNext(1);
				return '';
			}

			return fail(lex, bone);
		},
		'': fail,
	},

	'START_COMMENT': {
		'$ws': '->', // skip white spaces
		'/': () => {
			isClose = true;
			return 'AWAIT_CMD';
		},
		'$cmd': '!AWAIT_CMD',
		'': '',
	},

	'AWAIT_CMD': {
		'$cmd': '->', // continue
		' '(lex: Lexer, bone: Bone) {
			const token = lex.getToken().replace(' ', '');
			const isLikeIF = /^IF/.test(token);
			const isLikeElse = /^ELSE/.test(token);
			const kwType = KEYWORDS[token]

			if (kwType) {
				if (isClose) {
					isClose = false;

					if (isLikeIF) {
						bone = bone.parent;
					}

					while (/^ELSE/.test(bone.type)) {
						bone = bone.parent;
					}

					if (bone.type !== token) {
						lex.error(`Wrong closed tag "${token}", but must be ${bone.type}`);
					} else {
						return [bone, 'KW_AWAIT_END'];
					}
				}

				if (isLikeElse) {
					bone = bone.parent;
					bone.raw.alternate = new Bone(token, {});
					bone.raw.alternate.parent = bone;

					return [bone.raw.alternate, 'KW_ELSE'];
				}

				return [
					bone.add(token, {
						// loc: {start: startPos, end: null},
					}).last,
					isLikeIF ? 'KW_IF' : (kwType === true ? `KW_${token}` : `KW_TYPE_${kwType.toUpperCase()}`),
				];
			}
		},
		'': '',
	},

	'SET_VARS:NAME': {
		'=': (lex, bone) => {
			return [bone.add('SET', {
				// loc: {start: startPos, end: startPos},
				name: lex.getToken(),
			}).last, 'SET_VARS:VALUE'];
		},
		'': '->',
	},

	'SET_VARS:VALUE': {
		')': (lex, bone) => {
			bone.raw.value = lex.getToken();
			// bone.raw.loc.end = getPos(lex, 3);
			lex.skipNext(2);
			return bone.parent;
		},
		'': '->',
	},

	'FUNC:ARGS': {
		')': (lex, bone) => {
			bone.raw.args = [lex.getToken()];
			// bone.raw.loc.end = getPos(lex, 3);
			lex.skipNext(2);
			return bone.parent;
		},
		'': '->',
	},

	'KW_FOR': {
		'$start_expr': '!EXPR',
		'': fail,
	},

	'KW_FOR_EXPR': {
		'': (_, bone: Bone) => {
			bone.raw.data = expr;
		},
	},

	'KW_IF': {
		'$start_expr': '!EXPR',
		'': fail,
	},

	'KW_IF_EXPR': {
		'': (_, bone: Bone) => {
			bone.raw.test = expr;
			bone.raw.consequent = new Bone('#block');
			bone.raw.consequent.parent = bone;
			bone.raw.alternate = null
			return bone.raw.consequent;
		},
	},

	'KW_TYPE_SHORTY': {
		'': createSeq('-->', '>KW_TYPE_SHORTY_END', true),
	},

	'KW_TYPE_SHORTY_END': {
		'>': (lex, bone) => {
			const token = lex.getToken(0, -2).trim();
			bone.raw.value = token;
			// bone.raw.loc.end = getPos(lex, 1);
			return bone.parent;
		},
	},

	'KW_ELSE': {
		'$start_expr': (lex, bone) => {
			const token = lex.getToken();

			if (/^ *IF(NOT)?(DEF)? $/.test(token)) {
				bone.type += ` ${token.trim()}`;
				return '>KW_IF';
			} else if (/^ELSEIF/.test(bone.type)) {
				expr = '';
				return '>KW_IF';
			} else if ('IFNOTDEF'.substr(0, token.length) === token || 'IFDEF'.substr(0, token.length) === token) {
				return '->'
			} else {
				console.log(token);
				return 'fail';
			}
		},
		'-': (lex) => {
			if (lex.peek(+1) === C_MINUS && lex.peek(+2) === C_GT) {
				lex.skipNext(2);
				return '';
			}
		},
	},

	'KW_AWAIT_END': {
		'-': (lex, bone) => {
			if (lex.peek(+1) === C_MINUS && lex.peek(+2) === C_GT) {
				const token = lex.getToken().trim();

				token && (bone.raw.ending = token);
				lex.skipNext(2);
				// bone.raw.loc.end = getPos(lex, 1);
				return bone.parent;
			}
		},
	},

	'EXPR': {
		'$expr': '->',
		' ': '->',
		'': (lex: Lexer, bone: Bone) => {
			const {code} = lex;

			if (PARENTHESES[code]) {
				openParentheses += PARENTHESES[code];

				if (openParentheses < 0) {
					lex.error('Oops, unexpected close parenthesis.');
				}

				return '->';
			}

			if (openParentheses > 0 || OPERANDS[code]) {
				return '->';
			}

			if (code === C_MINUS && lex.peek(+1) === C_MINUS && lex.peek(+2) === C_GT) {
				expr = lex.getToken().trim();
				lex.skipNext(1);
				return `${lex.prevState}_EXPR`;
			}

			return fail(lex, bone);
		},
	},
}, {
	onend(lex: Lexer, bone: Bone, root) {
		if (bone !== root) {
			lex.error(`Parsing failed, "${bone.type}" is not closed, state: "${lex.prevState}" -> "${lex.state}"`);
		}

		const text = addText(lex, bone);
		text.raw.value = text.raw.value.replace(/[\r\n]+$/, '\n');
	}
});