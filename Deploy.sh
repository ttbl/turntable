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

NUMAPPS=1
OFFSET=
SERVERS=
for nodenum in `seq $NUMAPPS`; do
	nodename=ttable`printf %03d $nodenum`
	wsservname=ws:XX$nodename.jit.su
	SERVERS=$SERVERS\\\"$wsservname\\\",
done

for nodenum in `seq $OFFSET $NUMAPPS`; do
	nodename=ttable`printf %03d $nodenum`
	httpservname=http://$nodename.jit.su
	wsservname=ws://$nodename.jit.su
	SELF=ws:XX$nodename.jit.su
	echo "Deploying to $nodename"
	{
		cat static/Scripts/List.js.in | sed s/\$SERVERS/$SERVERS/g | sed s/\$SELF/$SELF/g | tr X \/ > List.js.tmp && mv List.js.tmp static/Scripts/List.js
		cat package.json.in | sed s/\$nodename/$nodename/g > package.json.tmp && mv package.json.tmp package.json
		retries=5
		done=0
		while  [ $retries != 0 -a $done == 0 ] ; do
			{ yes yes | jitsu deploy; } 2>&1 >jitsu_deploy.log
			if [ $? == 0 ]; then
				echo "App available at $httpservname"
				rm -f jitsu_deploy.log
				done=1
			else
				echo "Re-Deploying to $nodename"
				retries=`expr $retries - 1`
			fi
		done
		if [ $done == 0 ] ; then
			echo "App $nodename was not deployed. Aborting ..."
			exit -1
		fi
	}
done
