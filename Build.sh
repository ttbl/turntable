#!/bin/sh

export PATH=$PATH:`pwd`/Deps/bin

which node 2>&1 >/dev/null || { echo "Please Install Node.js." ; exit -1 ; }
which npm 2>&1 >/dev/null || { echo "Please Install Node Package Manager." ; exit -1 ; }

npm install || { echo "Failed to Install Package: $deps."; exit -1; }

exec npm start
