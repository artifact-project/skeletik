// todo: ошибки на закрытие тега + onend

define(['qunit', 'skeletik/preset/xtpl'], function (QUnit, xtplParser) {
	'use strict';

	QUnit.module('xtpl');

	QUnit.test('| foo-bar', function (assert) {
		var frag = xtplParser('| foo-bar');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.type, 'text');
		assert.equal(frag.first.length, 0);
		assert.deepEqual(frag.first.raw, {value: 'foo-bar'});
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

	QUnit.test('i.foo.bar | qux', function (assert) {
		var frag = xtplParser('i.foo.bar | qux');
		assert.equal(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'i', attrs: {class: 'foo bar'}});
		assert.deepEqual(frag.first.length, 1);
		assert.deepEqual(frag.first.first.raw, {value: 'qux'});
	});

	QUnit.test('i > b', function (assert) {
		var frag = xtplParser('i > b');
		assert.equal(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'i', attrs: {}});
		assert.deepEqual(frag.first.length, 1);
		assert.deepEqual(frag.first.first.raw, {name: 'b', attrs: {}});
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
		var frag = xtplParser('i > b + em | foo');
		assert.equal(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'i', attrs: {}});
		assert.deepEqual(frag.first.length, 2);
		assert.deepEqual(frag.first.first.raw, {name: 'b', attrs: {}});
		assert.deepEqual(frag.first.last.raw, {name: 'em', attrs: {}});
		assert.deepEqual(frag.first.last.length, 1);
		assert.deepEqual(frag.first.last.first.raw, {value: 'foo'});
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
		var frag = xtplParser('a[href=".."] | link');
		assert.deepEqual(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'a', attrs: {href: '..'}});
		assert.deepEqual(frag.first.first.raw, {value: 'link'});

		frag = xtplParser('a[href=".."]\n| link');
		assert.deepEqual(frag.length, 2);
		assert.deepEqual(frag.first.raw, {name: 'a', attrs: {href: '..'}});
		assert.deepEqual(frag.last.raw, {value: 'link'});

		frag = xtplParser('a[href=".."]{| link\n}');
		assert.deepEqual(frag.length, 1);
		assert.deepEqual(frag.first.raw, {name: 'a', attrs: {href: '..'}});
		assert.deepEqual(frag.first.first.raw, {value: 'link'});

		frag = xtplParser('i{a[href=".."]}');
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

			assert.deepEqual(frag.length, 1);
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
	});

	QUnit.test('if else', function (assert) {
		// todo: Ошибки
		function testMe(tpl, elseIf) {
			var frag = xtplParser(tpl);

			assert.deepEqual(frag.length, 2 + !!elseIf);

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
		testMe('if(1){.foo}else if(-1){i.baz}else{b.bar}', true);
	});

	QUnit.test('for-in', function (assert) {
		function testMe(tpl) {
			var frag = xtplParser(tpl);

			assert.deepEqual(frag.length, 1);
			assert.deepEqual(frag.first.type, 'keyword');
			assert.deepEqual(frag.first.raw, {name: 'for', attrs: {as: 'val', data: 'foo.bar'}});
			assert.deepEqual(frag.first.length, 1);
			assert.deepEqual(frag.first.first.raw, {name: 'div', attrs: {class: 'foo'}});
		}

		// testMe('for(val in foo.bar){.foo}');
		testMe('for (val in foo.bar) {.foo}');
		// testMe('for ( val in foo.bar ) {.foo}');
	});
});