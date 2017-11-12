Skeletik
--------
Tiny lexical analyzer

```
npm i --save-dev skeletik
```

### API

```ts
const parse = skeletik({
	// Ranges
	//  key — name of range
	//  value — array of symbols and intervals (ex 0-9 or a-b)
	'$number': ['0-9'],
	'$binary': ['+', '-', '/', '*'],
}, {
	// States
	'': { // <- initial and also default state
		// State Rules
		//  key — one symbol or region name
		//  value — handler or next name of a state
		'$number': 'NUMBER',

		// any
		'': (lex, bone) => lex.error(`Invalid character \`${lex.getChar()}\`, state: ${lex.state}`, bone);
	},

	'NUMBER': {
		// ...
	}
});
```


### Example

```js
// Tokens
const T_GROUP = 'group';
const T_NUMBER = 'number';
const T_BINARY = 'binary';

// Priority of operations
const PRIORITY = {
	'/': 1,
	'*': 1,
};

// Бинарные опреации
const BINARY = {
	'/': function (a, b) { return a / b },
	'*': function (a, b) { return a * b },
	'+': function (a, b) { return a + b },
	'-': function (a, b) { return a - b },
};

// Create parser
const ast = {};
const parse = skeletik({
	'number': ['0-9'],
	'binary': ['+', '-', '/', '*'],
}, {
	// Inited state
	'': {
		'number'(lex, bone) {
			const chr = lex.getChar();
			const last = bone.last;

			if (last && (last.type === T_NUMBER || !last.prev || last.prev.type === T_BINARY)) {
				last.type = T_NUMBER;
				last.raw += chr;
			} else {
				bone.add(T_NUMBER, chr);
			}
		},

		'binary'(lex, bone) {
			bone.add(T_BINARY, lex.getChar());
		},

		'(': (lex, bone) => bone.add(T_GROUP).last,
		')': (lex, bone) => bone.parent,
	},
});

function calculator(expr) {
	const root = parse(expr);

	return (function _calc(root) {
		const stack = [];
		const ops = [];

		for (let i = 0; i < root.length; i++) {
			const bone = root.nodes[i];

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

		let results = stack.pop();

		while (ops.length) {
			results = BINARY[ops.pop()](results, stack.pop());
		}

		return results;
	})(root);
};

const str = '(1 + 2) * 4 / -3 + 1';
console.log('results:', calculator(str), eval(str) === calculator(str));
```
