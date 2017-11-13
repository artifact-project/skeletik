import skeletik, {charCode, Bone, Lexer} from './skeletik';

function createSeq(seq, nextState) {
	let cursor = 0;
	let length = seq.length;

	return function (lex: Lexer) {
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
		return '';
	};
}

function fail(lex: Lexer, bone: Bone) {
	lex.error(`Invalid character \`${lex.getChar()}\`, state: ${lex.state}`, bone);
}

function getLoc(lex: Lexer) {
	const loc = [lex.line, lex.column];
	return {start: loc, end: loc}
}

const KEYWORDS = {
	'IF': true,
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

const C_GT = charCode('>');
const C_HASH = charCode('#');
const C_MINUS = charCode('-');

let expr = '';
let isClose = false;
let openParentheses = 0;

const mpop = skeletik({
	'$ws': [' '],
	'$name': ['A-Z', 'a-z', '_', '0-9'],
	'$cmd': ['A-Z'],
	'$start_expr': ['A-Z', 'a-z'],
	'$expr': ['A-Z', 'a-z', '_', '0-9'],
}, {
	'': {
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
					loc: getLoc(lex),
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
			const token = lex.getToken();

			if (KEYWORDS[token]) {
				if (isClose) {
					isClose = false;

					if (bone.type !== token) {
						lex.error(`Wrong closed tag "${token}", but must be ${bone.type}`);
					} else {
						bone.raw.loc.end = [lex.line, lex.column];

						return bone.parent;
					}
				}

				const loc = [lex.line, lex.column];

				return [
					bone.add(token, {loc: getLoc(lex)}).last,
					`KW_${token}`,
				];
			}
		},
		'': '',
	},

	'SET_VARS:NAME': {
		'=': (lex, bone) => {
			return [bone.add('SET_VARS', {
				loc: getLoc(lex),
				name: lex.getToken(),
			}).last, 'SET_VARS:VALUE'];
		},
		'': '->',
	},

	'SET_VARS:VALUE': {
		')': (lex, bone) => {
			bone.raw.value = lex.getToken();
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
		},
	},

	'KW_INCLUDE': {
		' ': (lex, bone) => {
			bone.raw.src = lex.getToken();
			return bone.parent;
		},
		'': '->',
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

it('mpop', () => {
	function node(type, raw, loc, nodes = []) {
		if (Array.isArray(loc)) {
			loc = {start: loc, end: loc};
		}

		return {
			type,
			raw: {
				loc,
				...raw,
			},
			nodes,
		};
	}

	// `JSON.stringify` + `JSON.parse needs` for converting bone to plain objects
	expect(JSON.parse(JSON.stringify(mpop(`
		##SetVars(TRUE=1)##
		##SetVars(HOST=mail.ru)##
		<!-- INCLUDE ./foo.html -->
		<!-- IF TestServer && Eq(GET_x,1) -->
			Hi, ##UserName##
			##JsonEncode(GET_id)##
		<!-- /IF -->
	`)))).toEqual({
		type: '#root',
		raw: null,
		nodes: [
			node('SET_VARS', {name: 'TRUE', value: '1'}, [2, 17]),
			node('SET_VARS', {name: 'HOST', value: 'mail.ru'}, [3, 17]),
			node('INCLUDE', {src: './foo.html'}, [4, 15]),
			node('IF', {test: 'TestServer && Eq(GET_x,1)'}, {start: [5, 10], end: [8, 11]}, [
				node('VALUE', {name: 'UserName'}, [6, 18]),
				node('FUNC', {name: 'JsonEncode', args: ['GET_id']}, [7, 16]),
			]),
		],
	});
});
