#!/bin/sh

which node 2>&1 >/dev/null || { echo "Please Install Node.js." ; exit -1 ; }
which npm 2>&1 >/dev/null || { echo "Please Install Node Package Manager." ; exit -1 ; }

for deps in jitsu ; do
	if npm ls | grep -v UNMET | grep $deps 2>&1 >/dev/null ; then
		echo "Installed Package: $deps."
	else
		npm install $deps || { echo "Failed to Install Package: $deps."; exit -1; }
	fi
done

which jitsu 2>&1 >/dev/null || { echo "Please Install Jitsu Manually." ; exit -1 ; }

NUMAPPS=35
SERVERS=
for nodenum in `seq $NUMAPPS`; do
	nodename=turntable`printf %03d $nodenum`
	wsservname=ws:XX$nodename.jit.su
	SERVERS=$SERVERS\\\"$wsservname\\\",
done

for nodenum in `seq $NUMAPPS`; do
	nodename=turntable`printf %03d $nodenum`
	httpservname=http://$nodename.jit.su
	wsservname=ws://$nodename.jit.su
	SELF=ws:XX$nodename.jit.su
	echo "Deploying to $nodename"
	{
		cat static/Scripts/List.js.in | sed s/\$SERVERS/$SERVERS/g | sed s/\$SELF/$SELF/g | tr X \/ > List.js.tmp && mv List.js.tmp static/Scripts/List.js
		{ yes yes | jitsu deploy; } 2>&1 >jitsu_deploy.log
		if [ $? == 0 ]; then
			echo "App available at $httpservname"
		else
			echo "App $nodename was not deployed."
		fi
		rm -f jitsu_deploy.log
	}
done
