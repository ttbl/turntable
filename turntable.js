#!/bin/sh -c node

//Begin Server Settings.
var port = 8080;
var webrootrel = "static";
//End Server Settings.

//Begin Common Code.
var users = {};
var connections = [];
var userCommands = [];

function handleConnectionSend(connection, message) {
	connection.sendUTF(message);
}

function handleConnectionOpen(connection) {
    connections.push(connection);
    console.log(connection.remoteAddress + " Connected - Protocol Version " + connection.websocketVersion);
    // Send a message to the new client.
    handleConnectionSend(connection, JSON.stringify({ command: "idyou", data: {} }));
}

function handleConnectionClose(connection) {
    console.log(connection.remoteAddress + " Disconnected");
    var index;
    index = connections.indexOf(connection);
    if (index !== -1) { // remove the connection from the pool
        connections.splice(index, 1);
    }
    for(var userid in users) {
	if(users[userid] === connection) {
		console.log("Removing User: "+userid+" ....");
		delete users[userid];
		break;
	}
    }
}

function dispatchCommand(connection, command, data) {
	if(command === "idme") {
		var userid = data;
		var exconnection = users[userid];
		if(exconnection) {
			console.log("Already Connected User: "+userid+", Disconnecting ....");
			connection.close();
			return;
		}
		users[userid] = connection;
		console.log("Adding User: "+userid+" ....");
	}
}

function handleConnectionMessage(connection, message) {
    if (message.type !== 'utf8')
	return;
    try { 
        var parsedMessage = JSON.parse(message.utf8Data);
	if(!parsedMessage.command) {
		dispatchCommand(connection, parsedMessage, parsedMessage);
	} else {
		dispatchCommand(connection, parsedMessage.command, parsedMessage.data);
	}
    } catch (e) {
        // do nothing if there's an error.
    }
}
//End Common Code.

//Begin HTTP Server Code.
var express = require('express');
if (!express) {
console.log("Unable to Get Express.");
process.exit(-1);
}

var app = express.createServer();
var webroot = __dirname + "/" + webrootrel;

app.configure(function() {
app.use(express.static(webroot));
app.set('views', __dirname);
app.set('view engine', 'ejs');
});

app.get('/', function(request, response) {
    response.render(webroot + "/index", { layout: false });
});

app.on('error', function(e) {
    if (e.code == 'EADDRINUSE') {
        console.log("Unable to Bind Server. Please check if you are already running this code. Retrying ...");
        setTimeout(function() {
            app.listen(port);
        }, 5000);
    }
});

app.listen(port);
//End HTTP Server Code.

//WebSocket Server Code.
var WebSocketServer = require('websocket').server;

if (!WebSocketServer) {
    console.log("Unable to Get WebSocket-Node.");
    process.exit(-1);
}

var wsServer = new WebSocketServer({
    httpServer: app,
    // Firefox 7 alpha has a bug that drops the
    // connection on large fragmented messages
    fragmentOutgoingMessages: false
});

wsServer.on('request', function(request) {
    var connection = request.accept('turntable', request.origin);
    //Handle open connection
    handleConnectionOpen(connection);
    //Handle closed connection
    connection.on('close', function() {
        handleConnectionClose(connection);
    });
    //Handle incoming messages on connection
    connection.on('message', function(message) {
        handleConnectionMessage(connection, message);
    });
});

//End WebSocket Server Code.
