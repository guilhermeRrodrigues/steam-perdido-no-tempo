// Arduino "de mentira" para compilar e testar o firmware no PC (tools/test-firmware.sh).
#pragma once
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <deque>
#include <algorithm>
using std::min; using std::max;
#define HIGH 1
#define LOW 0
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
template <class T, class A, class B> T constrain(T v, A lo, B hi) { return v < (T)lo ? (T)lo : (v > (T)hi ? (T)hi : v); }
extern unsigned long g_ms;
extern int g_pins[64];
extern double g_handCm;  // <0 = sem mão
inline unsigned long millis() { return g_ms; }
inline void delay(unsigned long ms) { g_ms += ms; }
inline void delayMicroseconds(unsigned int) {}
inline void pinMode(int, int) {}
inline void digitalWrite(int p, int v) { g_pins[p] = v; }
inline int digitalRead(int p) { return g_pins[p]; }
inline unsigned long pulseIn(int, int, unsigned long timeout) {
  if (g_handCm < 0) return 0;
  unsigned long us = (unsigned long)(g_handCm * 58);
  return us > timeout ? 0 : us;
}
struct MockSerial {
  std::deque<char> in;
  std::string out;
  void begin(long) {}
  int available() { return (int)in.size(); }
  int read() { char c = in.front(); in.pop_front(); return c; }
  void print(const char* s) { out += s; }
  void print(unsigned long v) { out += std::to_string(v); }
  void println(const char* s) { out += s; out += "\r\n"; }
  void println(unsigned long v) { out += std::to_string(v); out += "\r\n"; }
  void println(int v) { out += std::to_string(v); out += "\r\n"; }
  void send(const char* s) { while (*s) in.push_back(*s++); }
};
extern MockSerial Serial;
