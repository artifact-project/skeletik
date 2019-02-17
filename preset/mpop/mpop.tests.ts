import { Loc, mpop } from './mpop';
import { existsSync, readFileSync } from 'fs';
import { Bone } from '../../src/skeletik/skeletik';

export const parse = (name: string, path = __dirname) => {
	const filename = `${path}/__fixture__/${name}.tpl`;

	// if (local && !existsSync(filename)) {
	// 	return false;
	// }

	const raw = readFileSync(filename) + '';

	// `JSON.stringify` + `JSON.parse needs` for converting bone to plain objects
	return {
		ast: JSON.parse(JSON.stringify(mpop(raw))),
		raw,
		filename,
	};
};

export const stringify = (bone: Bone) => {
	if (!bone) {
		return '';
	}

	const {
		type,
		raw,
		nodes,
	} = bone;

	if (type === '#root') {
		return nodes.map(stringify).join('');
	} else if (type === '#text') {
		return raw.value;
	} else if (type === 'VALUE') {
		return `##${raw.name}##`;
	} else if (type === 'CALL') {
		return `##${raw.name}(${raw.args.join(',')})##`;
	} else if (type === 'SET') {
		return `##SetVars(${raw.name}=${raw.value})##`;
	} else if (type === 'INCLUDE' || type === 'CONTINUE' || type === 'BREAK') {
		return `<!-- ${type}${raw.value ? ` ${raw.value}` : ''} -->`;
	} else if (type === 'FOR') {
		return `<!-- FOR ${raw.data} -->${nodes.map(stringify).join('')}<!-- /FOR -->`;
	} else if (/^(ELSE|IF)/.test(type)) {
		const {
			ending,
			consequent,
			alternate,
		} = raw;

		return `<!-- ${type}${raw.test ? ` ${raw.test}` : ''} -->${
			nodes.length ? nodes.map(stringify).join('') :
			[
				consequent ? consequent.nodes.map(stringify).join('') : '',
				stringify(alternate),
			].join('')
		}${/^IF/.test(type) ? `<!-- /${type}${ending ? ` ${ending}` : ''} -->` : ''}`;
	}
};

export const stringifyTypes = (bone: Bone) => {
	if (!bone) {
		return '';
	}

	const {
		type,
		raw,
		nodes,
	} = bone;

	if (type === '#root') {
		return nodes.map(stringifyTypes).join('');
	} else if (type === '#text') {
		return raw.value;
	} else if (['VALUE', 'CALL', 'SET', 'INCLUDE', 'CONTINUE', 'BREAK'].includes(type)) {
		return `[${type}]`;
	} else if (['FOR'].includes(type)) {
		return `[${type}]${nodes.map(stringifyTypes).join('')}[/${type}]`;
	} else if (/^(ELSE|IF)/.test(type)) {
		const {
			consequent,
			alternate,
		} = raw;

		return `[${type}]${
			nodes.length ? nodes.map(stringifyTypes).join('') :
			[
				consequent ? consequent.nodes.map(stringifyTypes).join('') : '',
				stringifyTypes(alternate),
			].join('')
		}${/^IF/.test(type) ? `[/${type}]` : ''}`;
	}
};

it('text', () => {
	const {ast} = parse('text');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('SetVars', () => {
	const {ast} = parse('set-vars');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('SetVars with expression', () => {
	const {ast} = parse('set-vars.expr');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('call', () => {
	const {ast} = parse('call');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('include', () => {
	const {ast} = parse('include');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('value', () => {
	const {ast} = parse('value');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('if', () => {
	const {ast} = parse('if');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('if-ending', () => {
	const {ast} = parse('if.ending');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('ifdef', () => {
	const {ast} = parse('if.def');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('ifnot', () => {
	const {ast} = parse('if.not');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('ifnotdef', () => {
	const {ast} = parse('if.not.def');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('if-else', () => {
	const {ast} = parse('if.else');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('if-elseif-else', () => {
	const {ast} = parse('if.elseif.else');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('if-elseif-notdef-else', () => {
	const {ast} = parse('if.elseif.notdef.else');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('if-else-if-else', () => {
	const {ast} = parse('if.else-if.else');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('if-else-if-notdef-else', () => {
	const {ast} = parse('if.else-if.notdef.else');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});

it('for', () => {
	const {ast} = parse('for');
	expect(stringify(ast)).toMatchSnapshot();
	expect(stringifyTypes(ast)).toMatchSnapshot();
});
