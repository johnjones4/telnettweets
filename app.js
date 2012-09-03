var net = 	require('net');
var http = 	require('http');

var searches = {};
 
function cleanInput(data) {
	return data.toString().replace(/(\r\n|\n|\r)/gm,"");
}

function newSocket(socket) {
	var step = 0;
	var searchString = null;
	var id = Math.floor(Math.random() * 1000);
	var closed = false;

	console.log(socket.remoteAddress + ' connected with system ID: ' + id + '!');

	var closeSocket = function() {
		if (!closed) {
			console.log(socket.remoteAddress + ' (ID: ' + id + ') disconnecting.');
			if (searches[id]) 
				delete searches[id];
			socket.end('Goodbye!\n');
			console.log(socket.remoteAddress + ' (ID: ' + id + ') socket closed.');
		}
		closed = true;
	}

	socket.write('Welcome to TelnetTweets!\r\nPress any key to start');
	socket.on('data', function(data) {
		cleanData = cleanInput(data);
		if (cleanData == 'exit' || cleanData == 'quit') {
			closeSocket();
		} else if (step == 0) {
			socket.write('Enter the Twitter handle or hashtag you want to follow: ');
			step++;
		} else if (step == 1) {
			searchString = cleanData;
			if (searchString.charAt(0) != '@' && searchString.charAt(0) != '#') {
				socket.write('Please enter a hashtag starting with "#" or a handle starting with "@".\r\n');
				socket.write('Try again: ');
			} else {
				step++;
				searches[id] = {
					search: searchString,
					socket: socket
				};
				socket.write('Running! Type "exit" or "quit" to stop it.\r\n');
				console.log(socket.remoteAddress + ' (ID: ' + id + ') now searching for: ' + searchString + '.');
			}
		}
	});
	socket.on('end', function() {
		closeSocket();
	});
}

function searchTwitter(object) {
	if (object && object.search && object.socket) {
		var searchString = encodeURIComponent(object.search);
		var path = '/search.json?q='+searchString+'&rpp=100&result_type=recent';
		if (object.lastID) {
			path += '&since_id='+object.lastID;
		}
		var options = {
			host: 'search.twitter.com',
			path: path
		};
		http.get(options, function(res) {
			res.setEncoding('utf8');
			var data = '';
			res.on("data", function(chunk) { 
				data += chunk;
			});
			res.on("end", function() {
				if (data && data != '') {
					var json = JSON.parse(data);
					if (json.results && json.results.length > 0) {
						if (json.results[0].id)
							object.lastID = json.results[0].id;
						if (!object.tweets)
							object.tweets = [];
						for(var i=json.results.length-1;i--;i>=0) {
							var item = json.results[i];
							if (item.from_user && item.text && item.created_at && item.id) {
								if (!inArray(object.tweets,item.id)) {
									object.tweets.push(item.id)
									object.socket.write(new Date(Date.parse(item.created_at)).toISOString()+' @'+item.from_user+': '+item.text+'\r\n');
								}
							}
						}
					}
				}
			});
		}).on('error', function(e) {
			console.log(e);
		});
	}
}

function inArray(array,object) {
	if (array.length > 0) {
		array.forEach(function(item) {
			if (item == object) return true;
		});
	}
	return false;
}
 
var server = net.createServer(newSocket);
server.listen(1337);

setInterval(function() {
	for(var id in searches) {
		searchTwitter(searches[id]);
	}
},1000);