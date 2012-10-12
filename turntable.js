#!/bin/sh -c node

//Begin Server Settings.
var port = 8080;
var webrootrel = "static";
//End Server Settings.

//Begin Common Config / Functions.
var webroot = __dirname + "/" + webrootrel;
var scriptroot = webroot + "/" + "Scripts";
var serverList = require(scriptroot +"/"+"List");
var SelfId = serverList.SelfId;
var UserServers = serverList.UserServers;
var ChatServers = serverList.ChatServers;
var GameServers = serverList.GameServers;

var crc = require('crc');
if(!crc) {
 console.log("Unable to Get CRC.");
 process.exit(-1);
}
function crc32(string) {
	return crc.crc32(string);
}
var shard = require(scriptroot + "/"+"Shard");
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
var users = {}; //User to Connections Map.
var sub_users = {}; //User to Subscribed Connections Map.
var channels = {}; //Channels to Array of Connections Map.
//End Command Variables.

function getUserIdForConnection(connection)
{
   for(var userId in users) {
    if(!users.hasOwnProperty(userId))
      continue;
    if(users[userId] == connection)
      return userId;
   }
   return null;
}

function getChannelForConnection(connection)
{
   for(var channel in channels) {
    if(!channels.hasOwnProperty(channel))
      continue;
    for(connkey in channels[channel]) {
    	if(!channels[channel].hasOwnProperty(connkey))
    		continue;
    	var exconnection = channels[channel][connkey];
    	if(exconnection === connection)
    		return channel;
    }
   }
   return null;
}

function sendUserNotification(userId, isOnline, isBusy)
{
  if(!sub_users.hasOwnProperty(userId))
     return;
  var subscribers = sub_users[userId];
  var status=isOnline?"online":"offline";
  var users={}; users[userId] = status;
  if(isOnline && isBusy)
     status="busy";
  console.log("Notifying that User: "+userId+" is "+ status + " ....");
  for(connkey in subscribers) {
    if(!subscribers.hasOwnProperty(connkey))
     continue;
    var connection = subscribers[connkey];
    handleConnectionSend(connection, {command: "userchange", data:users});
 }
}

function sendUserInvite(userId, channel)
{
    var userServer = getServer(userId, UserServers, crc32);
    console.log("User Server: "+userServer);
    var dataSent = {};
    dataSent["user"] = userId;
    dataSent["channel"] = channel;
    if(userServer != SelfId )
      {
         if(!cconnections[userServer])  makeWebSocketClient(userServer);
         if(!cconnections[userServer]) { console.log("Not Connected to Server: "+server); return; }
         handleClientConnectionSend (userServer, cconnections[userServer], { command: "invite", data:dataSent });
     } else {
		 var connection = users[userId];
		 if(connection) {
		        handleConnectionSend (connection, { command: "invite", data:dataSent });
		 }
     }
}

function pruneUserConnections(userId) {
 console.log("Removing User: "+userId+" ....");
 var connection = users[userId];
 delete users[userId];
 if(!connection)
	return;
 for(otherUserId in sub_users) {
     if(!sub_users.hasOwnProperty(otherUserId))
	continue;
       index = sub_users[otherUserId].indexOf(connection);
       if (index !== -1) { // remove the connection from the pool
           sub_users[otherUserId].splice(index, 1);
       }
 }
}

function handleWhoThere(connection, command, data) {
 var usersCurrent = [];
 for(userId in users) {
   if(!users.hasOwnProperty(userId))
    continue;
   usersCurrent.push(userId);
 }
 handleConnectionSend(connection, {command: "there", data: usersCurrent});
}

function handleIdMe(connection, command, data) {
 var userId = data;
 var exconnection = users[userId];
 if(exconnection) {
  console.log("Already Connected User: "+userId+", Disconnecting ....");
  connection.close();
  return;
 }
 users[userId] = connection;
 sendUserNotification(userId, true, false);
 console.log("Adding User: "+userId+" ....");
}

function handleUserChange(connection, command, data) {
  for(var userId in data) {
   if(!data.hasOwnProperty(userId))
    continue;
   var status=data[userId];
   var isOnline=false;
   var isBusy=false;
   if(status === "online") {
    isOnline = true;
   }
   if(status === "busy") {
    isOnline = true;
    isBusy = true;
   }
   console.log(" " + userId + " is now " + status);
   sendUserNotification(userId, isOnline, isBusy);
  }
}

