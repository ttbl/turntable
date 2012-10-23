#!/bin/sh -c node

//Begin Server Settings.
var port = 8080;
var webrootrel = "static";
//End Server Settings.

//Begin Common Config / Functions.
var webroot = __dirname + "/" + webrootrel;
var crc = require('crc');
if(!crc) {
 console.log("Unable to Get CRC.");
 process.exit(-1);
}
function crc32(string) {
 return crc.crc32(string);
}
var serverList = require(webroot+"/Scripts/List.js");
var SelfId = serverList.SelfId;
var UserServers = serverList.UserServers;
var ChatServers = serverList.ChatServers;
var GameServers = serverList.GameServers;
var shard = require(webroot+"/Scripts/Shard.js");
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
   console.log("Recieved but not able to Dispatch Message: ", command, data);
  }
 }
}
//End Command Dispatcher.

//Begin Commands.

//Begin Command Variables.
var messages = {}; //Message Queue.

var users = {}; //User to Connections Map.
var sub_user_chans = {}; //User to Bound Channels Map.
var sub_users = {}; //User to Subscribed Connections Map.

var channels = {}; //Channels to Userwise Bound Connections Map.
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

function sendRemoteMessage(serverAddress, command, data) {
 if(!cconnections[serverAddress]) {
   makeWebSocketClient(serverAddress); //Must Batch These!
   queueMessage(serverAddress, command, data);
 } else {
   var message = {};
   message["command"] = command;
   message["data"] = data;
   handleClientConnectionSend (serverAddress, cconnections[serverAddress], message);
 }
}

function queueMessage(queueId, command, data) {
 if(!messages[queueId]) {
  messages[queueId]=[];
 }
 var message = {};
 message["command"] = command;
 message["data"] = data;
 messages[queueId].push(message);
}

function dequeMessages(queueId, connections) {
 var queueMessages = messages[queueId];
 if(!queueMessages)
    return;
 if(!connections)
    return;
 console.log("Emptying Message Queue: "+queueId);
 delete messages[queueId];
 for(var queueMessageKey in queueMessages) {
   if(!queueMessages.hasOwnProperty(queueMessageKey))
    continue;
   var queueMessage = queueMessages[queueMessageKey];
   for(connKey in connections) {
    if(!connections.hasOwnProperty(connKey))
     continue;
    var connection = connections[connKey];
    handleConnectionSend(connection, queueMessage);
   }
 }
}

function getUserIdInChannelForConnection(channel, connection)
{
  if(!channels.hasOwnProperty(channel))
    return null;
  for(userId in channels[channel]) {
    if(!channels[channel].hasOwnProperty(userId))
     continue;
    var exconnection = channels[channel][userId];
    if(exconnection === connection)
     return userId;
  }
  return null;
}

function getChannelForConnection(connection)
{
 for(var channel in channels) {
  if(getUserIdInChannelForConnection(channel, connection) != null)
    return channel;
 }
 return null;
}

function sendConnectionUserNotification(connection, userId, isOnline, isBusy) {
  var status;
  status=isOnline? "online":"offline";
  if(isOnline && isBusy)
     status="busy";
  var user_changes={};
  user_changes[userId] = status;
  console.log("Notifying that User: "+userId+" is "+ status + " ....");
  handleCommandSend(connection, "userchange", user_changes);
}

function sendUserNotification(userId, isOnline, isBusy)
{
  if(isOnline && !isBusy) {
      if(sub_user_chans[userId])
      for(channel in sub_user_chans[userId]) {
	if(!sub_user_chans[userId].hasOwnProperty(channel))
		continue;
	isBusy = true;
	break;
     }
  }
  if(!sub_users.hasOwnProperty(userId))
      return;
  var subscribers = sub_users[userId];
  for(connKey in subscribers) {
     if(!subscribers.hasOwnProperty(connKey))
      continue;
      var connection = subscribers[connKey];
      sendConnectionUserNotification(connection, userId, isOnline, isBusy);
  }
}

