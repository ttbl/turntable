#!/bin/sh -c node

//HTTP Server Code.
var express = require('express');
var app = express.createServer();
var webroot = __dirname + "/static";

app.configure(function() {
    app.use(express.static(webroot));
    app.set('views', __dirname);
    app.set('view engine', 'ejs');
});

app.get('/', function(request, response) {
    response.render(webroot + "/index", { layout: false });
});

app.listen(8080);

//WebSocket Server Code.
var WebSocketServer = require('websocket').server;
var wsServer = new WebSocketServer({
    httpServer: app,
    // Firefox 7 alpha has a bug that drops the
    // connection on large fragmented messages
     fragmentOutgoingMessages: false
});

var users = {};
var connections = [];
var userCommands = [];

wsServer.on('request', function(request) {
    var connection = request.accept('turntable', request.origin);
    connections.push(connection);
    
    console.log(connection.remoteAddress + " connected - Protocol Version " + connection.websocketVersion);
    
    // Send all the existing canvas commands to the new client
    connection.sendUTF(JSON.stringify({
        msg: "updateMessage",
        data: users
    }));
    
    // Handle closed connections
    connection.on('close', function() {
        console.log(connection.remoteAddress + " disconnected");
        
        var index = connections.indexOf(connection);
        if (index !== -1) {
            // remove the connection from the pool
            connections.splice(index, 1);
        }
    });
    
    // Handle incoming messages
    connection.on('message', function(message) {
        if (message.type === 'utf8') {
            try {
                var command = JSON.parse(message.utf8Data);

                if (command.msg === 'join') {
                    //
                }
                else {
                    //userCommands.push(command);
                }

                // rebroadcast command to all clients
                connections.forEach(function(destination) {
                    destination.sendUTF(message.utf8Data);
                });
            }
            catch(e) {
                // do nothing if there's an error.
            }
        }
    });
});

console.log("App Loaded.... ");
