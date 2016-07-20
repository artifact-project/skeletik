export interface SkeletikRanges {
	[index:string]:string[];
}

export interface SkeletikStates {
	[index:string]:SkeletikState
}

export type SkeletikStateHandle = (lex:Lexer, bone:Bone) => void|string|Bone|[Bone,string]
export type SkeletikListener = (lex:Lexer, bone:Bone) => boolean | Bone

export interface SkeletikState {
	[index:string]:string | SkeletikStateHandle
}

export interface SkeletikOptions {
	onstart?:SkeletikListener;
	onindent?:SkeletikListener;
	onpeek?:SkeletikListener;
	onend?:SkeletikListener;
}

export interface SkeletikParser {
	(input:string):Bone;
	capture:(lex:Lexer, options?:SkeletikOptions) => Bone;
}

export interface LexerIndent {
    tab:number;
    space:number;
}

export class LexerSyntaxError extends SyntaxError {
    public bone:Bone;
    public chr:string;
    public token:string;
    public line:number;
    public column:number;
    public details:string;
    public pretty:string;
}

/**
 * @class Lexer
 * @param input 
 */
export class Lexer {
	public state:string;
    public line:number = 1;
	public column:number = 1;
	public idx:number = 0;
	public lastIdx:number = 0;
	public indent:LexerIndent = {tab: 0, space: 0};
	public code:number = null;
	public prevCode:number = null;
	public length:number;

    constructor(public input:string) {
	    this.length = input.length;        
    }

    getToken(leftOffset?:number, rightOffset?:number):string {
        return this.input.substring(this.lastIdx + (leftOffset|0), this.idx + (rightOffset|0));
    }

    save():this {
        this.lastIdx = this.idx + 1;
        return this;
    }

    takeToken(leftOffset, rightOffset):string {
        const token:string = this.getToken(leftOffset, rightOffset);
        this.lastIdx = this.idx;
        return token;
    }

    getChar():string {
        return String.fromCharCode(this.code); // todo: vs. charAt()
    }

    takeChar():string {
        this.lastIdx = this.idx;
        return this.getChar(); 
    }

    peek(offset):number {
        return offset === 0 ? this.code : this.input.charCodeAt(this.idx + offset);
    }

    error(message:string, bone, columnOffset):LexerSyntaxError {
        var error = new LexerSyntaxError(message);

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
}


/**
 * @class Bone
 * @param type
 * @param [raw]
 */
export class Bone {
    public length:number = 0;
    public nodes:Bone[] = [];
    
    public parent:Bone;
    
    public first:Bone;
    public last:Bone;

    public prev:Bone;
    public next:Bone;

    constructor(public type:string, public raw?:any) {}

    add(type:string, raw?:any):this {
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
    }

    toJSON() {
        return {
            type: this.type,
            raw: this.raw,
            nodes: this.nodes
        };
    }
};


/**
 * @class Skeletik;
 * @param ranges
 * @param spec
 */
class Skeletik {
	private _ranges:any;
	private _spec:any;
	private _states:any;
	private _vars:any;
	private _events:any;
	private _fn:Function;

	constructor(ranges:SkeletikRanges, spec:SkeletikStates) {
		this.ranges(ranges);
		this.spec(spec);
		this._fn = this.compile();
	}

	exec(lex:Lexer, root:Bone, options:SkeletikOptions):Bone {
		return this._fn(lex, root, options);
	}

	ranges(ranges) {
		// Компилируем диапозоны
		Object.keys(ranges).forEach((name:string) => {
			if (/[^$a-z_]/.test(name)) {
				throw new Error("skeletik#ranges: 'name' of range can consist only 'a-z', '_' or '$'");
			}

			ranges[name] = new Function('code', 'return (' + ranges[name].map((range) => {
				if (range.length == 3) {
					return range.charCodeAt(0) + ' <= code && ' + range.charCodeAt(2) + ' >= code';
				} else {
					return range.charCodeAt(0) + ' === code';
				}
			}).join(') || (') + ')');
		});

		this._ranges = ranges;
	}

	spec(spec) {
		this._spec = spec;
		this._states = [];
		this._vars = [];
		this._events = {};

		Object.keys(spec).forEach((state:string) => {
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
				rules: Object.keys(rules).map((chr:string) => {
					var next = rules[chr];
					var setLastIdx = null;
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
	}

	compile() {
		var _this = this;
		var spec:SkeletikStates;
		var events:any;
		var code = (function (lex:Lexer, bone:Bone, options:SkeletikOptions) {
			var code = 0;
			var calcIndent = true;
			var state = '';
			var _state = '';
			var length = lex.length;
			var exit = false;
			var setLastIdx; // todo: rename to `cursorMode`

			this.vars();

			function doIt(chr:string) {
				var result = (spec[state][chr] as SkeletikStateHandle)(lex, bone);

				if (result == null) {
					state = '';
				} else {
					if (result === '->' || result === '-->') {
						setLastIdx = (result === '-->');
						return;
					} else if (result['length'] === 2 && !result['type']) {
						bone = result[0];
						state = result[1];
					} else if (result['type']) {
						bone = result as Bone;
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

						if (retVal !== void 0 && retVal['type']) {
							bone = retVal as Bone;
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
		}).toString().replace(/([ \t]*)this\.(.*?)\((?:(\w+),\s*(\w+))?\);/g, (_, spaces, name, vState, vCode) => {
			if (name === 'vars') {
				return spaces + 'var ' + _this._vars.join(';\n' + spaces + 'var ');
			} else if (name === 'loop') {
				return spaces + _this._states.map((state) => {
					var code = [];
					var rules = state.rules;

					code.push('\t' + rules.map((rule) => {
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

function skeletikFactory(ranges:SkeletikRanges, spec:SkeletikStates, options?:SkeletikOptions):SkeletikParser {
	options = options || {};

	const parser = new Skeletik(ranges, spec);
	const parse = <SkeletikParser>function (input:string): Bone {
		const lex = new Lexer(input + '\n');
		const root = new Bone('#root');

		options.onstart && options.onstart(lex, root);

		let bone = parser.exec(lex, root, options);
		const retEnd = options.onend && options.onend(lex, bone);

		if (retEnd && retEnd['type']) {
			bone = retEnd as Bone;
		}

		return bone;
	};

	parse.capture = function (lex:Lexer, localOptions?:SkeletikOptions):Bone {
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
		
		var bone = parser.exec(lex, root, localOptions);
		localOptions.onend && localOptions.onend(lex, bone);

		return bone;
	};

	return parse;
}

// Export
skeletikFactory['Bone'] = Bone;
skeletikFactory['preset'] = {};
skeletikFactory['version'] = '0.2.0';

export default skeletikFactory;