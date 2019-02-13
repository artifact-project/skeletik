import skeletik, {charCode, Bone, Lexer} from '../../src/skeletik/skeletik';

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

function getLoc(lex: Lexer) {
	const loc = [lex.line, lex.column];
	return {start: loc, end: loc}
}

const KEYWORDS: {[name: string]: boolean} = {
	'IF': true,
	'ELSE': true,
	'ELSEIF': true,
	'INCLUDE': true,
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
const C_MINUS = charCode('-');

let expr = '';
let isClose = false;
let openParentheses = 0;
let startPos: Pos;

export const mpop = skeletik({
	'$ws': [' '],
	'$name': ['A-Z', 'a-z', '_', '0-9'],
	'$cmd': ['A-Z'],
	'$start_expr': ['A-Z', 'a-z'],
	'$expr': ['A-Z', 'a-z', '_', '0-9'],
}, {
	'': {
		__events: {
			leave: (lex) => {
				if (lex.code === C_LT || lex.code === C_HASH) {
					startPos = getPos(lex);
				}
			},
		},

		'<': 'AWAIT_COMMENT',
		'#': 'AWAIT_MPOP_EXPR',
		'': '->',
	},

	'AWAIT_COMMENT': {
		'': createSeq('!--', 'START_COMMENT'),
	},

	'AWAIT_MPOP_EXPR': {
		'#': 'AWAIT_FUNC_OR_VALUE',
		'': '',
	},

	'AWAIT_FUNC_OR_VALUE': {
		'$name': '->',
		'(': (lex, bone) => {
			const token = lex.getToken();

			if (token === 'SetVars') {
				return 'SET_VARS:NAME';
			} else {
				return [bone.add('FUNC', {
					loc: getLoc(lex),
					name: token,
					args: [],
				}).last, 'FUNC:ARGS'];
			}
		},
		'#': (lex, bone) => {
			if (lex.peek(+1) === C_HASH) {
				bone.add('VALUE', {
					loc: {
						start: startPos,
						end: getPos(lex, 2),
					},
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

			if (KEYWORDS[token]) {
				if (isClose) {
					isClose = false;

					if (token === 'IF') {
						bone = bone.parent;
					}

					if (bone.type !== token) {
						lex.error(`Wrong closed tag "${token}", but must be ${bone.type}`);
					} else {
						return [bone, 'KW_AWAIT_END'];
					}
				}

				if (token === 'ELSE' || token === 'ELSEIF') {
					bone = bone.parent;
					bone.raw.alternate = new Bone(token);
					bone.raw.alternate.parent = bone;
					return [bone.raw.alternate, token === 'ELSE' ? '' : 'KW_IF'];
				}

				return [
					bone.add(token, {loc: {
						start: startPos,
						end: null,
					}}).last,
					`KW_${token}`,
				];
			}
		},
		'': '',
	},

	'SET_VARS:NAME': {
		'=': (lex, bone) => {
			return [bone.add('SET_VARS', {
				loc: {start: startPos, end: startPos},
				name: lex.getToken(),
			}).last, 'SET_VARS:VALUE'];
		},
		'': '->',
	},

	'SET_VARS:VALUE': {
		')': (lex, bone) => {
			bone.raw.value = lex.getToken();
			bone.raw.loc.end = getPos(lex, 3);
			lex.skipNext(2);
			return bone.parent;
		},
		'': '->',
	},

	'FUNC:ARGS': {
		')': (lex, bone) => {
			bone.raw.args = [lex.getToken()];
			lex.skipNext(2);
			return bone.parent;
		},
		'': '->',
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

	'KW_INCLUDE': {
		'': createSeq('-->', '>KW_INCLUDE_END', true),
	},

	'KW_INCLUDE_END': {
		'>': (lex, bone) => {
			bone.raw.src = lex.getToken(0, -2).trim();
			bone.raw.loc.end = getPos(lex, 1);
			return bone.parent;
		},
	},

	'KW_AWAIT_END': {
		'>': (lex, bone) => {
			bone.raw.loc.end = getPos(lex, 1);
			return bone.parent;
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
				return `${lex.prevState}_EXPR`;
			}

			return fail(lex, bone);
		},
	},
}, {
	onend(lex: Lexer, bone: Bone, root) {
		if (bone !== root) {
			lex.error(`"${bone.type}" is not closed`);
		}
	}
});