function handleSubscribe(connection, command, data) {
  console.log(data);
  for(var userIdKey in data) {
    if(!data.hasOwnProperty(userIdKey))
    continue;
    var userId = data[userIdKey];
    var userServer = getServer(userId, UserServers, crc32);
    console.log("User Server: "+userServer);
    if(userServer != SelfId )
      {
         if(!cconnections[userServer])  makeWebSocketClient(userServer);
         if(!cconnections[userServer]) { console.log("Not Connected to Server: "+server); return; }
	 var message = {};
	 message["command"]="subscribe";
	 message["data"]=[userId];
         handleClientConnectionSend (userServer, cconnections[userServer], message);
     }
     if(!sub_users[userId]) sub_users[userId] = [];
     var index = -1;
     index = sub_users[userId].indexOf(connection);
     if(index == -1) {
       console.log(" " + connection.remoteAddress + " is now Subscribed to " + userId);
       sub_users[userId].push(connection);
     }
 }
}

function handleJoinGame(connection, command, data) {
 if(!data.channel)
 	return;
 var channel = data.channel;
 if(!channels[channel]) {
    console.log("Creating Channel: "+channel+" ....");
    channels[channel] = [];
 }
 var index = -1;
 index = channels[channel].indexOf(connection);
 if(index == -1) {
    channels[channel].push(connection);
    console.log(" " + connection.remoteAddress + " is now Bound to Channel: " + channel);
 }
 if(!data.invite)
    return;
 var invites = data.invite;
 for(var userIdKey in invite) {
   if(!invites.hasOwnProperty(userIdKey))
    continue;
    var userId = invites[userIdKey];
    sendUserInvite(userId, channel);
 }
}

function handleInvite(connection, command, data) {
 if(!data.channel)
 	return;
 var channel = data.channel;
 if(!data.user)
 	return;
 var user = data.user;
 sendUserInvite(userId, channel);
}

function handleGame(connection, command, data) {
 if(!data.channel)
 	return;
 var channel = data.channel;
 if(!channels[channel])
 	return;
 var message = {};
 message["command"] = "game";
 message["data"] = data;
 for(connkey in channels[channel]) {
    	if(!channels[channel].hasOwnProperty(connkey))
    		continue;
    	var exconnection = channels[channel][connkey];
    	var sameClient = false;
    	if(exconnection === connection)
    		sameClient = true;
    	if(true) //!sameClient
    		handleConnectionSend(exconnection, message);
 }
}

function handleClientOpen(connection, command, data) {
}

function handleClientClose(connection, command, data) {
}

function handleOpen(connection, command, data) {
 handleConnectionSend(connection, { command: "idyou", data: {} });
}

function handleClose(connection, command, data) {
 var userId = getUserIdForConnection(connection);
 if(userId != null) {
  sendUserNotification(userId, false, false);
  pruneUserConnections(userId);
 }
 var channel = getChannelForConnection(connection);
 if(channel != null) {
    var index = -1;
    index = channels[channel].indexOf(connection);
    if(index != -1) {
        console.log(connection.remoteAddress + " is now Unbound from Channel: "+channel);
        channels[channel].splice(index, 1);
    }
 }
}

//Presence
registerCallback("whothere", handleWhoThere);
registerCallback("idme", handleIdMe);
registerCallback("subscribe", handleSubscribe);
registerCallback("userchange", handleUserChange);

//Game
registerCallback("invite",handleInvite);
registerCallback("joingame",handleJoinGame);
registerCallback("game",handleGame);

//Generic
registerCallback("ClientOpen", handleClientOpen);
registerCallback("ClientClose", handleClientClose);
registerCallback("Open", handleOpen);
registerCallback("Close", handleClose);

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
        console.log("Handle Message Error: "+e.toString());
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
var wsServer;

app.configure(function() {
 app.use(express.static(webroot));
 app.set('views', __dirname);
 app.set('view engine', 'ejs');
});

app.get('/', function(request, response) {
 response.render(webroot + "/index", { layout: false });
});

app.on('error', function(e) {
 if(e.code != 'EADDRINUSE') {
        console.log("Application Error: " + e.toString());
return;
 }
 console.log("Unable to Bind Server. Please check if you are already running this code. Retrying ...");
 setTimeout(function() { app.listen(port); }, 5000);
});
//End HTTP Server Code.

//Begin Process Handling Code.
function handleExit() {
 console.log("");
 console.log("Exiting .... ");
 wsServer.unmount();
 console.log("Closing Connections ...");
 for(connkey in connections) {
   if(!connections.hasOwnProperty(connkey))
     continue;
   var connection = connections[connkey];
   handleConnectionClose(connection);
   connection.close();
 }
 console.log("Closing Client Connections ...");
 for(connkey in cconnections) {
  if(!cconnections.hasOwnProperty(connkey))
    continue;
    var cconnection = cconnections[connkey];
    handleClientConnectionClose(connkey, connection);
    cconnection.close();
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
