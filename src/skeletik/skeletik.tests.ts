import skeletik from './skeletik';

it('ranges:fail', () => {
	try {
		skeletik({'-': ['1']}, {});
	} catch (err) {
		expect(err.message).toBe("skeletik#ranges: 'name' of range can consist only 'a-z', '_' or '$'");
	}
});

it('a + b', () => {
	const parser = skeletik({
		'$e': ['a', 'b']
	}, {
		'': {
			'$e': '!expr',
			'+': function (lex, bone) {
				bone.add('#s', lex.takeChar());
			}
		},
		'expr': {
			'': function (lex, bone) {
				bone.add('#e', lex.takeToken());
				return '>';
			}
		}
	});

	expect(JSON.stringify(parser('a + b'), null, 2)).toBe(JSON.stringify({
		type: '#root',
		raw: null,
		nodes: [
			{type: '#e', raw: 'a', nodes: []},
			{type: '#s', raw: '+', nodes: []},
			{type: '#e', raw: 'b', nodes: []}
		]
	}, null, 2));
});
