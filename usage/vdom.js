(function (parse) {
	'use strict';

	console.log(parse('<div/>').first.raw);
	console.log(parse('<div foo/>'));
})(skeletik.preset.xml);
