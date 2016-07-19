(function (factory) {
	'use strict';

	if (typeof module === 'object' && module.exports) {
		module.exports = factory();
	} else if (typeof define === 'function' && define.amd) {
		define([], factory);
	} else {
		window.skeletik = factory();
	}
})(function () {
	'use strict';

	/**
	 * @class Lexer
	 * @param {string} input
	 */
	function Lexer(input) {
		this.line = 1;
		this.column = 1;
		this.idx = 0;
		this.lastIdx = 0;
		this.indent = {tab: 0, space: 0};
		this.code = null;
		this.prevCode = null;
		this.input = input;
		this.length = input.length;
		this.skipLength = 0;
	}

	Lexer.prototype = /** @lends Lexer# */{
		constrcutor: Lexer,

		getToken: function (leftOffset, rightOffset) {
			return this.input.substring(this.lastIdx + (leftOffset|0), this.idx + (rightOffset|0));
		},

		save: function () {
			this.lastIdx = this.idx + 1;
			return this;
		},

		takeToken: function (leftOffset, rightOffset) {
			var token = this.getToken(leftOffset, rightOffset);

			this.lastIdx = this.idx;
			this.taked = true;

			return token;
		},

		getChar: function () {
			return String.fromCharCode(this.code);
		},

		takeChar: function () {
			this.lastIdx = this.idx;
			return String.fromCharCode(this.code); // todo: vs. charAt()
		},

		peek: function (offset) {
			return offset === 0 ? this.code : this.input.charCodeAt(this.idx + offset);
		},

		error: function (message, bone, columnOffset) {
			var error = new SyntaxError(message);

			error.bone = bone;
			error.chr = this.getChar();
			error.token = this.getToken();
			error.line = this.line;
			error.column = this.column + (columnOffset|0);
			error.details = this.input.split('\n')[error.line - 1].substr(0, error.column);
			error.pretty = [
				error.details.replace(/\t/g, ' '),
				new Array(error.column).join('-') + '^'
			].join('\n');

			throw error;
		}
	};


	/**
	 * @class Bone
	 * @param {string} type
	 * @param {*} [raw]
	 * @constructor
	 */
	function Bone(type, raw) {
		this.type = type;

		if (raw !== void 0) {
			this.raw = raw;
		}

		this.length = 0;
		this.nodes = [];
	}

	Bone.prototype = /** @lends Bone# */{
		constrcutor: Bone,

		add: function (type, raw) {
			var bone = new Bone(type, raw);

			bone.parent = this;

			if (this.length > 0) {
				bone.prev = this.last;
				this.last.next = bone;
			}

			this.length = this.nodes.push(bone);
			this.first = this.nodes[0];
			this.last = this.nodes[this.length - 1];

			return this;
		},

		toJSON: function () {
			return {
				type: this.type,
				raw: this.raw,
				nodes: this.length ? this.nodes : [] // todo: Надо поправить на всегда массив
			};
		}
	};


	/**
	 * @class Skeletik;
	 * @param ranges
	 * @param spec
	 * @constructor
	 */
	function Skeletik(ranges, spec) {
		this.ranges(ranges);
		this.spec(spec);

		return this.compile();
	}

	Skeletik.prototype = /** @lends Skeletik# */{
		constrcutor: Skeletik,
		Bone: Bone,

		ranges: function (ranges) {
			// Компилируем диапозоны
			Object.keys(ranges).forEach(function (name) {
				if (/[^$a-z_]/.test(name)) {
					throw new Error("skeletik#ranges: 'name' of range can consist only 'a-z', '_' or '$'");
				}

				ranges[name] = new Function('code', 'return (' + ranges[name].map(function (range) {
					if (range.length == 3) {
						return range.charCodeAt(0) + ' <= code && ' + range.charCodeAt(2) + ' >= code';
					} else {
						return range.charCodeAt(0) + ' === code';
					}
				}).join(') || (') + ')');
			});

			this._ranges = ranges;
		},

		spec: function (spec) {
			this._spec = spec;
			this._states = [];
			this._vars = [];
			this._events = {};

			Object.keys(spec).forEach(function (state) {
				var stateName = 'state_' + state.replace(/[^a-z0-9]/gi, '_');
				var rules = spec[state];
				var events = spec[state].__events;

				this._vars.push(stateName + ' = "' + state + '"');
				this._states[state] = stateName;
				this._events[state] = events;

				delete spec[state].__events;

				this._states.push({
					name: stateName,
					events: !!events,
					rules: Object.keys(rules).map(function (chr) {
						var next = rules[chr];
						var setLastIdx = true;
						var mode = typeof next === 'string' && next.charAt(0);

						if (mode === '!' || mode === '>') {
							next = next.substr(1);
							setLastIdx = mode;
						}

						return {
							chr: chr,
							code: chr.charCodeAt(0),
							next: next,
							setLastIdx: setLastIdx, 
						};
					})
				});
			}, this);
		},

		compile: function () {
			var _this = this;
			var code = (function (lex, bone, options) {
				var code = 0;
				var calcIndent = true;
				var state = '';
				var _state = '';
				var length = lex.length;
				var exit = false;
				var setLastIdx; // todo: rename to `cursorMode`

				this.vars();

				function doIt(chr) {
					var result = spec[state][chr](lex, bone);

					if (result == null) {
						state = '';
					} else {
						if (result === '->' || result === '-->') {
							setLastIdx = (result === '-->');
							return;
						} else if (result.length === 2 && !result.type) {
							bone = result[0];
							state = result[1];
						} else if (result.type) {
							bone = result;
							state = '';
							return;
						} else if (typeof result === 'string') {
							state = result;
						}

						if (state !== _state) {
							var mode = state.charAt(0); // "+" todo: charCodeAt
							if (mode === '!' || mode === '>') {
								state = state.substr(1);
								setLastIdx = mode;
							}
						}
					}
				}

				function emit(name) {
					var fn = events[state];

					if ((fn !== void 0) && (fn = fn[name]) !== void 0) {
						var result = fn(lex, bone);

						if (result === '->') {
							return false;
						} else if (result === false) {
							state = '';
							return false;
						}
					}
				}

				while (lex.idx < length) {
					code = lex.input.charCodeAt(lex.idx);

					lex.prevCode = lex.code;
					lex.code = code;
					lex.state = state;
					setLastIdx = false;

					if (options.onpeek !== void 0 && (options.onpeek(lex, bone) === false)) {
						lex.code = code = 10;
						exit = true;
					}

					if (calcIndent) {
						if (code === 9 || code === 32) {
							lex.indent[code === 9 ? 'tab' : 'space']++;
						} else {
							calcIndent = false;
							var retVal = (options.onindent !== void 0) && options.onindent(lex, bone);

							if (retVal !== void 0 && retVal.type) {
								bone = retVal;
							}
						}
					}

					this.loop(state, code);

					if (exit) {
						break;
					}

					if (code === 10 && (length - lex.idx) !== 1) {
						emit("line");
						lex.line++;
						lex.column = 0;
						lex.indent = {tab: 0, space: 0};
						calcIndent = true;
					}

					if (state !== _state) {
						emit("start");
						_state = state;
					}

					if (setLastIdx && setLastIdx !== '>') {
						if (setLastIdx === '!') {
							lex.lastIdx = lex.idx;
						} else {
							lex.lastIdx = lex.idx + 1;
						}
					}
					
					if (setLastIdx !== '>') {
						lex.idx++;
						lex.column++;
					}
				}

				return bone;
			}).toString().replace(/([ \t]*)this\.(.*?)\((?:(\w+),\s*(\w+))?\);/g, function (_, spaces, name, vState, vCode) {
				if (name === 'vars') {
					return spaces + 'var ' + _this._vars.join(';\n' + spaces + 'var ');
				}
				else if (name === 'loop') {
					return spaces + _this._states.map(function (state) {
						var code = [];
						var rules = state.rules;

						code.push('\t' + rules.map(function (rule) {
							var code = [];
							var next = rule.next;
							var chr = JSON.stringify(rule.chr);

							if (_this._ranges[rule.chr]) {
								code.push('if (ranges.' + rule.chr + '(code)) { // char: ' + chr);
							} else {
								code.push(rule.chr !== '' ? 'if (' + rule.code + ' === code) { // char: ' + chr : '{ // char: any');
							}

							if (next === '->' || next === '-->') {
								code.push('\tstate = _state;');
								(state === '-->') && code.push('\tsetLastIdx = true;');
							} else {
								if (rule.setLastIdx) {
									code.push('\tsetLastIdx = ' + JSON.stringify(rule.setLastIdx) + ';');
								}

								if (typeof next === 'function') {
									code.push('\tdoIt(' + chr + ');');
								} else {
									code.push('\tstate = ' + _this._states[next] + ';');
								}
							}

							code.push('}');

							return code.join('\n' + spaces + '\t');
						}).join(' else '));

						if (state.events){
							code.unshift('if (emit("char") !== false) {');
							code.push('}');
						}

						return [].concat('if (' + state.name + ' === ' + vState + ') {', code, '}').join('\n' + spaces);
					}).join(' else ');
				}

				return '';
			});

			return new Function('ranges, spec, events', 'return ' + code)(this._ranges, this._spec, this._events);
		}
	};

	var skeletik = function (ranges, spec, options) {
		options = options || {};

		var parser = new Skeletik(ranges, spec);
		var parse = function (input) {
			var lex = new Lexer(input + '\n');
			var root = new Bone('#root');

			options.onstart && options.onstart(lex, root);

			var bone = parser(lex, root, options);
			var retEnd = options.onend && options.onend(lex, bone);

			if (retEnd && retEnd.type) {
				bone = retEnd;
			}

			return bone;
		};

		parse.capture = function (lex, localOptions) {
			localOptions = localOptions || {};

			var root = new Bone('#root');

			for (var key in options) {
				if (localOptions[key]) {
					localOptions[key] = (function (parent, local) {
						return function () {
							var parentVal = parent.apply(this, arguments);
							var localVal = local.apply(this, arguments);
							return localVal === void 0 ? parentVal : localVal;
						};
					})(options[key], localOptions[key])
				} else {
					localOptions[key] = options[key];
				}
			}

			localOptions.onstart && localOptions.onstart(lex, root);
			var bone = parser(lex, root, localOptions);
			localOptions.onend && localOptions.onend(lex, bone);

			return bone;
		};

		return parse;
	};

	// Export
	skeletik.Bone = Bone;
	skeletik.preset = {};
	skeletik.version = '0.1.0';

	return skeletik;
});
