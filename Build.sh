#!/bin/sh

which node 2>&1 >/dev/null || { echo "Please Install Node.js." ; exit -1 ; }
which npm 2>&1 >/dev/null || { echo "Please Install Node Package Manager." ; exit -1 ; }

for deps in crc@0.2 websocket@1.0 express@2.3 ejs@0.4 mime@1.2.2 ; do
	if npm ls | grep -v UNMET | grep $deps 2>&1 >/dev/null ; then
		echo "Installed Package: $deps."
	else
		npm install $deps || { echo "Failed to Install Package: $deps."; exit -1; }
	fi
done

echo "Starting Server ... "
exec node *js
