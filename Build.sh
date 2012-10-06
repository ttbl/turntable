#!/bin/sh

which node 2>&1 >/dev/null || { echo "Please Install Node.js." ; exit -1 ; }
which npm 2>&1 >/dev/null || { echo "Please Install Node Package Manager." ; exit -1 ; }

for deps in jitsu websocket@1.0.x express@2.3.x ejs@0.4.x mime@1.2.2 ; do
	if npm ls | grep -v UNMET | grep $deps 2>&1 >/dev/null ; then
		echo "Installed Package: $deps."
	else
		npm install $deps || { echo "Failed to Install Package: $deps."; exit -1; }
	fi
done

which jitsu 2>&1 >/dev/null || { echo "Please Install Jitsu Manually." ; exit -1 ; }

echo "Starting Server ... "
exec node *js