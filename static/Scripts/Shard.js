//Sharding Logic
function getServer(id, Servers, hashfn) {
	var curServer = null;
	if(id == null) 
		return curServer;
	if(Servers == null)
		return curServer;
	var numServers = Servers.length;
	if(numServers == 0)
		return curServer;
	if(!hashfn)
		hashfn = crc32;
	var hash = hashfn(id);
        if(hash < 0)
		hash = -hash;
	hash = hash % numServers;
	curServer = Servers[hash];
	return curServer;
}

//This is a Common Implementation.
if(module && module.exports) {
	module.exports.getServer = getServer;
}
