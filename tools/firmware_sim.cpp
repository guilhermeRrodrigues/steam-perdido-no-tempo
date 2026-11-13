// Roda o firmware de verdade com um Arduino simulado e imprime tudo que ele manda pela serial.
#include "arduino_mock.h"
unsigned long g_ms = 0;
int g_pins[64] = {0};
double g_handCm = -1;
MockSerial Serial;
#include "../firmware/perdido_controle/perdido_controle.ino"

static void run(unsigned long ms) {
  for (unsigned long i = 0; i < ms; i++) { loop(); g_ms++; }
}
int main() {
  g_pins[0] = HIGH;            // BOOT solto (pull-up)
  setup();
  run(100);
  Serial.send("PING\n");
  run(10);
  g_handCm = 20; run(200);     // mão a 20 cm
  g_handCm = 33; run(200);     // mão a 33 cm
  g_handCm = -1; run(200);     // tirou a mão
  g_pins[0] = LOW; run(60);    // aperta BOOT
  g_pins[0] = HIGH; run(60);   // solta BOOT
  Serial.send("DELAY:500\n");
  run(10);
  printf("%s", Serial.out.c_str()); Serial.out.clear();
  printf("--- com DELAY:500, mão vai para 15 cm em t=%lu ms\n", g_ms);
  g_handCm = 15;
  unsigned long t0 = g_ms;
  while (Serial.out.find("DIST:15") == std::string::npos && g_ms - t0 < 2000) run(1);
  printf("DIST:15 chegou %lu ms depois\n", g_ms - t0);
  Serial.out.clear();
  Serial.send("BLINK:2\nSONAR:0\nRESET\nXYZ\n");
  run(50);
  printf("%s", Serial.out.c_str());
  return 0;
}
