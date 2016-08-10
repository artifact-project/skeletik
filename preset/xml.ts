import skeletik, {Lexer, Bone, SkeletikParser} from '../skeletik';
import * as utils from './utils';

// Shortcut codes
const QUOTE_CODE = utils.QUOTE_CODE; // "
const MINUS_CODE = utils.MINUS_CODE; // -
const CLOSE_BRACKET_CODE = utils.CLOSE_BRACKET_CODE; // ] 

let slashes = 0;
let attrName;
let tokensChain = [];

// Shortcut methods
const add = utils.add;
const addTag = utils.addTag;
const addComment = utils.addComment;
const addCDATA = utils.addCDATA;
const fail = utils.fail;
const expressionMixin = utils.expressionMixin;

function setBooleanAttr(lex:Lexer, bone:Bone):void {
	bone.raw.attrs[lex.takeToken()] = true;
}

function addText(parent:Bone, token) {
	if (tokensChain.length) {
		token && tokensChain.push(token);
		add(parent, utils.TEXT_TYPE, {value: tokensChain});
		tokensChain = [];
	} else if (token) {
		add(parent, utils.TEXT_TYPE, {value: token});
	}
}

const TO_TAG_NAME_STATE = '>tag:name';

// Export parser
export default <SkeletikParser>skeletik({
	'$ws': [' ', '	', '\n'],
	'$name': ['a-z', 'A-Z', '-', ':', '0-9'],
	'$name_start': ['a-z', 'A-Z', '_'],
	'$attr': ['a-z', 'A-Z', '-', '_', ':', '@', '0-9']
}, {
	'': {
		'<': 'entry:open',
		'': '>text'
	},

	'entry:open': {
		'$': TO_TAG_NAME_STATE,
		'$name_start': TO_TAG_NAME_STATE,
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

	'text': expressionMixin(() => tokensChain, {
		'<': (lex:Lexer, parent:Bone) => {
			addText(parent, lex.takeToken());
			return 'entry:open';
		},
		'': '->'
	}),

	'tag:name': expressionMixin(() => tokensChain, {
		'$name': '->',

		'/': (lex:Lexer, parent:Bone) => {
			addTag(parent, lex.takeToken(), tokensChain);
			return 'tag:end';
		},

		'>': (lex:Lexer, parent:Bone) => [addTag(parent, lex.takeToken(), tokensChain), ''],
		'$ws': (lex:Lexer, parent:Bone) => [addTag(parent, lex.takeToken(), tokensChain), 'tag:attrs']
	}),

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
			attrName = lex.takeToken();
			return 'tag:attr:value:await';
		},

		'': fail
	},
	
	'tag:attr:value:await': {
		'"': () => {
			slashes = 0;
			return 'tag:attr:value:read';
		},
		'': fail
	},

	'tag:attr:value:read': {
		'\\': () => {
			slashes++;
			return '->';
		},

		'"': (lex:Lexer, bone:Bone) => {
			if (lex.code === QUOTE_CODE) { // chr: "
				if (!(slashes % 2)) {
					bone.raw.attrs[attrName] = lex.takeToken();
					return 'tag:attrs';
				}
			}
	
			slashes = 0;
			return '->';
		},

		'': () => {
			slashes = 0;
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
