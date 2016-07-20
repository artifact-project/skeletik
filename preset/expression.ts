import skeletik, {Lexer, Bone, SkeletikParser} from '../src/skeletik';

export interface EBone extends Bone {
	isFloat:boolean;
}

// Tokens
export const T_ROOT = '#root';
export const T_ID = 'identifier';
export const T_SIGN = 'sign';
export const T_STRING = 'string';
export const T_NUMBER = 'number';
export const T_REGEXP = 'regexp';
export const T_BRACE = 'brace'; // {}
export const T_BRACKET = 'bracket'; // []
export const T_PARENTHESIS = 'parenthesis'; // ()

// Character codes
const DOT_CODE = 46; // "."

// Group by token
const IS_GROUP = {};
IS_GROUP[T_BRACE] = T_BRACE;
IS_GROUP[T_BRACKET] = T_BRACKET;
IS_GROUP[T_PARENTHESIS] = T_PARENTHESIS;

// Group by character
const CHR_TO_GROUP = {
	'{': T_BRACE, '}': T_BRACE,
	'[': T_BRACKET, ']': T_BRACKET,
	'(': T_PARENTHESIS, ')': T_PARENTHESIS
};

let _code;
let _slashes = 0;

function add(lex:Lexer, parent:Bone, type:string, raw?:any):Bone {
	const last = parent.last;

	if (last !== void 0){
		if (type === T_STRING &&  last.type !== T_SIGN) {
			lex.error('Unexpected string', parent);
		}
		else if ((last.type === T_STRING || last.type === T_BRACKET || last.type === T_PARENTHESIS) && (type === T_NUMBER || type === T_ID)) {
			lex.error('Unexpected ' + type, parent);
		}
	}

	return parent.add(type, raw).last;
}

function validate(lex:Lexer, root:Bone):void {
	const last = root.last;
	const rootType = root.type;

	if (rootType === T_REGEXP) {
		lex.error('Invalid regular expression: missing /');
	} else if (rootType !== T_ROOT) {
		if (rootType === T_STRING) {
			lex.error('Invalid or unexpected token', root);
		} else {
			lex.error('Unexpected end of input', root);
		}
	} else if (last) {
		if (last.type === T_SIGN) {
			if (
				(last.raw === '+') ||
				(last.raw === '/') ||
				(last.raw === '-') ||
				(last.raw === '!') ||
				(last.raw === '~') ||
				(last.raw === '*' && last.prev)
			) {
				lex.error('Unexpected end of input', root);
			} else {
				lex.error('Unexpected token ' + last.raw, root);
			}
		}
	}
}

function openGroup(lex:Lexer, bone:Bone):Bone {
	return add(lex, bone, CHR_TO_GROUP[lex.takeChar()]);
}

function closeGroup(lex:Lexer, bone:Bone):Bone {
	const chr = lex.takeChar();
	const type = CHR_TO_GROUP[chr];
	const parent = bone.parent;

	if (type !== bone.type || bone.last && bone.last.type === T_SIGN) {
		lex.error('Unexpected token ' + chr, bone);
	}

	if (chr === ')' && bone.type === type && (!bone.nodes.length && (!bone.prev || bone.prev.type !== T_ID))) {
		// lex.error('Unexpected end of input', bone);
		lex.error('Unexpected token ' + chr, bone);
	}

	return parent;
}

function openString(lex:Lexer, bone:Bone):[Bone, string] {
	_code = lex.code;
	_slashes = 0;

	return [add(lex, bone, T_STRING), 'string'];
}

function closeString(lex:Lexer, bone:Bone):Bone|string {
	if (lex.code === _code) { // chr: "
		if (!(_slashes % 2)) {
			bone.raw = lex.takeToken(0, 1).slice(1, -1);
			return bone.parent;
		}
	}

	_slashes = 0;

	return '->';
}

function fail(lex:Lexer, bone:Bone) {
	lex.error(`Unexpected token ${lex.takeChar()}`, bone);
}

// Export parser
export default <SkeletikParser>skeletik({
	'$id': ['a-z', 'A-Z', '_', '$'],
	'$number': ['0-9'],
	'$sign': ['+', '*', '/', '%', '-', '!', '?', ':', '.', '&', '|', '^', '~', ',', '=', '>', '<']
}, {
	'': {
		'"': openString,
		"'": openString,

		'{': openGroup,
		'}': closeGroup,

		'[': openGroup,
		']': closeGroup,

		'(': openGroup,
		')': closeGroup,

		'\r': '-->',
		'\n': '-->',
		' ': '-->',
		'\t': '-->',
		';': '-->',

		'/': function (lex:Lexer, bone:Bone) {
			if (bone.last && bone.last.type === T_SIGN || !bone.last && (!bone.parent || IS_GROUP[bone.type])) {
				lex.takeChar();

				return [
					add(lex, bone, T_REGEXP, {source: '', flags: ''}),
					'regexp'
				];
			}
			else {
				bone.add(T_SIGN, lex.takeChar());
			}
		},

		'$id': 'id',

		'$sign': function (lex:Lexer, bone:Bone) {
			const chr = lex.takeChar();
			const last = bone.last as EBone;

			if (last && lex.code === DOT_CODE && last.type === T_NUMBER) {
				last.isFloat && lex.error('Unexpected end of input');
				last.isFloat = true;
				last.raw += chr;
			} else {
				add(lex, bone, T_SIGN, chr);
			}
		},

		'$number': '!number',

		'': (lex:Lexer, bone:Bone) => { lex.error('Invalid or unexpected token', bone);}
	},

	'regexp': {
		'/': function (lex:Lexer, bone:Bone) {
			bone.raw.source = lex.takeToken();
			return bone.parent;
		}
	},

	'id': {
		'$id': 'id',
		'': function (lex:Lexer, bone:Bone) {
			add(lex, bone, T_ID, lex.takeToken());
			return '>';
		}
	},

	'number': {
		'$number': '->',
		'': function (lex:Lexer, bone:Bone) {
			const last = bone.last as EBone;
			const token = lex.takeToken();

			if (last && last.type === T_NUMBER) {
				last.raw += token;
			} else if (last && last.type === T_SIGN && last.raw === '.') {
				last.raw += token;
				last.type = T_NUMBER;
				last.isFloat = true;
			} else {
				add(lex, bone, T_NUMBER, token);
			}

			return '>';
		}
	},

	'string': {
		'\\': function () {
			_slashes++;
			return '->';
		},

		'"': closeString,
		"'": closeString,

		'': function () {
			_slashes = 0;
			return '->';
		}
	}
}, {
	onend: validate
});
