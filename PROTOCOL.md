turntable Protocol
==================

Message Format
--------------

WebSocket Client and Server speak RFC 6455. Older / Incompatible Clients are not going
to be supported.

As of version 1, we use a JSON protocol to send message through client and server.

These are the basic types supported:
	UTF8 String, Boolean and Number

These are the aggregations supported:
	Hash and Array

As of version 2, we plan to use an alternative Binary protocol. (TBD)

Sharding
--------

Each Object we support is Sharded among K ( > 0 ) servers. If there are K servers available, an Object whose Id is sharded as:

`
Server(Id) = Crc32(Id) % K.
`

For requesting an Objects status, you simply have to connect to the appropriate server. 

This is an exemption for Presence information of your friends. Your own server performs this operation in bulk for you.

Features
--------

There are 3 Basic Things we Support:

- Presence
- Chat
- Game

Presence
--------

1. Client connects to Server. Server asks Client to Identify Yourself.
`
{ "command": "idyou", "data":{}}
`
2. Client responds to Server with a Identification message.
`
{ "command": "idme", "data":"1:12345"}
`
3. Client wants to be subscribed to friends status.
`
{ "command": "subscribe", "data":["1:2345", "1:3456", "1:789"]}
`
4. Client gets a message from Server whenever it finds about a set of friends.
`
{ "command" : "userchange", "data":{"1:2345": false, "1:3456": true}}
`
These message stream to the client when a friend connects/disconnects. We dont
support idle messages.

Chat
----

1. Client connects to Server of a Chat room. Server asks client to Identify Yourself.
2. Client responds to Server with a Identification Message.
3. Client joins (or create) a chatroom. We use Channel as the Id for this Server.
`
{ "command": "joinchat", "data":{ "channel": "CStrike_Evening", "invite": "1:2345"} }
`
Server Invites appropriate Users.
`
{ "command": "invitetochat", "data":{ "channel": "CStrike_Evening"} } 
`
4. Server notifies Chat room when People Join/Leave Chat, Just like in Presence.
5. Client sends a chat message.
`
{ "command": "chat", "data": { "channel": "CStrike_Evening", "message": "Hi folks!", "file": "http://s3.amazon.com/blah.jpg" }}
`
This is now sent to all users who are in this room.

Game
----

1. Client connects to Server of a Game room. Server asks client to Identify Yourself.
2. Client responds to Server with a Identification Message.
3. Client joins (or create) a gameroom. We use Channel as the Id for this Server.
`
{ "command": "joingame", "data":{ "channel": "CStrike", "toinvite": "1:2345", "teams": ["Terrorists", "Counters", "Spectators"]} }
`
Server Invites appropriate Users.
`
{ "command": "invitetogame", "data":{ "channel": "CStrike"} } 
`
4. Client joins a team. 
`
{ "command": "jointeam", "data":{"channel": "CStrike", "team": "Terrorists"}}
`
5. Server notifies Chat room when People Join/Leave Chat, or Change Teams, Just like in Presence.
6. Client sends a Game Action, which is sent to all Members.
`
{ "command": "game", "data":{"channel": "CStrike", actions:[{"timestamp": 10223232, "team": "Terrorists", "from":"1:23456", "data": {"strike_one":"1:1234"}]}}
`
The Server can correct the timestamps, validate the team and user Ids before sending it out. The Clients can be furthur
validated by peeking at the content of their actions.