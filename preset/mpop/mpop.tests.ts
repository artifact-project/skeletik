import { Loc, mpop } from './mpop';
import { readFileSync } from 'fs';


describe('mpop', () => {
	const node = (type: string, raw: object, loc: Loc, nodes = []) => ({
		type,
		raw: raw ? {
			loc,
			...raw,
		} : null,
		nodes,
	});

	const parse = (name: string) => {
		// `JSON.stringify` + `JSON.parse needs` for converting bone to plain objects
		const content = readFileSync(`${__dirname}/__fixture__/mpop.${name}.tpl`) + '';
		return JSON.parse(JSON.stringify(mpop(content)));
	};

	it('SetVars', () => {
		expect(parse('set-vars')).toEqual({
			type: '#root',
			raw: null,
			nodes: [
				node('SET_VARS', {name: 'TRUE', value: '1'}, {start: [1, 1], end: [1, 20]}),
				node('SET_VARS', {name: 'HOST', value: 'mail.ru'}, {start: [2, 1], end: [2, 26]}),
			],
		});
	});

	it('SetVars with expression', () => {
		expect(parse('set-vars.expr')).toEqual({
			type: '#root',
			raw: null,
			nodes: [
				node('SET_VARS', {name: 'VID', value: '##GET_VID##'}, {start: [1, 1], end: [1, 29]}),
				node('SET_VARS', {name: 'FOO_JIGURDA', value: 'FMAIL-123-##VID##'}, {start: [2, 1], end: [2, 43]}),
				node('SET_VARS', {name: 'BAR_JIGURDA', value: '##VID##-FMAIL-456'}, {start: [3, 1], end: [3, 43]}),
				node('SET_VARS', {name: 'QUX_JIGURDA', value: 'feature-##IP##-##VID##-FMAIL-789'}, {start: [4, 1], end: [4, 58]}),
			],
		});
	});

	it('include', () => {
		expect(parse('include')).toEqual({
			type: '#root',
			raw: null,
			nodes: [
				node('INCLUDE', {src: './foo.html'}, {start: [1, 1], end: [1, 28]}),
			],
		});
	});

	it('value', () => {
		expect(parse('value')).toEqual({
			type: '#root',
			raw: null,
			nodes: [
				node('VALUE', {name: 'UserName'}, {start: [1, 5], end: [1, 17]}),
			],
		});
	});

	it('if', () => {
		expect(parse('if')).toEqual({
			type: '#root',
			raw: null,
			nodes: [
				node('IF', {
					test: 'true',
					consequent: node('#block', null, {start: [1, 17], end: [3, 1]}, [
						node('VALUE', {name: 'UserName'}, {start: [2, 6], end: [2, 18]}),
					]),
					alternate: null,
				}, {start: [1, 1], end: [3, 13]}),
			],
		});
	});
});
