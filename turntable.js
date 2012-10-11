#!/bin/sh -c node

//Begin Server Settings.
var port = 8080;
var webrootrel = "static";
//End Server Settings.

//Begin Common Config / Functions.
var webroot = __dirname + "/" + webrootrel;
var scriptroot = webroot + "/" + "Scripts";
var serverList = require(scriptroot +"/"+"List");
var UserServers = serverList.UserServers;
var ChatServers = serverList.ChatServers;
var GameServers = serverList.GameServers;

var shard = require(scriptroot + "/"+"Shard");
crc32 = shard.crc32;
getServer = shard.getServer;
//End Common Config / Functions.

//Begin Command Dispatcher.
var commandDispatchers = {};

function registerCallback(command, callback) {
 commandDispatchers[command] = callback;
}

function unregisterCallback(command) {
 registerCallback(command, null);
}

function dispatchCommand(connection, command, data) {
 var handler = null;
 if(commandDispatchers[command] && typeof(commandDispatchers[command]) === 'function') {
  handler = commandDispatchers[command];
  if(handler) {
   handler(connection, command, data);
  } else {
   console.log("Recieved but not able to Dispatch Message: %o %o", command, data);
  }
 }
}
//End Command Dispatcher.

//Begin Commands.

//Begin Command Variables.
var users = {};
//End Command Variables.

function handleIdMe(connection, command, data) {
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

function handleWhoThere(connection, command, data) {
 var usersCurrent = [];
 for(userid in users) {
  if(users.hasOwnProperty(userid)) {
   usersCurrent.push(userid);
  }
 }
 handleConnectionSend(connection, {command: "there", data: usersCurrent});
}

function handleUserOpen(connection, command, data) {
 handleConnectionSend(connection, { command: "idyou", data: {} });
}

function handleUserClose(connection, command, data) {
 for(var userid in users) {
   if(users[userid] == connection) {
     console.log("Removing User: "+userid+" ....");
     delete users[userid];
     break;
   }
 }
}

registerCallback("whothere", handleWhoThere);
registerCallback("idme", handleIdMe);
registerCallback("Open", handleUserOpen);
registerCallback("Close", handleUserClose);
//End Commands.

//Begin WebSocket Client Code.
var cconnections = {};

var WebSocketClient = require('websocket').client;
if (!WebSocketClient) {
    console.log("Unable to Get WebSocket-Node.");
    process.exit(-1);
}

function handleClientConnectionSend(serverAddress, cconnection, message) {
 handleConnectionSend(cconnection, message);
}

function handleClientConnectionOpen(serverAddress, cconnection) {
  console.log(" " + serverAddress + " = " + connection.remoteAddress + " Connected - Protocol Version " + connection.websocketVersion);
  cconnections[serverAddress] = cconnection;
  dispatchCommand(cconnection, "ClientOpen", null);
}

function handleClientConnectionClose(serverAddress, cconnection) {
  delete cconnections[serverAddress];
  dispatchCommand(cconnection, "ClientClose", null);
}

function handleClientConnectionMessage(serverAddress, cconnection, message) {
    //Replicating Here:
    handleConnectionMessage(cconnection, message);
}

function makeWebSocketClient(serverAddress) {
 var wsClient = new WebSocketClient();
 wsClient.on('connectFailed', function(e) {
    console.log('Client Connect Exception: ' + e.toString());
 });
 wsClient.on('connect', function(cconnection) {
   //Handle open Connection
   handleClientConnectionOpen(serverAddress, cconnection);
   cconnection.on('error', function(e) {
     console.log("Connection Error: " + e.toString());
   });
   cconnection.on('message', function(message) {
	handleClientConnectionMessage(serverAddress, cconnection, message);
    });
   cconnection.on('close', function() {
      handleClientConnectionClose(serverAddress, cconnection);
   });
 });
 return wsClient;
}
//End WebSocket Client Code.

//Begin WebSocket Server Code.
var connections = [];

function handleConnectionSend(connection, message) {
 connection.sendUTF(JSON.stringify(message));
}

function handleConnectionOpen(connection) {
    console.log(connection.remoteAddress + " Connected - Protocol Version " + connection.websocketVersion);
    connections.push(connection);
    dispatchCommand(connection, "Open", null);
}

function handleConnectionClose(connection) {
    var index;
    dispatchCommand(connection, "Close", null);
    index = connections.indexOf(connection);
    if (index !== -1) { // remove the connection from the pool
     console.log(connection.remoteAddress + " Disconnected");
        connections.splice(index, 1);
    } else {
     console.log(connection.remoteAddress + " Not Found");
    }
}

function handleConnectionMessage(connection, message) {
    if (message.type !== 'utf8') return;
    try {
        var parsedMessage = JSON.parse(message.utf8Data);
        if(!parsedMessage.command) {
          dispatchCommand(connection, parsedMessage, parsedMessage);
        } else {
          dispatchCommand(connection, parsedMessage.command, parsedMessage.data);
        }
    } catch (e) {
        console.log("Handle Error: "+e.toString());
    }
}

var WebSocketServer = require('websocket').server;
if (!WebSocketServer) {
    console.log("Unable to Get WebSocket-Node.");
    process.exit(-1);
}

function makeWebSocketServer(app) {
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
 return wsServer;
}
//End WebSocket Server Code.

//Begin HTTP Server Code.
var express = require('express');
if (!express) {
 console.log("Unable to Get Express.");
 process.exit(-1);
}

var app = express.createServer();

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
//End HTTP Server Code.

var wsServer;

//Begin Process Handling Code.
function handleExit() {
 console.log("");
 console.log("Exiting .... ");
 wsServer.unmount();
 console.log("Closing Connections ...");
 for(connkey in connections) {
  if(connections.hasOwnProperty(connkey)) {
   var connection = connections[connkey];
   handleConnectionClose(connection);
   connection.close();
  }
 }
 console.log("Closing Client Connections ...");
 for(connkey in cconnections) {
  if(cconnections.hasOwnProperty(connkey)) {
    var cconnection = cconnections[connkey];
    handleClientConnectionClose(connkey, connection);
    cconnection.close();
  }
 }
 wsServer.shutDown();
 app.close(); 
 console.log("Process was Exited.");
 process.exit(0);
}

//Register Handlers.
process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);

//Handle Uncaught Exceptions.
process.on('uncaughtException', function (e) {
  console.log('Unhandled Exception: ' + e.toString());
});

//Launch!
app.listen(port);
var wsServer = makeWebSocketServer(app);