function sendUserBoundNotification(userId, channel, bound)
{
  var userServer = getServer(userId, UserServers, crc32);
  if(userServer != SelfId ) {
     var dataSent = {};
     dataSent["user"] = userId;
     dataSent["channel"] = channel;
     dataSent["bound"] = bound;
     sendRemoteMessage(userServer, "userbind", dataSent);
     return;
  }
  if(!sub_user_chans[userId]) 
	sub_user_chans[userId]={};
  if(bound) {
        console.log(" " + userId + " is now Bound to Channel: " + channel);
	sub_user_chans[userId][channel] = true;
  } else {
	delete sub_user_chans[userId][channel];	
        console.log(" " + userId + " is now Unbound from Channel: " + channel);
  }
  var isOnline = true;
  if(!users[userId]) isOnline = false;
  var isBusy = false; //Will Get Re-Evaluated!
  sendUserNotification(userId, isOnline, false);
}

function sendUserInvite(userId, channel)
{
    var userServer = getServer(userId, UserServers, crc32);
    var dataSent = {};
    dataSent["user"] = userId;
    dataSent["channel"] = channel;
    if(userServer != SelfId ) {
     sendRemoteMessage(userServer, "invite", dataSent);
    } else {
     var connection = users[userId];
     if(connection) {
       handleCommandSend (connection, "invite", dataSent);
     } else {
       queueMessage(userId, "invite", dataSent);
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
 handleCommandSend (connection, "there", usersCurrent);
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
 dequeMessages(userId, [connection]);
 console.log("Adding User: "+userId+" ....");
}

function handleUserBind(connection, command, data) {
   var userId = data["user"];
   var channel = data["channel"];
   if(!userId || !channel)
	return;
   var bound = data["bound"];
   sendUserBoundNotification(userId, channel, bound);
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
  for(var userIdKey in data) {
    if(!data.hasOwnProperty(userIdKey))
    continue;
    var userId = data[userIdKey];
    var userServer = getServer(userId, UserServers, crc32);
    if(!sub_users[userId]) sub_users[userId] = [];
    var index = -1;
    index = sub_users[userId].indexOf(connection);
    if(index == -1) {
     console.log(" " + connection.remoteAddress + " is now Subscribed to " + userId);
     sub_users[userId].push(connection);
    } else {
     console.log(" " + connection.remoteAddress + " is already Subscribed to " + userId);
    }
    if(userServer != SelfId ) {
      sendRemoteMessage(userServer, command, [userId]);
    } else {
      var isOnline = true;
      if(!users[userId]) isOnline = false;
      var isBusy = false;
      sendConnectionUserNotification(connection, userId, isOnline, isBusy);
    }
 }
}

function handleJoinGame(connection, command, data) {
 if(!data.channel)
     return;
 var selfUserId = data.self;
 if(!selfUserId) {
    console.log("No Identification Information, Disconnecting ....");
    connection.close();
    return;
 }
 var channel = data.channel;
 if(!channel) {
    console.log("No Channel Information, Disconnecting ....");
    connection.close();
    return;
 }
 if(!channels[channel]) {
    console.log("Creating Channel: "+channel+" ....");
    channels[channel] = {};
 }
 if(channels[channel][selfUserId]) {
    console.log("Already Connected User: "+selfUserId+", Disconnecting ....");
    connection.close();
    return;
 }
 channels[channel][selfUserId] = connection;
 sendUserBoundNotification(selfUserId, channel, true);
 console.log(" "+connection.remoteAddress + " is now Bound to Channel: "+channel);
 if(!data.invite)
    return;
 var invites = data.invite;
 for(var userIdKey in invites) {
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
 var userId = data.user;
 sendUserInvite(userId, channel);
}

function handleGame(connection, command, data) {
 if(!data.channel)
 return;
 var channel = data.channel;
 if(!channels[channel])
  return;
 for(connKey in channels[channel]) {
    if(!channels[channel].hasOwnProperty(connKey))
     continue;
    var exconnection = channels[channel][connKey];
    var sameClient = false;
    if(exconnection === connection)
     sameClient = true;
    if(true) //!sameClient
     handleCommandSend(exconnection, command, data);
 }
}

function handleOpen(connection, command, data) {
 handleConnectionSend(connection, { command: "idyou", data: {} });
}

function handleClose(connection, command, data) {
 var userId = getUserIdForConnection(connection);
 if(userId != null) {
  var userchannels = sub_user_chans[userId];
  for(channel in userchannels) {
    if(!userchannels.hasOwnProperty(channel))
      continue;
    sendUserBoundNotification(userId, channel, false); //Even though he may actually be bound to the Channel!
  }
  sendUserNotification(userId, false, false);
  pruneUserConnections(userId);
 }
 var channel = getChannelForConnection(connection);
 if(channel != null) {
    var userId = getUserIdInChannelForConnection(channel, connection);
    if(userId != null) {
        sendUserBoundNotification(userId, channel, false);
        console.log(" "+connection.remoteAddress + " is now Unbound from Channel: "+channel);
        delete channels[channel][userId];
    }
 }
}

//Presence
registerCallback("whothere", handleWhoThere);
registerCallback("idme", handleIdMe);
registerCallback("subscribe", handleSubscribe);
registerCallback("userchange", handleUserChange);
registerCallback("userbind", handleUserBind);

//Game
registerCallback("invite",handleInvite);
registerCallback("joingame",handleJoinGame);
registerCallback("game",handleGame);

//Generic
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

function handleClientCommandSend(serverAddress, cconnection, command, data) {
 handleCommandSend(cconnection, command, data);
}

function handleClientConnectionOpen(serverAddress, cconnection) {
  console.log(" " + serverAddress + " = " + cconnection.remoteAddress + " Connected - Protocol Version " + cconnection.websocketVersion);
  cconnections[serverAddress] = cconnection;
  dequeMessages(serverAddress, [cconnection]);
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
 var retries = 5;
 clientConnectFunction = function(cconnection) {
   //Handle open Connection
   handleClientConnectionOpen(serverAddress, cconnection);
   cconnection.on('error', function(e) {
     console.log("Connection Error: " + e.toString());
     --retries;
     if(retries > 0) {
       try {
           console.log("Retrying, Making Connection to: "+serverAddress);
           setTimeout(function() { wsClient.connect(serverAddress, 'turntable'); }, 100);
       } catch (e) {
           //Ignore. 
       }
     }
   });
   cconnection.on('message', function(message) {
     handleClientConnectionMessage(serverAddress, cconnection, message);
    });
   cconnection.on('close', function() {
      handleClientConnectionClose(serverAddress, cconnection);
   });
 }
 wsClient.on('connect', clientConnectFunction);
 console.log("Making Connection to: "+serverAddress);
 wsClient.connect(serverAddress, 'turntable');
 return wsClient;
}
//End WebSocket Client Code.

//Begin WebSocket Server Code.
var connections = [];

function handleConnectionSend(connection, message) {
 connection.sendUTF(JSON.stringify(message));
}

function handleCommandSend(connection, command, data) {
 var message = {};
 message["command"] = command;
 message["data"] = data;
 handleConnectionSend(connection, message);
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
        console.log("Message Was: ", message);
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
 try {
 console.log("");
 console.log("Exiting .... ");
 wsServer.unmount();
 console.log("Closing Connections ...");
 for(connKey in connections) {
   if(!connections.hasOwnProperty(connKey))
     continue;
   var connection = connections[connKey];
   handleConnectionClose(connection);
   connection.close();
 }
 console.log("Closing Client Connections ...");
 for(connKey in cconnections) {
  if(!cconnections.hasOwnProperty(connKey))
      continue;
    var cconnection = cconnections[connKey];
    handleClientConnectionClose(connKey, connection);
    cconnection.close();
 }
    wsServer.shutDown();
    app.close();
 } catch (e) {
 }
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
