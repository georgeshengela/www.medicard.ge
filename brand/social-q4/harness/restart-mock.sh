#!/bin/bash
# usage: restart-mock.sh [cycleDay]
cd "$(dirname "$0")"
pid=$(netstat -ano | grep ":4499 .*LISTENING" | awk '{print $5}' | head -1)
[ -n "$pid" ] && taskkill //PID $pid //F >/dev/null 2>&1
sleep 1
CYCLE_DAY=${1:-26} PERSONA=women nohup node mock-api.mjs 4499 > mock.log 2> mock.err.log &
sleep 2
curl -s http://localhost:4499/health
