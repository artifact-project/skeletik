skeletik
--------
Tiny lexical analyzer


### Presets
 - javascript expression


### Usage

```js
// Tokens
var T_GROUP = 'group';
var T_NUMBER = 'number';
var T_BINARY = 'binary';

// Priority of operations
var PRIORITY = {
	'/': 1,
	'*': 1
};

// Бинарные опреации
var BINARY = {
	'/': function (a, b) { return a / b },
	'*': function (a, b) { return a * b },
	'+': function (a, b) { return a + b },
	'-': function (a, b) { return a - b }
};

// Create parser
var ast = {};
var parse = skeletik({
	'number': ['0-9'],
	'binary': ['+', '-', '/', '*']
}, {
	// Inited state
	'': {
		'number': function (lex, bone) {
			var chr = lex.getChar();
			var last = bone.last;

			if (last && (last.type === T_NUMBER || !last.prev || last.prev.type === T_BINARY)) {
				last.type = T_NUMBER;
				last.raw += chr;
			} else {
				bone.add(T_NUMBER, chr);
			}
		},

		'binary': function (lex, bone) {
			bone.add(T_BINARY, lex.getChar());
		},

		'(': function (lex, bone) {
			return bone.add(T_GROUP).last;
		},

		')': function (lex, bone) {
			return bone.parent
		}
	}
});

var calculator = function (expr) {
	var root = parse(expr);

	return (function _calc(root) {
		var stack = [];
		var ops = [];

		for (var i = 0; i < root.length; i++) {
			var bone = root.nodes[i];

			if (bone.type === T_BINARY) {
				if (PRIORITY[bone.raw]) {
					stack[stack.length - 1] = BINARY[bone.raw](stack[stack.length - 1], +bone.next.raw);
					i++;
				} else {
					ops.push(bone.raw);
				}
			} else {
				stack.push(bone.type === T_GROUP ? _calc(bone) : +bone.raw);
			}
		}

		var results = stack.pop();
		while (ops.length) {
			results = BINARY[ops.pop()](results, stack.pop());
		}

		return results;
	})(root);
};

var str = '(1 + 2) * 4 / -3 + 1';
console.log('results:', calculator(str), eval(str) === calculator(str));
```
