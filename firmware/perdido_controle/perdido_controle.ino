/*
  Perdido no tempo — firmware do controle (ESP32 + sensor ultrassonico HC-SR04)
  ---------------------------------------------------------------------------
  O "controle" e a sua MAO na frente do sensor. O ESP32 mede a distancia e manda para o jogo:
      DIST:23     (mao a 23 cm)        DIST:-1   (nada na frente do sensor)

  Extras que ja vem na placa, sem montar nada:
    - Botao BOOT (GPIO 0): funciona como atalho de "OK" depois que a placa ligou -> BTN:A:1 / BTN:A:0
    - LED azul da placa (GPIO 2): pisca quando o jogo manda (acerto/erro)

  Comandos que o jogo manda (um por linha, terminados com \n):
      HELLO          -> responde HELLO:PERDIDO:2:ESP32
      PING           -> responde PONG
      SONAR:<0|1>    -> liga/desliga o envio de DIST (ja comeca ligado)
      DELAY:<ms>     -> atrasa tudo que a placa envia (simula aparelho lento), de 0 a 3000
      LED:<0|1>      -> acende/apaga o LED da placa
      BLINK:<n>      -> pisca o LED n vezes (1 a 10)
      RESET          -> volta ao normal (sem atraso, LED apagado, sonar ligado)

  Velocidade da serial: 115200 baud.

  BLUETOOTH (BLE): as MESMAS mensagens e comandos tambem funcionam sem fio.
    - Nome do aparelho: "PerdidoNoTempo"
    - Servico estilo "Nordic UART": 6E400001-B5A3-F393-E0A9-E50E24DCCA9E
        RX (o jogo escreve comandos):  6E400002-...   TX (a placa notifica mensagens): 6E400003-...
    - Serve para jogar num computador que nao tem o driver USB da placa: o cabo so da energia.
    - Na Arduino IDE escolha: Ferramentas -> Partition Scheme -> "Huge APP (3MB No OTA/1MB SPIFFS)".
*/

#if defined(ARDUINO_ARCH_ESP32)
  #define USAR_BLE 1
#else
  #define USAR_BLE 0   // (no simulador de testes do PC nao ha Bluetooth)
#endif

#if USAR_BLE
  #include <BLEDevice.h>
  #include <BLEServer.h>
  #include <BLE2902.h>
#endif

// ---------------- Pinos ----------------
const uint8_t PINO_TRIG = 5;    // HC-SR04 Trig  (D5)
const uint8_t PINO_ECHO = 18;   // HC-SR04 Echo  (D18) -> pelo divisor de tensao (ver manual)
const uint8_t PINO_BOOT = 0;    // botao BOOT da propria placa
const uint8_t PINO_LED = 2;     // LED azul da propria placa (algumas placas nao tem)

// ---------------- Ajustes ----------------
const unsigned long INTERVALO_MEDIDA = 60;   // ms entre medidas
const unsigned long BATIMENTO = 400;         // ms: reenvia a distancia mesmo sem mudar (o jogo sabe que esta vivo)
const int DIST_MAXIMA = 80;                  // cm: acima disso conta como "nada na frente"

// ---------------- Saida: USB serial + Bluetooth ----------------
void executarComando(char* cmd);
void receberCaractere(char c);

#if USAR_BLE
  #define NUS_SERVICO "6E400001-B5A3-F393-E0A9-E50E24DCCA9E"
  #define NUS_RX      "6E400002-B5A3-F393-E0A9-E50E24DCCA9E"
  #define NUS_TX      "6E400003-B5A3-F393-E0A9-E50E24DCCA9E"
  BLECharacteristic* bleTx = nullptr;
  bool bleConectado = false;

  class EventosServidor : public BLEServerCallbacks {
    void onConnect(BLEServer*) override { bleConectado = true; }
    void onDisconnect(BLEServer* s) override {
      bleConectado = false;
      s->getAdvertising()->start();  // volta a aparecer para o jogo reconectar
    }
  };

  class EventosRx : public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic* c) override {
      auto v = c->getValue();  // String (core 3.x) ou std::string (core 2.x): os dois tem length() e []
      for (size_t i = 0; i < v.length(); i++) receberCaractere(v[i]);
    }
  };

  void iniciarBle() {
    BLEDevice::init("PerdidoNoTempo");
    BLEServer* servidor = BLEDevice::createServer();
    servidor->setCallbacks(new EventosServidor());
    BLEService* servico = servidor->createService(NUS_SERVICO);
    bleTx = servico->createCharacteristic(NUS_TX, BLECharacteristic::PROPERTY_NOTIFY);
    bleTx->addDescriptor(new BLE2902());
    BLECharacteristic* rx = servico->createCharacteristic(
        NUS_RX, BLECharacteristic::PROPERTY_WRITE | BLECharacteristic::PROPERTY_WRITE_NR);
    rx->setCallbacks(new EventosRx());
    servico->start();
    BLEAdvertising* anuncio = BLEDevice::getAdvertising();
    anuncio->addServiceUUID(NUS_SERVICO);
    anuncio->setScanResponse(true);
    BLEDevice::startAdvertising();
  }

  void bleEnviar(const char* texto) {
    if (!bleConectado || !bleTx) return;
    // Uma notificacao leva no maximo 20 bytes: mandamos a linha (com \n) em pedacos
    char buf[48];
    int n = snprintf(buf, sizeof(buf), "%s\n", texto);
    for (int i = 0; i < n; i += 20) {
      int tam = min(20, n - i);
      bleTx->setValue((uint8_t*)buf + i, tam);
      bleTx->notify();
    }
  }
