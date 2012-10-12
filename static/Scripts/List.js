var Servers = [
	"ws://localhost:8080",
];

var SelfId = "ws://localhost:8080";

var UserServers = Servers;
var GameServers = Servers;
var ChatServers = Servers;

//This is a Common Implementation.
if(module && module.exports) {
	module.exports.SelfId = SelfId;
	module.exports.UserServers = UserServers;
	module.exports.GameServers = GameServers;
	module.exports.ChatServers = ChatServers;
}
