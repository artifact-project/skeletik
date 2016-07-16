export interface ILexerIndent {
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
    public prettyMessage:string;
}

/**
 * @class Lexer
 * @param input 
 */
export class Lexer {
    public line:number = 1;
	public column:number = 1;
	public idx:number = 0;
	public lastIdx:number = 0;
	public indent:ILexerIndent = {tab: 0, space: 0};
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
        error.prettyMessage = [
            error.details,
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

    constructor(public type:string, public raw?:any) {
	}

    add(type, raw):this {
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