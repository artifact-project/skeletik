define(['qunit', 'skeletik/preset/xml'], function (QUnit, xmlParser) {
	'use strict';

	QUnit.module('skeletik:xml');

	xmlParser = xmlParser['default'];

	QUnit.test('empty', function (assert) {
		var frag = xmlParser('');
		assert.equal(frag.length, 0);
	});

	QUnit.test('одна текстовая нода', function (assert) {
		var frag = xmlParser('foo-bar');

		assert.equal(frag.length, 1);
		assert.equal(frag.first.length, 0);
		assert.equal(frag.first.type, 'text');
		assert.equal(frag.first.raw.value, 'foo-bar');
	});

	QUnit.test('text + ${x}', function (assert) {
		function testMe(tpl, values, length) {
			var frag = xmlParser(tpl);

			assert.equal(frag.length, length || 1, tpl);
			assert.equal(frag.nodes[0].type, 'text');
			assert.deepEqual(frag.nodes[0].raw, {value: values});
		}

		testMe('${x}', [{raw: 'x', type: 'expression'}]);
		testMe('foo-${x}', ['foo-', {raw: 'x', type: 'expression'}]);
		testMe('${x}-bar', [{raw: 'x', type: 'expression'}, '-bar']);
		testMe('${x}<i/>', [{raw: 'x', type: 'expression'}], 2);
	});
	
	// <img/>
	['', ' ', '    '].forEach(function (pad) {
		var html = '<img' + pad + '/>';
		
		QUnit.test(html + 'x' + pad.length, function (assert) {
			var frag = xmlParser(html);
			assert.equal(frag.length, 1, 'root.length');
			assert.equal(frag.first.length, 0, 'inner.length');
			assert.equal(frag.first.type, 'tag');
			assert.deepEqual(frag.first.raw, {name: 'img', attrs: {}});
		});
	});

	// <img src/>
	['', ' ', '    '].forEach(function (pad) {
		var html = '<img src="foo.gif"' + pad + '/>';

		QUnit.test(html + 'x' + pad.length, function (assert) {
			var frag = xmlParser(html);
			assert.equal(frag.length, 1);
			assert.equal(frag.first.length, 0);
			assert.equal(frag.first.type, 'tag');
			assert.deepEqual(frag.first.raw, {
				name: 'img',
				attrs: {src: 'foo.gif'}
			});
		});
	});

	// <img src align/>
	QUnit.test('<img src=".." align=".."/>', function (assert) {
		var frag = xmlParser('<img src="foo.gif" align="bottom"/>');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.length, 0);
		assert.equal(frag.first.type, 'tag');
		assert.deepEqual(frag.first.raw, {
			name: 'img',
			attrs: {src: 'foo.gif', align: 'bottom'}
		});
	});

	// <input type checked/> + text
	['<input type="checkbox" checked/>!', '<input checked type="checkbox"/>!'].forEach(function (html) {
		QUnit.test(html, function (assert) {
			var frag = xmlParser(html);
			assert.equal(frag.length, 2);
			assert.equal(frag.first.length, 0);
			assert.equal(frag.first.type, 'tag');
			assert.deepEqual(frag.first.raw, {
				name: 'input',
				attrs: {type: 'checkbox', checked: true}
			});
			assert.deepEqual(frag.last.raw, {value: '!'});
		});
	});

	QUnit.test('<b></b>', function (assert) {
		var frag = xmlParser('<b></b>');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.length, 0);
		assert.equal(frag.first.type, 'tag');
		assert.deepEqual(frag.first.raw, {
			name: 'b',
			attrs: {}
		});
	});

	QUnit.test('<b>foo</b>', function (assert) {
		var frag = xmlParser('<b>foo</b>');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.length, 1);
		assert.equal(frag.first.type, 'tag');
		assert.deepEqual(frag.first.raw, {
			name: 'b',
			attrs: {}
		});
		assert.deepEqual(frag.first.first.type, 'text');
		assert.deepEqual(frag.first.first.raw, {value: 'foo'});
	});

	QUnit.test('foo<b>bar</b>qux', function (assert) {
		var frag = xmlParser('foo<b>bar</b>qux');
		assert.equal(frag.length, 3);

		assert.deepEqual(frag.first.length, 0);
		assert.deepEqual(frag.first.raw, {value: 'foo'});

		assert.deepEqual(frag.nodes[1].length, 1);
		assert.deepEqual(frag.nodes[1].raw, {name: 'b', attrs: {}});
		assert.deepEqual(frag.nodes[1].first.length, 0);
		assert.deepEqual(frag.nodes[1].first.raw, {value: 'bar'});

		assert.deepEqual(frag.last.length, 0);
		assert.deepEqual(frag.last.raw, {value: 'qux'});
	});

	QUnit.test('errors', function (assert) {
		function testMe(html, rules) {
			try {
				xmlParser(html);
				assert.equal(html, 'ERROR', 'Этот тест должен проволиться!');
			} catch (err) {
				for (var key in rules) {
					assert.equal(err[key], rules[key], '[ ' + html + ' ] ~ ' + key);
				}
			}
		}

		testMe('<b>', {details: '<b>', line: 1, message: '<b/> must be closed'});
		testMe('\n--<b>', {details: '--<b>', line: 2});
		testMe('\n--<b =', {details: '--<b =', line: 2, column: 6});
		testMe('<b>\n  <i>\n</b>', {details: '</b>', line: 3, column: 4, message: 'Wrong closing tag \"b\", must be \"i\"'});
	});

	// todo: незактрытый комментарий
	[['', ''], [' ', ''], ['', ' '], [' ', ' ']].forEach(function (pad) {
		var value = pad[0] + 'foo' + pad[1];
		var html = '<!--' + value + '-->';

		QUnit.test(html, function (assert) {
			var frag = xmlParser(html);
			assert.equal(frag.length, 1, 'root');
			assert.equal(frag.first.length, 0);
			assert.equal(frag.first.type, 'comment');
			assert.deepEqual(frag.first.raw, {value: value.trim()});
		});
	});

	// todo: незакрытая cdata
	QUnit.test('<![CDATA[foo]]>', function (assert) {
		var frag = xmlParser('<![CDATA[foo]]>');
		assert.equal(frag.length, 1);
		assert.equal(frag.first.length, 0);
		assert.equal(frag.first.type, 'cdata');
		assert.deepEqual(frag.first.raw, {value: 'foo'});
	});

	QUnit.test('form', function (assert) {
		var frag = xmlParser([
			'<form action="/foo">',
			'  <!-- list -->',
			'  <h1>Todos</h1>',
			'  <ul>',
			'     <li>',
			'       <input type="checkbox" checked/>',
			'       item <b>2</b>',
			'     </li>',
			'     <li><![CDATA[ details ]]></li>',
			'  </ul>',
			'</form>'
		].join('\n'));

		assert.equal(frag.length, 1);
		assert.equal(frag.first.length, 7);
		assert.equal(frag.first.nodes[0].type, 'text');
		assert.equal(frag.first.nodes[1].type, 'comment');
		assert.equal(frag.first.nodes[2].type, 'text');
		assert.equal(frag.first.nodes[3].type, 'tag');
		assert.equal(frag.first.nodes[3].length, 1);
		assert.equal(frag.first.nodes[3].first.type, 'text');
		assert.equal(frag.first.nodes[4].type, 'text');
		assert.equal(frag.first.nodes[5].type, 'tag');
		assert.equal(frag.first.nodes[5].length, 5);
		assert.equal(frag.first.nodes[5].nodes[0].type, 'text');
		assert.equal(frag.first.nodes[5].nodes[1].type, 'tag');
		assert.equal(frag.first.nodes[5].nodes[1].length, 5);
		assert.equal(frag.first.nodes[5].nodes[1].nodes[0].type, 'text');
		assert.equal(frag.first.nodes[5].nodes[1].nodes[1].type, 'tag');
		assert.equal(frag.first.nodes[5].nodes[1].nodes[2].type, 'text');
		assert.equal(frag.first.nodes[5].nodes[1].nodes[3].type, 'tag');
		assert.equal(frag.first.nodes[5].nodes[1].nodes[4].type, 'text');
		assert.equal(frag.first.nodes[5].nodes[2].type, 'text');
		assert.equal(frag.first.nodes[5].nodes[3].type, 'tag');
		assert.equal(frag.first.nodes[5].nodes[3].length, 1);
		assert.equal(frag.first.nodes[5].nodes[3].nodes[0].type, 'cdata');
		assert.equal(frag.first.nodes[5].nodes[4].type, 'text');
		assert.equal(frag.first.nodes[6].type, 'text');
	});
});
