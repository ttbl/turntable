//WebSocket Client

function WebSocketClient() {
    // Define accepted commands
    this.messageHandlers = {
    };
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
    this.socket.onmessage = this.handleWebsocketMessage.bind(this);
    this.socket.onclose = this.handleWebsocketClose.bind(this);
};

WebSocketClient.prototype.sendWebsocketMessage = function(message) {
    this.socket.send(JSON.stringify(message));
};

WebSocketClient.prototype.handleWebsocketMessage = function(message) {
    try {
        var command = JSON.parse(message.data);
    } catch(e) { 
       if(console)
         console.log("Unable to Parse Message: %o",message);
    }
    if (command) {
        this.dispatchCommand(command);
    }
};

WebSocketClient.prototype.handleWebsocketClose = function() {
    if(console)
       console.log("WebSocket Connection Closed.");
    this.dispatchCommand("Close");
};

WebSocketClient.prototype.dispatchCommand = function(command) {
   // Do we have a handler function for this command?
   var handler = null;
   if(!command)
	return;
   if(command.msg)
	handler = this.messageHandlers[command.msg];
   else
	handler = this.messageHandlers[command];

   // If so, call it and pass the parameter data
   if (handler && typeof(handler) === 'function') {
        handler.call(this, command.data);
   } else {
	if(console)
		console.log("Recieved but not able to Dispatch Message: %o", command);
   }
};

