define('ace/mode/xtpl_highlight_rules', function (require, exports, module) {
	'use strict';

	var oop = require('ace/lib/oop');
	var TextHighlightRules = require('ace/mode/text_highlight_rules').TextHighlightRules;
	// var R_KEYWORDS = "\\b(if|else|for)\\b";
	// var R_KEYWORDS_WITH_EXPR = "\\b(if|else|for|in)\\b";

    var R_ESCAPED = "\\\\(?:x[0-9a-fA-F]{2}|" + // hex
        "u[0-9a-fA-F]{4}|" + // unicode
        "u{[0-9a-fA-F]{1,6}}|" + // es6 unicode
        "[0-2][0-7]{0,2}|" + // oct
        "3[0-7][0-7]?|" + // oct
        "[4-7][0-7]?|" + //oct
        ".)";

	function baseTokens() {
		return [{
			token : "string",
			regex : "'(?=.)",
			next  : "qstring"
		}, {
			token : "string",
			regex : '"(?=.)',
			next  : "qqstring"
		}, {
			token : "constant.numeric", // hex
			regex : /0(?:[xX][0-9a-fA-F]+|[bB][01]+)\b/
		}, {
			token : "constant.numeric", // float
			regex : /[+-]?\d[\d_]*(?:(?:\.\d*)?(?:[eE][+-]?\d+)?)?\b/
		},
		{
			token: "constant.language.boolean",
			regex: "true|false"
		}];
	}

	function XTPLHighlightRules() {
		this.$rules = {
			'start': [
				{
					token: 'comment',
					regex: /^\s*\/\/.*$/
				},
				{
					token: 'text',
					regex: /\|[^$]+/
				},
				{
					token: 'keyword',
					regex: '\\b(if|for)\\b',
					next: 'keyword'
				},
				{
					token: 'keyword',
					regex: '\\belse\\b',
				},
				{
					token: 'keyword',
					regex: '#[a-z0-9-_]+'
				},
				{
					token: 'entity.other.attribute-name.class',
					regex: '\\.[a-z_-][a-z0-9-_]+'
				},
				{
					token: ['support.type', 'punctuation.operator'],
					regex: '([@a-z_-][:a-z0-9-_]*)(:)'
				},
				{
					token: [
						'paren.lparen',
						'support.type',
						'paren.rparen'
					],
					regex: '(\\[)([^=]*?)(\\])'
				},
				{
					token: [
						'paren.lparen',
						'support.type',
						'keyword.operator',
						'string',
						'paren.rparen'
					],
					regex: '(\\[)(.*?)(=)(".*?")(\\])'
				},
				{
					token: 'meta.tag',
					regex: '[a-z_-][a-z0-9-_]*'
				},
				{
					token : "paren.lparen",
					regex : "[[({]"
				}, {
					token : "paren.rparen",
					regex : "[\\])}]"
				},
				{
					caseInsensitive: true
				}
			].concat(baseTokens()),

			"keyword": baseTokens().concat([
				{
					token: 'keyword',
					regex: 'in',
				},
				{
					regex: '[()]',
					counter: 0,
					onMatch: function (chr) {
						this.next = null;

						if (chr === '(') {
							this.counter++;
							return "paren.lparen";
						} else {
							this.counter--;
							
							if (this.counter === 0) {
								this.next = "start";
							}

							return "paren.rparen";
						}
					}
				},
				{
					defaultToken: "text"
				}
			]),

			"qqstring" : [
				{
					token : "constant.language.escape",
					regex : R_ESCAPED
				}, {
					token : "string",
					regex : "\\\\$",
					next  : "qqstring"
				}, {
					token : "string",
					regex : '"|$',
					next  : "start"
				}, {
					defaultToken: "string"
				}
			],
			
			"qstring" : [
				{
					token : "constant.language.escape",
					regex : R_ESCAPED
				}, {
					token : "string",
					regex : "\\\\$",
					next  : "qstring"
				}, {
					token : "string",
					regex : "'|$",
					next  : "start"
				}, {
					defaultToken: "string"
				}
			]
		};
	}

	oop.inherits(XTPLHighlightRules, TextHighlightRules);

	// Export
	exports.XTPLHighlightRules = XTPLHighlightRules;
});