#!/usr/bin/env bash
# Compila o firmware com um Arduino simulado e mostra a conversa serial.
set -e
cd "$(dirname "$0")"
g++ -std=c++17 -Wall -Wno-unused-variable -include arduino_mock.h -x c++ firmware_sim.cpp -o /tmp/perdido_fw_sim
/tmp/perdido_fw_sim
