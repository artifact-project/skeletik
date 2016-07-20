declare module "skeletik" {
    export interface SkeletikRanges {
        [index: string]: string[];
    }
    export interface SkeletikStates {
        [index: string]: SkeletikState;
    }
    export type SkeletikStateHandle = (lex: Lexer, bone: Bone) => void | string | Bone | [Bone, string];
    export type SkeletikListener = (lex: Lexer, bone: Bone) => boolean | Bone;
    export interface SkeletikState {
        [index: string]: string | SkeletikStateHandle;
    }
    export interface SkeletikOptions {
        onstart?: SkeletikListener;
        onindent?: SkeletikListener;
        onpeek?: SkeletikListener;
        onend?: SkeletikListener;
    }
    export interface SkeletikParser {
        (input: string): Bone;
        capture: (lex: Lexer, options?: SkeletikOptions) => Bone;
    }
    export interface LexerIndent {
        tab: number;
        space: number;
    }
    export class LexerSyntaxError extends SyntaxError {
        bone: Bone;
        chr: string;
        token: string;
        line: number;
        column: number;
        details: string;
        pretty: string;
    }
    /**
     * @class Lexer
     * @param input
     */
    export class Lexer {
        input: string;
        state: string;
        line: number;
        column: number;
        idx: number;
        lastIdx: number;
        indent: LexerIndent;
        code: number;
        prevCode: number;
        length: number;
        constructor(input: string);
        getToken(leftOffset?: number, rightOffset?: number): string;
        save(): this;
        takeToken(leftOffset: any, rightOffset: any): string;
        getChar(): string;
        takeChar(): string;
        peek(offset: any): number;
        error(message: string, bone: any, columnOffset: any): LexerSyntaxError;
    }
    /**
     * @class Bone
     * @param type
     * @param [raw]
     */
    export class Bone {
        type: string;
        raw?: any;
        length: number;
        nodes: Bone[];
        parent: Bone;
        first: Bone;
        last: Bone;
        prev: Bone;
        next: Bone;
        constructor(type: string, raw?: any);
        add(type: any, raw: any): this;
        toJSON(): {
            type: string;
            raw: any;
            nodes: Bone[];
        };
    }
    function skeletikFactory(ranges: SkeletikRanges, spec: SkeletikStates, options?: SkeletikOptions): SkeletikParser;
    export default skeletikFactory;
}
