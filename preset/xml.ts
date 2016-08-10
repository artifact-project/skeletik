import skeletik, {Lexer, Bone, SkeletikParser} from '../skeletik';
import * as utils from './utils';

// Shortcut codes
const QUOTE_CODE = utils.QUOTE_CODE; // "
const MINUS_CODE = utils.MINUS_CODE; // -
const CLOSE_BRACKET_CODE = utils.CLOSE_BRACKET_CODE; // ] 

let _attr;
let _slashes = 0;

// Shortcut methods
const addTag = utils.addTag;
const addText = utils.addText;
const addComment = utils.addComment;
const addCDATA = utils.addCDATA;
const fail = utils.fail;

function setBooleanAttr(lex:Lexer, bone:Bone):void {
	bone.raw.attrs[lex.takeToken()] = true;
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
		'>': (lex:Lexer, parent:Bone) => {
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
		'': (lex:Lexer) => {
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
		'>': (lex:Lexer, parent:Bone) => {
			if (lex.prevCode === CLOSE_BRACKET_CODE && lex.peek(-2) === CLOSE_BRACKET_CODE) {
				addCDATA(parent, lex.takeToken(0, -2));
				return '';
			} else {
				return '->';
			}
		}
	},

	'text': {
		'<': (lex:Lexer, parent:Bone) => {
			addText(parent, lex.takeToken());
			return 'entry:open';
		},
		'': '->'
	},

	'tag:name': {
		'$name': '->',

		'/': (lex:Lexer, parent:Bone) => {
			addTag(parent, lex.takeToken());
			return 'tag:end';
		},

		'>': (lex:Lexer, parent:Bone) => [addTag(parent, lex.takeToken()), ''],
		'$ws': (lex:Lexer, parent:Bone) => [addTag(parent, lex.takeToken()), 'tag:attrs']
	},

	'tag:close': {
		'$name': '->',
		'>': (lex:Lexer, bone:Bone) => {
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

		'$ws': (lex:Lexer, bone:Bone) => {
			setBooleanAttr(lex, bone);
			return 'tag:attrs';
		},

		'/': (lex:Lexer, bone:Bone) => {
			setBooleanAttr(lex, bone);
			return [bone.parent, 'tag:end'];
		},

		'=': (lex:Lexer) => {
			_attr = lex.takeToken();
			return 'tag:attr:value:await';
		},

		'': fail
	},
	
	'tag:attr:value:await': {
		'"': () => {
			_slashes = 0;
			return 'tag:attr:value:read';
		},
		'': fail
	},

	'tag:attr:value:read': {
		'\\': () => {
			_slashes++;
			return '->';
		},

		'"': (lex:Lexer, bone:Bone) => {
			if (lex.code === QUOTE_CODE) { // chr: "
				if (!(_slashes % 2)) {
					bone.raw.attrs[_attr] = lex.takeToken();
					return 'tag:attrs';
				}
			}
	
			_slashes = 0;
			return '->';
		},

		'': () => {
			_slashes = 0;
			return '->';
		}
	}
}, {
	onend: (lex:Lexer, bone:Bone) => {
		if (lex.lastIdx < lex.length) {
			addText(bone, lex.getToken(0, -1));
		}

		if (bone.type !== '#root') {
			lex.error('<' + bone.raw.name + '/> must be closed', bone);
		}
	}
});
