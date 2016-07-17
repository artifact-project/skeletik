define('ace/mode/xtpl_highlight_rules', function (require, exports, module) {
	'use strict';

	var oop = require('ace/lib/oop');
	var TextHighlightRules = require('ace/mode/text_highlight_rules').TextHighlightRules;

	function XTPLHighlightRules() {
		this.$rules = {
			'start': [
				{
					token: 'comment',
					regex: /^\s*\/\/.*$/
				},
				{
					token: "keyword",
					regex: "#[a-z0-9-_]+"
				},
				{
					token: 'variable',
					regex: '\\.[a-z0-9-_]+'
				},
				{
					token: 'support.constant',
					regex: '[a-z0-9-_]+'
				},
				{
					token: 'text',
					regex: '\|^$'
				},
				{
					caseInsensitive: true
				}
			]
		};
	}

	oop.inherits(XTPLHighlightRules, TextHighlightRules);

	// Export
	exports.XTPLHighlightRules = XTPLHighlightRules;
});