#else
  void iniciarBle() {}
  void bleEnviar(const char*) {}
#endif

/** Manda uma linha para o jogo, pelo cabo e pelo Bluetooth. */
void saida(const char* texto) {
  Serial.println(texto);
  bleEnviar(texto);
}

// ---------------- Fila de saida (para o atraso) ----------------
// Tudo que vai para o PC passa por esta fila. Com DELAY:600, cada mensagem sai 0,6 s depois.
unsigned long atrasoMs = 0;
const uint8_t TAM_FILA = 24;
struct Mensagem {
  char texto[20];
  unsigned long quando;
};
Mensagem fila[TAM_FILA];
uint8_t filaInicio = 0, filaQtd = 0;

void enfileirar(const char* texto) {
  if (atrasoMs == 0 && filaQtd == 0) {  // sem atraso: manda na hora
    saida(texto);
    return;
  }
  if (filaQtd >= TAM_FILA) {            // fila cheia: joga fora a mais velha
    filaInicio = (filaInicio + 1) % TAM_FILA;
    filaQtd--;
  }
  uint8_t pos = (filaInicio + filaQtd) % TAM_FILA;
  strncpy(fila[pos].texto, texto, sizeof(fila[pos].texto) - 1);
  fila[pos].texto[sizeof(fila[pos].texto) - 1] = '\0';
  fila[pos].quando = millis() + atrasoMs;
  filaQtd++;
}

void enviarFila() {
  while (filaQtd > 0 && (long)(millis() - fila[filaInicio].quando) >= 0) {
    saida(fila[filaInicio].texto);
    filaInicio = (filaInicio + 1) % TAM_FILA;
    filaQtd--;
  }
}

// ---------------- Ultrassonico ----------------
bool sonarLigado = true;
unsigned long ultimaMedida = 0, ultimoEnvio = 0;
int ultimaDist = -2;

int medirUmaVez() {
  digitalWrite(PINO_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PINO_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PINO_TRIG, LOW);
  // Espera o eco por no maximo 6 ms (~1 m). Mais longe que isso nao interessa.
  unsigned long us = pulseIn(PINO_ECHO, HIGH, 6000UL);
  if (us == 0) return -1;
  int cm = us / 58;  // o som vai e volta: 58 us por centimetro
  if (cm < 2 || cm > DIST_MAXIMA) return -1;
  return cm;
}

int medianaDe3(int a, int b, int c) {
  return max(min(a, b), min(max(a, b), c));
}

void lerUltrassom() {
  if (!sonarLigado || millis() - ultimaMedida < INTERVALO_MEDIDA) return;
  ultimaMedida = millis();
  // Mediana de 3 medidas: descarta uma leitura maluca de vez em quando
  int a = medirUmaVez();
  delayMicroseconds(300);
  int b = medirUmaVez();
  delayMicroseconds(300);
  int c = medirUmaVez();
  int d = medianaDe3(a, b, c);
  if (d != ultimaDist || millis() - ultimoEnvio > BATIMENTO) {
    ultimaDist = d;
    ultimoEnvio = millis();
    char msg[20];
    snprintf(msg, sizeof(msg), "DIST:%d", d);
    enfileirar(msg);
  }
}

// ---------------- Botao BOOT (debounce) ----------------
bool bootEstavel = false, bootLeitura = false;
unsigned long bootMudou = 0;

