// todo: ошибки на закрытие тега + onend

define(['qunit', 'skeletik/preset/xtpl'], function (QUnit, xtplParser) {
	'use strict';

	QUnit.module('skeletik:xtpl');

	// Define keywords
	var keywords = xtplParser.keywords;
	
	keywords.add('if', ' ( @test:js )');

	keywords.add('else', ' if ( @test:js )', {
		optional: true,
		validate: function (lex, bone) {
			var raw = bone.prev ? bone.prev.raw : {};

			if (!(raw.name === 'if' || raw.name === 'else' && raw.attrs.test)) {
				lex.error('Unexpected token else', bone);
			}
		}
	});

	keywords.add('for', [
		' ( @as:var in @data:js )',
		' ( [ @key:var , @as:var ] in @data:js )'
	]);

	xtplParser = xtplParser['default'];

	QUnit.test('| foo-bar', function (assert) {
		var frag = xtplParser('| foo-bar');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.type, 'text');
		assert.equal(frag.first.length, 0);
		assert.deepEqual(frag.first.raw, {value: 'foo-bar'});
	});

	QUnit.test('!html5', function (assert) {
		var frag = xtplParser('!html5');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.type, 'dtd');
		assert.equal(frag.first.length, 0);
		assert.deepEqual(frag.first.raw, {value: 'html5'});
	});

	QUnit.test('b', function (assert) {
		var frag = xtplParser('b');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.type, 'tag');
		assert.deepEqual(frag.first.raw, {name: 'b', attrs: {}});
	});

	QUnit.test('b | foo', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);
			assert.equal(frag.length, 1);
			assert.equal(frag.first.type, 'tag');
			assert.deepEqual(frag.first.raw, {name: 'b', attrs: {}});
			assert.deepEqual(frag.first.length, 1);
			assert.deepEqual(frag.first.first.type, 'text');
			assert.deepEqual(frag.first.first.raw, {value: 'foo'});
		}

		testMe('b|foo');
		testMe('b |foo');
		testMe('b| foo');
		testMe('b | foo');
	});

	QUnit.test('#foo', function (assert) {
		var frag = xtplParser('#foo');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.type, 'tag');
		assert.deepEqual(frag.first.raw, {name: 'div', attrs: {id: 'foo'}});
	});

	QUnit.test('#foo//bar or .foo//bar', function (assert) {
		function testMe(tpl, attrs) {
			var frag = xtplParser(tpl);
			assert.equal(frag.length, 2);
			assert.equal(frag.first.type, 'tag');
			assert.deepEqual(frag.first.raw, {name: 'div', attrs: attrs});
			assert.equal(frag.last.type, 'comment');
			assert.deepEqual(frag.last.raw, {value: 'bar'});
		}

		testMe('#foo//bar', {id: 'foo'});
		testMe('#foo // bar', {id: 'foo'});

		testMe('.foo//bar', {class: 'foo'});
		testMe('.foo // bar', {class: 'foo'});
	});

	QUnit.test('.foo', function (assert) {
		var frag = xtplParser('.foo');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.type, 'tag');
		assert.deepEqual(frag.first.raw, {name: 'div', attrs: {class: 'foo'}});
	});

	QUnit.test('.foo.bar', function (assert) {
		var frag = xtplParser('.foo.bar');
		assert.equal(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'div', attrs: {class: 'foo bar'}});
	});

	QUnit.test('i.foo.bar', function (assert) {
		var frag = xtplParser('i.foo.bar');
		assert.equal(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'i', attrs: {class: 'foo bar'}});
	});

	QUnit.test('#foo.bar', function (assert) {
		function testMe(tpl, tag) {
			var frag = xtplParser(tpl);
			assert.equal(frag.length, 1);
			assert.deepEqual(frag.first.raw, {name: tag || 'div', attrs: {id: 'foo', class: 'bar'}});
		}

		testMe('#foo.bar');
		testMe('.bar#foo');

		testMe('i#foo.bar', 'i');
		testMe('i.bar#foo', 'i');
	});

	QUnit.test('.foo.bar[baz]', function (assert) {
		var frag = xtplParser('.foo.bar[baz]');
		assert.deepEqual(frag.length, 1);
		assert.deepEqual(frag.first.raw.attrs, {class: 'foo bar', baz: true});
	});

	QUnit.test('.foo > .&-bar', function (assert) {
		var frag = xtplParser('.foo > .&-bar');
		assert.deepEqual(frag.first.raw.attrs, {class: 'foo'});
		assert.deepEqual(frag.first.first.raw.attrs, {class: 'foo-bar'});
	});

	QUnit.test('.foo > %-bar > .&-baz', function (assert) {
		var frag = xtplParser('.foo > %-bar > .&-baz');
		assert.deepEqual(frag.first.raw.attrs, {class: 'foo'});
		assert.deepEqual(frag.first.first.type, 'hidden:class');
		assert.deepEqual(frag.first.first.raw.attrs, {class: 'foo-bar'});
		assert.deepEqual(frag.first.first.first.raw.attrs, {class: 'foo-bar-baz'});
	});

	QUnit.test('i.foo.bar | qux', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);
			assert.equal(frag.length, 1, tpl);
			assert.deepEqual(frag.first.raw, {name: 'i', attrs: {class: 'foo bar'}});
			assert.deepEqual(frag.first.length, 1);
			assert.deepEqual(frag.first.first.raw, {value: 'qux'});
		}

		testMe('i.foo.bar|qux');
		testMe('i.foo.bar | qux');
		testMe('i.foo.bar{|qux\n}');
	});

	QUnit.test('i > b', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);
			assert.equal(frag.length, 1, tpl);
			assert.deepEqual(frag.first.raw, {name: 'i', attrs: {}});
			assert.deepEqual(frag.first.length, 1);
			assert.deepEqual(frag.first.first.raw, {name: 'b', attrs: {}});
		}

		testMe('i>b');
		testMe('i >b');
		testMe('i> b');
		testMe('i > b');
	});

	QUnit.test('i > b | foo', function (assert) {
		var frag = xtplParser('i > b | foo');
		assert.equal(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'i', attrs: {}});
		assert.deepEqual(frag.first.length, 1);
		assert.deepEqual(frag.first.first.raw, {name: 'b', attrs: {}});
		assert.deepEqual(frag.first.first.length, 1);
		assert.deepEqual(frag.first.first.first.raw, {value: 'foo'});
	});

	QUnit.test('i > b + em | foo', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);
			assert.equal(frag.length, 1, tpl);
			assert.deepEqual(frag.first.raw, {name: 'i', attrs: {}});
			assert.deepEqual(frag.first.length, 2);
			assert.deepEqual(frag.first.first.raw, {name: 'b', attrs: {}});
			assert.deepEqual(frag.first.last.raw, {name: 'em', attrs: {}});
			assert.deepEqual(frag.first.last.length, 1);
			assert.deepEqual(frag.first.last.first.raw, {value: 'foo'});
		}

		testMe('i>b+em|foo');
		testMe('i > b +em|foo');
		testMe('i > b+ em|foo');
		testMe('i > b + em|foo');
		testMe('i > b + em | foo');
	});

	QUnit.test('i.foo\\n.bar', function (assert) {
		var frag = xtplParser('i.foo\n.bar');
		assert.equal(frag.length, 2);
		assert.deepEqual(frag.first.raw, {name: 'i', attrs: {class: 'foo'}});
		assert.deepEqual(frag.last.raw, {name: 'div', attrs: {class: 'bar'}});
	});

	QUnit.test('i{}', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);
			assert.equal(frag.length, 1, tpl + ' -- root.length');
			assert.deepEqual(frag.first.raw, {name: 'i', attrs: {}}, tpl + ' -- tag');
			assert.deepEqual(frag.first.length, 0, tpl + ' -- inner.length');
		}

		testMe('i{}');
		testMe('i {}');
		testMe('i{ }');
		testMe('i { }');
		testMe('i{\n}');
	});

	QUnit.test('i { b }', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);
			assert.equal(frag.length, 1, tpl + ' -- root.length');
			assert.deepEqual(frag.first.raw, {name: 'i', attrs: {}}, tpl + ' -- tag');
			assert.deepEqual(frag.first.length, 1, tpl + ' -- inner.length');
			assert.deepEqual(frag.first.first.raw, {name: 'b', attrs: {}});
		}

		testMe('i{b}');
		testMe('i{ b }');
		testMe('i{\nb }');
		testMe('i{b\n}');
		testMe('i{\nb\n}');
	});

	QUnit.test('i {.bar} em | wow', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);
			assert.deepEqual(frag.length, 2);
			assert.deepEqual(frag.first.length, 1);
			assert.deepEqual(frag.first.raw, {name: 'i', attrs: {}});
			assert.deepEqual(frag.first.first.raw, {name: 'div', attrs: {class: 'bar'}});
			assert.deepEqual(frag.last.length, 1);
			assert.deepEqual(frag.last.raw, {name: 'em', attrs: {}});
			assert.deepEqual(frag.last.first.raw, {value: 'wow'});
		}

		testMe('i {.bar} em | wow');
		testMe('i{.bar}em|wow');
	});

	QUnit.test('// comment', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);
			assert.deepEqual(frag.length, 1);
			assert.deepEqual(frag.first.length, 0);
			assert.deepEqual(frag.first.type, 'comment');
			assert.deepEqual(frag.first.raw, {value: 'foo'});
		}

		testMe('//foo');
		testMe('// foo');
	});

	QUnit.test('tag // comment', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);
			assert.deepEqual(frag.length, 2);
			assert.deepEqual(frag.first.type, 'tag');
			assert.deepEqual(frag.last.type, 'comment');
			assert.deepEqual(frag.last.raw, {value: 'foo'});
		}

		testMe('div//foo');
		testMe('div // foo');
		testMe('.foo // foo');
		testMe('i.foo // foo');
	});

	QUnit.test('/* multi comment */', function (assert) {
		var frag = xtplParser('i/*foo\n\tbar*/.foo');
		assert.deepEqual(frag.length, 3);
		assert.deepEqual(frag.nodes[0].raw, {name: 'i', attrs: {}});
		assert.deepEqual(frag.nodes[1].type, 'comment');
		assert.deepEqual(frag.nodes[1].raw, {value: 'foo\n\tbar'});
		assert.deepEqual(frag.nodes[2].raw, {name: 'div', attrs: {class: 'foo'}});
	});

	QUnit.test('input[type="radio"][checked]', function (assert) {
		var frag = xtplParser('input[type="radio"][checked]');
		assert.deepEqual(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'input', attrs: {type: 'radio', checked: true}});
	});

	QUnit.test('a[href=".."] | link', function (assert) {
		var frag;
		
		frag = xtplParser('a[href=".."] | link');
		assert.deepEqual(frag.length, 1, 'a[href=".."] | link');
		assert.deepEqual(frag.first.raw, {name: 'a', attrs: {href: '..'}});
		assert.deepEqual(frag.first.first.raw, {value: 'link'});

		frag = xtplParser('a[href=".."]\n| link');
		assert.deepEqual(frag.length, 2, 'a[href=".."]\\n| link');
		assert.deepEqual(frag.first.raw, {name: 'a', attrs: {href: '..'}});
		assert.deepEqual(frag.last.raw, {value: 'link'});

		frag = xtplParser('a[href=".."]{| link\n}', 'a[href=".."]{| link\\n}');
		assert.deepEqual(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'a', attrs: {href: '..'}});
		assert.deepEqual(frag.first.first.raw, {value: 'link'});

		frag = xtplParser('i{a[href=".."]}', 'i{a[href=".."]}');
		assert.deepEqual(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'i', attrs: {}});
		assert.deepEqual(frag.first.first.raw, {name: 'a', attrs: {href: '..'}});
	});

	QUnit.test('indent', function (assert) {
		function testMe(space) {
			var frag = xtplParser([
				'b',
				 space + 'i',
				 space + space + 'a',
				 'div',
				 space + 'u',
				 space + 'em',
				 space + space + '| ok'
			].join('\n'));

			assert.deepEqual(frag.length, 2);
			assert.deepEqual(frag.nodes[0].raw, {name: 'b', attrs: {}});
			assert.deepEqual(frag.nodes[0].length, 1);
			assert.deepEqual(frag.nodes[0].first.raw, {name: 'i', attrs: {}});
			assert.deepEqual(frag.nodes[0].first.length, 1);
			assert.deepEqual(frag.nodes[0].first.first.raw, {name: 'a', attrs: {}});

			assert.deepEqual(frag.nodes[1].raw, {name: 'div', attrs: {}});
			assert.deepEqual(frag.nodes[1].length, 2);
			assert.deepEqual(frag.nodes[1].first.raw, {name: 'u', attrs: {}});
			assert.deepEqual(frag.nodes[1].last.raw, {name: 'em', attrs: {}});
			assert.deepEqual(frag.nodes[1].last.first.raw, {value: 'ok'});
		}

		testMe('\t');
		testMe('  ');
	});

	QUnit.test('indent + levels', function (assert) {
		var frag = xtplParser([
			'i > em > b',
			'  div',
			'span'
		].join('\n'));

		assert.deepEqual(frag.length, 2);
		assert.deepEqual(frag.nodes[0].raw.name, 'i');
		assert.deepEqual(frag.nodes[1].raw.name, 'span');

		assert.deepEqual(frag.nodes[0].length, 1);
		assert.deepEqual(frag.nodes[0].nodes[0].raw.name, 'em');
		
		assert.deepEqual(frag.nodes[0].nodes[0].length, 1);
		assert.deepEqual(frag.nodes[0].nodes[0].nodes[0].raw.name, 'b');

		assert.deepEqual(frag.nodes[0].nodes[0].nodes[0].length, 1);
		assert.deepEqual(frag.nodes[0].nodes[0].nodes[0].nodes[0].raw.name, 'div');
	});

	QUnit.test('indent + levels (with text)', function (assert) {
		var frag = xtplParser([
			'i',
			'  x > em | foo',
			'  y > em | bar',
		].join('\n'));

		assert.deepEqual(frag.length, 1);
		assert.deepEqual(frag.nodes[0].raw.name, 'i');

		assert.deepEqual(frag.nodes[0].length, 2);
		assert.deepEqual(frag.nodes[0].nodes[0].raw.name, 'x');
		assert.deepEqual(frag.nodes[0].nodes[1].raw.name, 'y');
		
		assert.deepEqual(frag.nodes[0].nodes[0].length, 1);
		assert.deepEqual(frag.nodes[0].nodes[0].nodes[0].raw.name, 'em');
		assert.deepEqual(frag.nodes[0].nodes[0].nodes[0].first.raw.value, 'foo');

		assert.deepEqual(frag.nodes[0].nodes[1].length, 1);
		assert.deepEqual(frag.nodes[0].nodes[1].nodes[0].raw.name, 'em');
		assert.deepEqual(frag.nodes[0].nodes[1].nodes[0].first.raw.value, 'bar');
	});

	QUnit.test('indent + empty lines', function (assert) {
		var frag = xtplParser([
			'i',
			'	b',
			'',
			'		em',
			'',
			'		b',
		].join('\n'))

		assert.equal(frag.length, 1);
		assert.equal(frag.first.length, 1);
		assert.equal(frag.first.first.length, 2);
	});

	QUnit.test('indent + {}', function (assert) {
		var frag = xtplParser([
			'div',
			'  b { i + i }',
			'  u {',
			'    | foo',
			'  }',
			'  em',
			'span'
		].join('\n'));

		assert.deepEqual(frag.length, 2);
		assert.deepEqual(frag.nodes[0].raw, {name: 'div', attrs: {}});
		assert.deepEqual(frag.nodes[0].length, 3);
		assert.deepEqual(frag.nodes[0].nodes[0].raw, {name: 'b', attrs: {}});
		assert.deepEqual(frag.nodes[0].nodes[0].length, 2);
		assert.deepEqual(frag.nodes[0].nodes[0].nodes[0].raw, {name: 'i', attrs: {}});
		assert.deepEqual(frag.nodes[0].nodes[0].nodes[1].raw, {name: 'i', attrs: {}});
		assert.deepEqual(frag.nodes[0].nodes[1].raw, {name: 'u', attrs: {}});
		assert.deepEqual(frag.nodes[0].nodes[1].length, 1);
		assert.deepEqual(frag.nodes[0].nodes[1].nodes[0].raw, {value: 'foo'});
		assert.deepEqual(frag.nodes[0].nodes[2].raw, {name: 'em', attrs: {}});
		assert.deepEqual(frag.nodes[1].raw, {name: 'span', attrs: {}});
	});

	QUnit.test('form', function (assert) {
		var frag = xtplParser([
			'form {',
			'  // list',
			'  h1 | Todos',
			'  ul.list {',
			'  }',
			'}'
		].join('\n'));

		assert.deepEqual(frag.length, 1);
		assert.deepEqual(frag.first.length, 3);
		assert.deepEqual(frag.first.raw, {name: 'form', attrs: {}});
		assert.deepEqual(frag.first.nodes[0].type, 'comment');
		assert.deepEqual(frag.first.nodes[1].type, 'tag');
		assert.deepEqual(frag.first.nodes[1].raw, {name:'h1', attrs: {}});
		assert.deepEqual(frag.first.nodes[1].first.raw, {value: 'Todos'});
		assert.deepEqual(frag.first.nodes[2].type, 'tag');
		assert.deepEqual(frag.first.nodes[2].raw, {name: 'ul', attrs: {class: 'list'}});
	});

	QUnit.test('if', function (assert) {
		function testMe(val, tpl, length) {
			var frag = xtplParser(tpl);

			assert.deepEqual(frag.length, 1, tpl);
			assert.deepEqual(frag.first.type, 'keyword');
			assert.deepEqual(frag.first.raw, {name: 'if', attrs: {test: val}});
			assert.deepEqual(frag.first.length, length || 1);
			assert.deepEqual(frag.first.first.raw, {name: 'div', attrs: {class: 'foo'}});

			if (length == 2) {
				assert.deepEqual(frag.first.last.raw, {name: 'span', attrs: {class: 'bar'}});
			}
		}

		testMe('.5', 'if(.5){.foo}');
		testMe('true', 'if (true) {.foo}');
		testMe('1.2', 'if (1.2)\n\t.foo\n\tspan.bar', 2);
		testMe('-8', 'if ( -8 ) {.foo}');
		testMe('foo.bar', 'if(foo.bar){.foo}');
		testMe('foo.bar', 'if(foo.bar) { .foo }');
		testMe('foo.bar', 'if(foo.bar){div.foo}');
		testMe('foo.bar', 'if (foo.bar) { div.foo }');
	});

	QUnit.test('if else', function (assert) {
		// todo: Ошибки
		function testMe(tpl, elseIf) {
			var frag = xtplParser(tpl);

			assert.deepEqual(frag.length, 2 + !!elseIf, tpl);

			assert.deepEqual(frag.first.type, 'keyword');
			assert.deepEqual(frag.first.raw, {name: 'if', attrs: {test: '1'}});
			assert.deepEqual(frag.first.length, 1);
			assert.deepEqual(frag.first.first.raw, {name: 'div', attrs: {class: 'foo'}});

			if (elseIf) {
				assert.deepEqual(frag.nodes[1].type, 'keyword');
				assert.deepEqual(frag.nodes[1].raw, {name: 'else', attrs: {test: '-1'}});
				assert.deepEqual(frag.nodes[1].length, 1);
				assert.deepEqual(frag.nodes[1].first.raw, {name: 'i', attrs: {class: 'baz'}});
			}
			
			assert.deepEqual(frag.last.type, 'keyword');
			assert.deepEqual(frag.last.raw, {name: 'else', attrs: {}});
			assert.deepEqual(frag.last.length, 1);
			assert.deepEqual(frag.last.first.raw, {name: 'b', attrs: {class: 'bar'}});
		}

		testMe('if(1){.foo}else{b.bar}');
		testMe('if(1)\n\t.foo\nelse\n\tb.bar');
		testMe('if(1)  \n\t.foo\nelse  \n\tb.bar');
		testMe('if(1){.foo}else if(-1){i.baz}else{b.bar}', true);
		testMe('if(1) { .foo } else if (-1) { i.baz } else { b.bar }', true);
	});

	QUnit.test('else / errors', function (assert) {
		function testMe(tpl) {
			try {
				xtplParser(tpl);
				assert.ok(false, 'Error?');
			} catch (err) {
				assert.equal(err.message, 'Unexpected token else');
			}
		}

		testMe('else{}');
		testMe('if(1){}else{}else{}');
	});

	QUnit.test('for (val in data)', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);

			assert.deepEqual(frag.length, 1, tpl);
			assert.deepEqual(frag.first.type, 'keyword');
			assert.deepEqual(frag.first.raw, {name: 'for', attrs: {as: 'val', data: 'foo.bar'}});
			assert.deepEqual(frag.first.length, 1);
			assert.deepEqual(frag.first.first.raw, {name: 'div', attrs: {class: 'foo'}});
		}

		testMe('for(val in foo.bar){.foo}');
		testMe('for (val in foo.bar) {.foo}');
		testMe('for ( val in foo.bar ) {.foo}');
	});

	QUnit.test('for ([idx, val] in data)', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);

			assert.deepEqual(frag.length, 1, tpl);
			assert.deepEqual(frag.first.type, 'keyword');
			assert.deepEqual(frag.first.raw, {name: 'for', attrs: {as: 'val', key: 'idx', data: '[1,2]'}});
			assert.deepEqual(frag.first.length, 1);
			assert.deepEqual(frag.first.first.raw, {name: 'div', attrs: {class: 'foo'}});
		}

		testMe('for([idx, val] in [1,2]){.foo}');
		testMe('for ( [ idx , val ] in [1,2] ) { .foo }');
	});

	QUnit.test('foo = [..]/{..}/(..)', function (assert) {
		function testMe(tpl, type, attrs) {
			var frag = xtplParser(tpl);
			
			assert.deepEqual(frag.length, 1, type + ': ' + tpl);
			assert.deepEqual(frag.first.type, 'define');
			assert.deepEqual(frag.first.raw.name, 'foo');
			assert.deepEqual(frag.first.raw.type, type);
			assert.deepEqual(frag.first.raw.attrs, attrs);
		}

		var types = {
			'brace': '{}',
			'bracket': '[]',
			'parenthesis': '()'
		};

		Object.keys(types).forEach(function (type) {
			var tmp = types[type].split('');
			var o = tmp[0];
			var c = tmp[1];

			testMe('foo=' + o + c, type, []);
			testMe('foo = ' + o + ' ' + c, type, []);
			testMe('foo = ' + o + 'bar' + c, type, ['bar']);
			testMe('foo = ' + o + ' bar ' + c, type, ['bar']);
			testMe('foo = ' + o + ' bar , qux ' + c, type, ['bar', 'qux']);
		});
	});
});
