import skeletik, {Lexer, Bone, SkeletikParser} from '../src/skeletik';

// Tokens
export const TAG_TYPE = 'tag';
export const TEXT_TYPE = 'text';
export const COMMENT_TYPE = 'comment';
export const CDATA_TYPE = 'cdata';

// Character codes
const QUOTE_CODE = 34;
const MINUS_CODE = 45;
const RIGHT_BRACE_CODE = 93;

let _attr;
let _slashes = 0;

function add(parent:Bone, type:string, raw?:any):Bone {
	return parent.add(type, raw).last;
}

function addTag(parent:Bone, name:string):Bone {
	return add(parent, TAG_TYPE, {
		name: name,
		attrs: {}
	});
}

function addText(parent:Bone, value:string):void {
	value && add(parent, TEXT_TYPE, {value: value});
}

function addComment(parent:Bone, value:string):void {
	add(parent, COMMENT_TYPE, {value: value});
}

function addCDATA(parent:Bone, value:string):void {
	add(parent, CDATA_TYPE, {value: value});
}

function setBooleanAttr(lex:Lexer, bone:Bone):void {
	bone.raw.attrs[lex.takeToken()] = true;
}

function fail(lex:Lexer, bone:Bone):void {
	lex.error(`Invalid character \`${lex.getChar()}\``, bone);
}

// Export parser
export default <SkeletikParser>skeletik({
	'$ws': [' ', '	', '\n'],
	'$name': ['a-z', 'A-Z', '-', ':', '0-9'],
	'$name_start': ['a-z', 'A-Z', '_'],
	'$attr': ['a-z', 'A-Z', '-', '_', ':', '@', '0-9']
}, {
	'': {
		'<': 'entry:open',
		'': '!text'
	},

	'entry:open': {
		'$name_start': '!tag:name',
		'/': 'tag:close',
		'!': 'comment-or-cdata',
		'': fail
	},

	'comment-or-cdata': {
		'-': 'comment:await',
		'[': 'cdata:await',
		'': 'text'
	},

	'comment:await': {
		'-': 'comment:value',
		'': 'text'
	},

	'comment:value': {
		'>': function (lex:Lexer, parent:Bone) {
			if (lex.prevCode === MINUS_CODE && lex.peek(-2) === MINUS_CODE) {
				addComment(parent, lex.takeToken().slice(0, -2));
				return '';
			} else {
				return '->';
			}
		},
		'': '->'
	},

	'cdata:await': {
		'': function (lex:Lexer) {
			const token = lex.getToken();

			if (token === 'CDATA[') {
				return '!cdata:value';
			} else if (token.length === 6) {
				return 'text';
			}

			return '->';
		}
	},

	'cdata:value': {
		'>': function (lex:Lexer, parent:Bone) {
			if (lex.prevCode === RIGHT_BRACE_CODE && lex.peek(-2) === RIGHT_BRACE_CODE) {
				addCDATA(parent, lex.takeToken(0, -2));
				return '';
			} else {
				return '->';
			}
		}
	},

	'text': {
		'<': function (lex:Lexer, parent:Bone) {
			addText(parent, lex.takeToken());
			return 'entry:open';
		},
		'': '->'
	},

	'tag:name': {
		'$name': '->',

		'/': function (lex:Lexer, parent:Bone) {
			addTag(parent, lex.takeToken());
			return 'tag:end';
		},

		'>': (lex:Lexer, parent:Bone) => [addTag(parent, lex.takeToken()), ''],
		'$ws': (lex:Lexer, parent:Bone) => [addTag(parent, lex.takeToken()), 'tag:attrs']
	},

	'tag:close': {
		'$name': '->',
		'>': function (lex:Lexer, bone:Bone) {
			const name = lex.takeToken();
			const mustName = bone.raw && bone.raw.name;

			if (mustName !== name) {
				lex.error('Wrong closing tag "' + name + '", must be "' + mustName + '"', bone);
			}

			return [bone.parent, ''];
		},
		'': fail
	},

	'tag:end': {
		'>': '',
		'': fail
	},

	'tag:attrs': {
		'$attr': '!tag:attr',
		'$ws': '->',
		'/': (lex:Lexer, bone:Bone) => [bone.parent, 'tag:end'],
		'>': '',
		'': fail
	},

	'tag:attr': {
		'$attr': '->',

		'$ws': function (lex:Lexer, bone:Bone) {
			setBooleanAttr(lex, bone);
			return 'tag:attrs';
		},

		'/': function (lex:Lexer, bone:Bone) {
			setBooleanAttr(lex, bone);
			return [bone.parent, 'tag:end'];
		},

		'=': function (lex:Lexer) {
			_attr = lex.takeToken();
			return 'tag:attr:value:await';
		},

		'': fail
	},
	
	'tag:attr:value:await': {
		'"': function () {
			_slashes = 0;
			return 'tag:attr:value:read';
		},
		'': fail
	},

	'tag:attr:value:read': {
		'\\': function () {
			_slashes++;
			return '->';
		},

		'"': function (lex:Lexer, bone:Bone) {
			if (lex.code === QUOTE_CODE) { // chr: "
				if (!(_slashes % 2)) {
					bone.raw.attrs[_attr] = lex.takeToken();
					return 'tag:attrs';
				}
			}
	
			_slashes = 0;
			return '->';
		},

		'': function () {
			_slashes = 0;
			return '->';
		}
	}
}, {
	onend: function (lex:Lexer, bone:Bone) {
		if (lex.lastIdx < lex.length) {
			addText(bone, lex.getToken(0, -1));
		}

		if (bone.type !== '#root') {
			lex.error('<' + bone.raw.name + '/> must be closed', bone);
		}
	}
});
