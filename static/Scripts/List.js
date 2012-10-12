var Servers = [
	"ws://turntable001.jit.su","ws://turntable002.jit.su","ws://turntable003.jit.su","ws://turntable004.jit.su","ws://turntable005.jit.su","ws://turntable006.jit.su","ws://turntable007.jit.su","ws://turntable008.jit.su","ws://turntable009.jit.su","ws://turntable010.jit.su","ws://turntable011.jit.su","ws://turntable012.jit.su","ws://turntable013.jit.su","ws://turntable014.jit.su","ws://turntable015.jit.su","ws://turntable016.jit.su","ws://turntable017.jit.su","ws://turntable018.jit.su","ws://turntable019.jit.su","ws://turntable020.jit.su","ws://turntable021.jit.su","ws://turntable022.jit.su","ws://turntable023.jit.su","ws://turntable024.jit.su","ws://turntable025.jit.su","ws://turntable026.jit.su","ws://turntable027.jit.su","ws://turntable028.jit.su","ws://turntable029.jit.su","ws://turntable030.jit.su","ws://turntable031.jit.su","ws://turntable032.jit.su","ws://turntable033.jit.su","ws://turntable034.jit.su","ws://turntable035.jit.su",
];

var SelfId = "ws://turntable001.jit.su";

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
