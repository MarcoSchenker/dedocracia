#include <Adafruit_Fingerprint.h>
#include <U8g2lib.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

const char* ssid = "UA-Alumnos";
const char* password = "41umn05WLC";
const char* mqtt_server = "34.197.123.11";
const int mqtt_port = 1883;

#define RX_PIN 16
#define TX_PIN 17
#define SDA_OLED 21
#define SCL_OLED 22
#define BOTON_1 18
#define BOTON_2 25

Adafruit_Fingerprint finger(&Serial2);
U8G2_SSD1309_128X64_NONAME0_F_HW_I2C display(U8G2_R0, U8X8_PIN_NONE, SCL_OLED, SDA_OLED);

WiFiClient espClient;
PubSubClient client(espClient);

int id_huella_actual = 0;
unsigned long ultimoIntento = 0;
bool confirmacionRecibida = true;
String mensajeConfirmacion = "";
bool candidatosRecibidos = false;

String nombreCandidato1 = "Candidato 1";
String nombreCandidato2 = "Candidato 2";
int idCandidato1 = 1;
int idCandidato2 = 2;

void setup() {
  Serial.begin(115200);
  Serial2.begin(57600, SERIAL_8N1, RX_PIN, TX_PIN);
  finger.begin(57600);
  display.begin();

  pinMode(BOTON_1, INPUT_PULLUP);
  pinMode(BOTON_2, INPUT_PULLUP);

  mostrar("Iniciando...");
  delay(500);

  setupWifi();
  client.setServer(mqtt_server, mqtt_port);
  client.setCallback(callback);

  if (!finger.verifyPassword()) {
    mostrar("Error sensor");
    while (1);
  }

  mostrar("Sensor OK\nIngrese ID por\nSerial 1-127");
  Serial.println("\nEsperando ID de huella para registrar...");
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  if (Serial.available()) {
    int id = Serial.parseInt();
    while (Serial.available()) Serial.read();

    if (id < 1 || id > 127) {
      mostrar("ID invalido\nRango: 1-127");
      return;
    }

    if (finger.loadModel(id) == FINGERPRINT_OK) {
      mostrar("ID ocupado\nUse otro");
      return;
    }

    mostrar("Registrando ID " + String(id));

    if (enrollFinger(id)) {
      id_huella_actual = id;
      mostrar("Huella ID " + String(id) + "\nregistrada OK");
      publicarHuella(id);
      esperarConfirmacion();
      pedirVoto();
    } else {
      mostrar("Error al registrar");
    }

    delay(2000);
    mostrar("Ingrese otro ID...");
  }
}

void setupWifi() {
  mostrar("Conectando WiFi\n" + String(ssid));
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);

  int intentos = 0;
  while (WiFi.status() != WL_CONNECTED && intentos < 40) {
    delay(500);
    intentos++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    mostrar("Error WiFi\nReiniciando...");
    delay(2000);
    ESP.restart();
  }

  mostrar("WiFi conectado\nIP: " + WiFi.localIP().toString());
  delay(2000);
}

void callback(char* topic, byte* payload, unsigned int length) {
  String mensaje = "";
  for (int i = 0; i < length; i++) mensaje += (char)payload[i];

  Serial.println("Mensaje recibido [" + String(topic) + "]: " + mensaje);

  if (String(topic) == "dedocracia/confirmacion") {
    DynamicJsonDocument doc(256);
    deserializeJson(doc, mensaje);
    String status = doc["status"];
    int huella = doc["id_huella"];

    if (huella == id_huella_actual) {
      confirmacionRecibida = true;
      mensajeConfirmacion = "Registrado";
    }
  }

  if (String(topic) == "dedocracia/candidatos") {
    Serial.println("Mensaje de candidatos crudo: " + mensaje);
    DynamicJsonDocument doc(512);
    DeserializationError error = deserializeJson(doc, mensaje);

    if (error) {
      Serial.print("Error al parsear candidatos: ");
      Serial.println(error.c_str());
      return;
    }

    JsonArray candidatos = doc["candidatos"];
    if (candidatos && candidatos.size() >= 2) {
      idCandidato1 = candidatos[0]["id"];
      nombreCandidato1 = candidatos[0]["nombre"].as<String>();
      idCandidato2 = candidatos[1]["id"];
      nombreCandidato2 = candidatos[1]["nombre"].as<String>();
      candidatosRecibidos = true;

      Serial.println("Candidatos recibidos:");
      Serial.println("1: " + nombreCandidato1 + " (ID: " + String(idCandidato1) + ")");
      Serial.println("2: " + nombreCandidato2 + " (ID: " + String(idCandidato2) + ")");
    } else {
      Serial.println("No se encontraron al menos 2 candidatos en el mensaje.");
    }
  }
}

