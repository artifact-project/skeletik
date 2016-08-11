define(['qunit'], function (QUnit) {
	'use strict';

	var glueByName = {
		class: ' ',
		style: ';'
	};

	function normalize(data, glue) {
		if (/number|string|boolean/.test(typeof data)) {
			return data;
		} else if (data.type === 'expression') {
			return '${' + data.raw + '}';
		} else if (data instanceof Array) {
			return data.map(function (item) {
				return normalize(item, '');
			}).join(glue || '');
		} else {
			var newData = {};

			Object.keys(data).forEach(function (name) {
				newData[name] = normalize(data[name], glueByName[name]);
			});

			return newData;
		}
	}

	function fragEqual(actual, expected, message) {
		QUnit.assert.deepEqual(normalize(actual), expected, message);
	}

	// Export
	QUnit.assert.fragEqual = fragEqual;
	return fragEqual;
})