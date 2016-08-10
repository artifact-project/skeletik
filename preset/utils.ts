import {Lexer, Bone, SkeletikState} from '../skeletik';
import expressionParser from './expression';
import xmlParser from './xml';

// Types
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
export const GROUP_TYPE = 'group';
export const CDATA_TYPE = 'cdata';

// Codes
export const ENTER_CODE = 10; // "\n"
export const SPACE_CODE = 32; // " "
export const DOT_CODE = 46; // "."
export const COMMA_CODE = 44; // ","
export const PIPE_CODE = 124; // "|"
export const SLASH_CODE = 47; // "/"
export const BACKSLASH_CODE = 92; // "\"
export const ASTERISK_CODE = 42; // "*"
export const OPEN_BRACE_CODE = 123; // "{"
export const CLOSE_BRACE_CODE = 125; // "}"
export const OPEN_BRACKET_CODE = 91; // "["
export const CLOSE_BRACKET_CODE = 93; // "]"
export const OPEN_PARENTHESIS_CODE = 40; // "("
export const CLOSE_PARENTHESIS_CODE = 41; // ")"
export const HASHTAG_CODE = 35; // "#"
export const EQUAL_CODE = 61; // "="
export const LT_CODE = 60; // "<"
export const GT_CODE = 62; // ">"
export const PLUS_CODE = 43; // "+"
export const QUOTE_CODE = 34;
export const MINUS_CODE = 45;

export function add(parent:Bone, type:string, raw?:any):Bone {
	return parent.add(type, raw).last;
}

export function addComment(parent:Bone, value:string):void {
	add(parent, COMMENT_TYPE, {value: value.trim()});
}

export function addTag(parent:Bone, name):Bone {
	return add(parent, TAG_TYPE, {name: name, attrs: {}});
}

export function addKeyword(parent:Bone, name:string):Bone {
	return add(parent, KEYWORD_TYPE, {name: name, attrs: {}});
}

export function addCDATA(parent:Bone, value:string):void {
	add(parent, CDATA_TYPE, {value: value});
}

export function fail(lex:Lexer, bone:Bone):void {
	lex.error(`Invalid character \`${lex.getChar()}\`, state: ${lex.state}`, bone);
}

export function parseXML(lex:Lexer):Bone[] {
	return xmlParser.capture(lex, {
		onpeek(lex, bone) {
			return !(bone.type === ROOT_TYPE && (lex.prevCode === PIPE_CODE && lex.code === HASHTAG_CODE));
		}
	}).nodes;
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

export function expressionMixin(getter:(bone?:Bone) => any[], states):SkeletikState {
	const mixStates = {};

	mixStates['$'] = (lex:Lexer, bone) => {
		if (lex.prevCode !== BACKSLASH_CODE && lex.peek(+1) === OPEN_BRACE_CODE) {
			const state = lex.state;
			const token = lex.takeToken();
			const expr = parseJS(lex, CLOSE_BRACE_CODE).slice(2);
			const list = getter(bone);

			token && list.push(token);
			list.push({type: EXPRESSION_TYPE, raw: expr});

			return '>' + state;
		}

		return '->';
	};

	for (const key in states) {
		mixStates[key] = states[key];
	}

	return <SkeletikState>mixStates;
}