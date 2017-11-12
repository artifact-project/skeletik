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
const C_MINUS = charCode('-');

let expr = '';
let isClose = false;
let openParentheses = 0;

const mpop = skeletik({
	'$ws': [' '],
	'$cmd': ['A-Z'],
	'$start_expr': ['A-Z', 'a-z'],
	'$expr': ['A-Z', 'a-z', '_', '0-9'],
}, {
	'': {
		'<': 'AWAIT_COMMENT',
		'#': 'AWAIT_SET_VARS',
		'': '->',
	},

	'AWAIT_COMMENT': {
		'': createSeq('!--', 'START_COMMENT'),
	},

	'AWAIT_SET_VARS': {
		'': createSeq('#SetVars(', 'SET_VARS:NAME'),
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
			return [bone.add('VAR', {
				loc: getLoc(lex),
				name: lex.getToken(),
			}).last, 'SET_VARS:VALUE'];
		},
		'': '->',
	},

	'SET_VARS:VALUE': {
		')': (lex, bone) => {
			bone.raw.value = lex.getToken();
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

			if (PARENTHESES.hasOwnProperty(code)) {
				openParentheses += PARENTHESES[code];

				if (openParentheses < 0) {
					lex.error('Oops, unexpected close parenthesis.');
				}

				return '->';
			}

			if (openParentheses > 0 || OPERANDS.hasOwnProperty(code)) {
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
			OK
		<!-- /IF -->
	`)))).toEqual({
		type: '#root',
		raw: null,
		nodes: [
			node('VAR', {name: 'TRUE', value: '1'}, [2, 17]),
			node('VAR', {name: 'HOST', value: 'mail.ru'}, [3, 17]),
			node('INCLUDE', {src: './foo.html'}, [4, 15]),
			node('IF', {test: 'TestServer && Eq(GET_x,1)'}, {start: [5, 10], end: [7, 11]}),
		],
	});
});
