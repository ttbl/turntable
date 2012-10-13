//WebSocket Client
function WebSocketClient() {
    // Define accepted commands
    this.messageHandlers = {};
};

WebSocketClient.prototype.registerCallback = function(messagetype, callback) { 
	if(messagetype == null) {
     		if(console)
    		   console.log("Can't register NULL messagetype.");
    		 alert("Can't register NULL messagetype.");
		return;
	}
	this.messageHandlers[messagetype] = callback;
}

WebSocketClient.prototype.unregisterCallback = function(messagetype) { 
	this.registerCallback(messagetype, null);
}

WebSocketClient.prototype.connect = function(docURL) {
    if(docURL == null)
	docURL = document.URL;
    var url;
    if(docURL && docURL.indexOf("https://") == 0) {
     url = "wss://" + docURL.substr(8).split('/')[0];
    } else if(docURL && docURL.indexOf("http://") == 0) {
     url = "ws://" + docURL.substr(7).split('/')[0];
    } else if(docURL && docURL.indexOf("wss://") == 0) {
     url = docURL;
    } else if(docURL && docURL.indexOf("ws://") == 0) {
     url = docURL;
    } else {
     if(console)
       console.log("Can't open WebSocket Connection.");
     alert("Can't open WebSocket Connection.");
     return;
    }
    if(console)
       console.log("Connecting to : "+url);

    var wsCtor = window['MozWebSocket'] ? MozWebSocket : WebSocket;
    this.socket = new wsCtor(url, 'turntable');
    this.socket.onopen = this.handleWebSocketOpen.bind(this);
    this.socket.onmessage = this.handleWebSocketMessage.bind(this);
    this.socket.onclose = this.handleWebSocketClose.bind(this);
};

WebSocketClient.prototype.handleWebSocketSend = function(message) {
    var messageinjson = JSON.stringify(message);
    this.socket.send(messageinjson);
};

WebSocketClient.prototype.handleWebSocketMessage = function(message) {
    try {
        var parsedMessage = JSON.parse(message.data);
    } catch(e) { 
       if(console)
         console.log("Unable to Parse Message: %o",message);
    }
    if (parsedMessage) {
        this.dispatchCommand(parsedMessage);
    }
};

WebSocketClient.prototype.handleWebSocketOpen = function() {
    if(console)
       console.log("WebSocket Connection Open.");
    this.dispatchCommand("Open");
};

WebSocketClient.prototype.handleWebSocketClose = function() {
    if(console)
       console.log("WebSocket Connection Closed.");
    this.dispatchCommand("Close");
};

WebSocketClient.prototype.dispatchCommand = function(command) {
   // Do we have a handler function for this command?
   var handler = null;
   if(!command)
	return;
   if(command.command)
	handler = this.messageHandlers[command.command];
   else
	handler = this.messageHandlers[command];

   // If so, call it and pass the parameter data
   if (handler && typeof(handler) === 'function') {
	if(command.data)
       		handler.call(this, command.data);
	else
		handler.call(this, command);
   } else {
	if(console)
		console.log("Recieved but not able to Dispatch Message: %o", command);
   }
};

//This is a Client-Side Only Implementation.
