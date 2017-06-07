// Auto-link sequences on the OEIS when referenced by their ID
//////////////////////////////////////////////////////////////

var autoLinkOEIS = (function() {
	// Load findAndReplaceDOMText
	var NON_PROSE_ELEMENTS;
	loadScript('https://daniel-hug.github.io/findAndReplaceDOMText/src/findAndReplaceDOMText.js', function() {
		NON_PROSE_ELEMENTS = JSON.parse(JSON.stringify(findAndReplaceDOMText.NON_PROSE_ELEMENTS));
		NON_PROSE_ELEMENTS.a = 1;
	});

	function makeRequest(url, cb) {
		var request = new XMLHttpRequest();
		request.onreadystatechange = function() {
			if (request.readyState === XMLHttpRequest.DONE && request.status === 200) {
				cb(request.responseText);
			}
		};
		request.open('GET', url, true);
		request.send();
	}

	function loadScript(url, cb) {
		makeRequest(url, function(js) {
			new Function('on', 'loadScript', 'define', js)(on, loadScript);
			if (cb) cb();
		});
	}

	function debounce(fn, delay) {
		var timer = null;
		return function () {
			var context = this, args = arguments;
			clearTimeout(timer);
			timer = setTimeout(function () {
				fn.apply(context, args);
			}, delay);
		};
	}


	// localStorage + JSON wrapper:
	var storage = {
		get: function(prop) {
			return JSON.parse(localStorage.getItem(prop));
		},
		set: function(prop, val) {
			localStorage.setItem(prop, JSON.stringify(val));
		}
	};

	// pad string with extra characters on left to ensure at least len characters
	function padLeft(str, len, char) {
		return str.length >= len ? str : new Array(len - str.length + 1).join(char) + str;
	}

	function getOeisIdFromNumber(num) {
		return 'A' + padLeft('' + num, 6, '0');
	}

	function RunYQL(command, callback){
		callback_name = "__YQL_callback_"+(new Date()).getTime();
		window[callback_name] = callback;
		script = document.createElement('script');
		script.src = "https://query.yahooapis.com/v1/public/yql?q=" +
			encodeURIComponent(command.split('|').join('%7C')) + "&format=json&callback=" + callback_name;
		document.getElementsByTagName("head")[0].appendChild(script);
	}

	function getJson(url, callback, query) {
		RunYQL('select ' + (query || '*') + ' from json where url="' + url + '"', function(response) {
			callback(response.query.results.json);
		});
	}

	var getSequenceName = (function() {
		var sequencesToLookup = [];
		var callbacks = {};
		var sequences = storage.get('oeis_sequences') || {};

		// optimization: debounce these requests into one batch request
		var batchQuery = debounce(function() {
			var oeisURL = 'https://oeis.org/search?fmt=json&q=id:' + sequencesToLookup.join('|id:');
			getJson(oeisURL, function(response) {
				var results = Array.isArray(response) ? response : [response];
				results.forEach(handleResult);

				// have YQL return only essential data:
			}, "results.name, results.number");
		}, 4);

		function handleResult(result) {
			var name = result.results.name;
			var seqId = getOeisIdFromNumber(result.results.number);
			sequences[seqId] = {name: name};
			storage.set('oeis_sequences', sequences);
			callbacks[seqId](name);
		}

		return function(seqId, callback) {
			if (sequences[seqId]) {
				callback(sequences[seqId].name);
			} else {
				sequencesToLookup.push(seqId);
				callbacks[seqId] = callback;
				batchQuery();
			}
		};
	})();

	var hasOwn = Object.prototype.hasOwnProperty;
	return function autoLinkOEIS() {
		findAndReplaceDOMText(document.getElementById('preview-contents'), {
			preset: 'prose',
			find: /A\d{6}/g,
			replace: function(portion, matchedString) {
				var a = document.createElement('a');
				a.href = 'https://oeis.org/' + matchedString;
				a.textContent = matchedString;

				getSequenceName(matchedString, function(name) {
					a.title = name;
				});

				return a;
			},
			filterElements: function(el) {
				return !hasOwn.call(NON_PROSE_ELEMENTS, el.nodeName.toLowerCase());
			}
		});
	}
})();