void reconnect() {
  while (!client.connected()) {
    String clientId = "ESP32Client-" + String(random(0xffff), HEX);
    Serial.print("Intentando conexión MQTT... ");

    if (client.connect(clientId.c_str())) {
      Serial.println("conectado!");
      client.subscribe("dedocracia/confirmacion");
      client.subscribe("dedocracia/candidatos");
      Serial.println("Solicitando lista de candidatos...");
      client.publish("dedocracia/solicitud", "{\"accion\":\"obtener_candidatos\"}");
    } else {
      Serial.print("falló, rc=");
      Serial.print(client.state());
      Serial.println(" reintentando en 5 segundos");
      delay(5000);
    }
  }
}

bool enrollFinger(int id) {
  int p;
  mostrar("Coloque dedo...");
  while ((p = finger.getImage()) != FINGERPRINT_OK);

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) return false;

  mostrar("Retire dedo...");
  delay(2000);
  unsigned long t0 = millis();
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    if (millis() - t0 > 6000) return false;
  }

  mostrar("Mismo dedo otra vez...");
  delay(1000);
  while ((p = finger.getImage()) != FINGERPRINT_OK);

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) return false;
  if (finger.createModel() != FINGERPRINT_OK) return false;
  if (finger.storeModel(id) != FINGERPRINT_OK) return false;

  return true;
}

void publicarHuella(int id) {
  DynamicJsonDocument doc(128);
  doc["id_huella"] = id;
  String output;
  serializeJson(doc, output);
  client.publish("dedocracia/huella", output.c_str());
  confirmacionRecibida = true;
  mensajeConfirmacion = "";
}

void publicarVoto(int id_huella, int id_candidato) {
  DynamicJsonDocument doc(128);
  doc["id_huella"] = id_huella;
  doc["id_candidato"] = id_candidato;
  String output;
  serializeJson(doc, output);
  client.publish("dedocracia/voto", output.c_str());
  confirmacionRecibida = true;
  mensajeConfirmacion = "";
}

void esperarConfirmacion() {
  delay(500);
}

void pedirVoto() {
  if (!candidatosRecibidos) {
    mostrar("Esperando\ncandidatos...");
    unsigned long espera = millis();
    while (!candidatosRecibidos && millis() - espera < 5000) {
      client.loop();
      delay(100);
    }
    if (!candidatosRecibidos) {
      mostrar("Error: sin\ncandidatos");
      return;
    }
  }

  mostrar("Elija candidato:\n[1] " + nombreCandidato1 + "\n[2] " + nombreCandidato2);
  Serial.println("Esperando voto: 1=" + nombreCandidato1 + " o 2=" + nombreCandidato2);

  unsigned long tiempoInicio = millis();
  bool votado = false;

  while (!votado && millis() - tiempoInicio < 15000) {
    if (digitalRead(BOTON_1) == LOW) {
      mostrar("Voto: " + nombreCandidato1);
      publicarVoto(id_huella_actual, idCandidato1);
      votado = true;
    }
    if (digitalRead(BOTON_2) == LOW) {
      mostrar("Voto: " + nombreCandidato2);
      publicarVoto(id_huella_actual, idCandidato2);
      votado = true;
    }
    client.loop();
    delay(50);
  }

  if (!votado) {
    mostrar("Tiempo agotado\nsin votar");
  }
  delay(2000);
}

void mostrar(String texto) {
  display.clearBuffer();
  display.setFont(u8g2_font_6x10_tf);
  int y = 12;
  String linea = "";

  for (int i = 0; i < texto.length(); i++) {
    if (texto[i] == '\n' || i == texto.length() - 1) {
      if (i == texto.length() - 1) linea += texto[i];
      display.drawStr(0, y, linea.c_str());
      linea = "";
      y += 12;
    } else {
      linea += texto[i];
    }
  }
  display.sendBuffer();
}