void lerBotaoBoot() {
  bool apertado = digitalRead(PINO_BOOT) == LOW;  // INPUT_PULLUP: LOW = apertado
  if (apertado != bootLeitura) {
    bootLeitura = apertado;
    bootMudou = millis();
  }
  if (millis() - bootMudou > 25 && apertado != bootEstavel) {
    bootEstavel = apertado;
    enfileirar(apertado ? "BTN:A:1" : "BTN:A:0");
  }
}

// ---------------- LED (pisca sem travar o programa) ----------------
int piscadasRestantes = 0;
unsigned long proximaTroca = 0;

void atualizarLed() {
  if (piscadasRestantes > 0 && (long)(millis() - proximaTroca) >= 0) {
    bool aceso = digitalRead(PINO_LED);
    digitalWrite(PINO_LED, !aceso);
    if (aceso) piscadasRestantes--;   // acabou de apagar: uma piscada completa
    proximaTroca = millis() + 120;
  }
}

// ---------------- Comandos vindos do jogo ----------------
char linha[32];
uint8_t tamLinha = 0;

void enviarHello() {
  saida("HELLO:PERDIDO:2:ESP32");
}

void executarComando(char* cmd) {
  char* valor = strchr(cmd, ':');
  if (valor) *valor++ = '\0';  // separa "NOME" e "valor"

  if (strcmp(cmd, "HELLO") == 0) {
    enviarHello();
  } else if (strcmp(cmd, "PING") == 0) {
    saida("PONG");
  } else if (strcmp(cmd, "SONAR") == 0 && valor) {
    sonarLigado = atoi(valor) != 0;
    ultimaDist = -2;
    saida(sonarLigado ? "OK:SONAR:1" : "OK:SONAR:0");
  } else if (strcmp(cmd, "DELAY") == 0 && valor) {
    atrasoMs = constrain(atol(valor), 0L, 3000L);
    char msg[24];
    snprintf(msg, sizeof(msg), "OK:DELAY:%lu", atrasoMs);
    saida(msg);
  } else if (strcmp(cmd, "LED") == 0 && valor) {
    piscadasRestantes = 0;
    digitalWrite(PINO_LED, atoi(valor) ? HIGH : LOW);
  } else if (strcmp(cmd, "BLINK") == 0 && valor) {
    digitalWrite(PINO_LED, LOW);
    piscadasRestantes = constrain(atoi(valor), 1, 10);
    proximaTroca = millis();
  } else if (strcmp(cmd, "RESET") == 0) {
    atrasoMs = 0;
    sonarLigado = true;
    piscadasRestantes = 0;
    digitalWrite(PINO_LED, LOW);
    saida("OK:RESET");
  } else if (cmd[0] != '\0') {
    char msg[40];
    snprintf(msg, sizeof(msg), "ERR:%s", cmd);
    saida(msg);
  }
}

// Comandos do cabo e do Bluetooth chegam aqui, letra por letra.
// (Do Bluetooth eles chegam em outra "tarefa" do ESP32; guardamos numa fila e tratamos no loop.)
volatile char filaRx[64];
volatile uint8_t rxIni = 0, rxFim = 0;

void receberCaractere(char c) {
  uint8_t prox = (rxFim + 1) % sizeof(filaRx);
  if (prox != rxIni) {
    filaRx[rxFim] = c;
    rxFim = prox;
  }
}

void tratarCaractere(char c) {
  if (c == '\r') return;
  if (c == '\n') {
    linha[tamLinha] = '\0';
    executarComando(linha);
    tamLinha = 0;
  } else if (tamLinha < sizeof(linha) - 1) {
    linha[tamLinha++] = c;
  }
}

void lerSerial() {
  while (Serial.available()) tratarCaractere(Serial.read());
  while (rxIni != rxFim) {
    char c = filaRx[rxIni];
    rxIni = (rxIni + 1) % sizeof(filaRx);
    tratarCaractere(c);
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PINO_TRIG, OUTPUT);
  pinMode(PINO_ECHO, INPUT);
  pinMode(PINO_BOOT, INPUT_PULLUP);
  pinMode(PINO_LED, OUTPUT);
  digitalWrite(PINO_TRIG, LOW);

  // Pisca 2 vezes: sinal de que ligou
  for (int i = 0; i < 2; i++) {
    digitalWrite(PINO_LED, HIGH);
    delay(100);
    digitalWrite(PINO_LED, LOW);
    delay(100);
  }
  delay(100);
  iniciarBle();
  enviarHello();
}

void loop() {
  lerSerial();
  lerBotaoBoot();
  lerUltrassom();
  enviarFila();
  atualizarLed();
}
