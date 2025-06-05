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
int proximo_id_huella = 1; // Auto-incremento para IDs de huella
unsigned long ultimoIntento = 0;
bool confirmacionRecibida = true;
String mensajeConfirmacion = "";
bool candidatosRecibidos = false;
bool votacionFinalizada = false;

String nombreCandidato1 = "Candidato 1";
String nombreCandidato2 = "Candidato 2";
int idCandidato1 = 1;
int idCandidato2 = 2;

// Variables para el ganador
String nombreGanador = "";
int votosGanador = 0;
bool mostrandoGanador = false;

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

  // Cargar próximo ID de huella desde memoria
  cargarProximoID();
  
  mostrar("Sistema listo\nPonga huella\npara registrar");
  Serial.println("\nSistema listo. Coloque huella para auto-registro...");
}

void cargarProximoID() {
  // Buscar el ID más alto existente y sumar 1
  Serial.println("Buscando última huella registrada...");
  
  int maxID = 0;
  for (int i = 1; i <= 162; i++) { // 162 es el máximo de huellas que soporta el AS608
    if (finger.loadModel(i) == FINGERPRINT_OK) {
      maxID = i;
    }
  }
  
  proximo_id_huella = maxID + 1;
  Serial.print("Próximo ID de huella: ");
  Serial.println(proximo_id_huella);
}

void loop() {
  if (!client.connected()) reconnect();
  client.loop();

  // Si la votación está finalizada, mostrar ganador
  if (votacionFinalizada && mostrandoGanador) {
    mostrarGanador();
    return;
  }

  // Detectar huella automáticamente (sin entrada por Serial)
  if (finger.getImage() == FINGERPRINT_OK) {
    // Verificar si es huella existente
    if (finger.image2Tz() == FINGERPRINT_OK) {
      if (finger.fingerFastSearch() == FINGERPRINT_OK) {
        // Huella existente encontrada - proceder a votar
        id_huella_actual = finger.fingerID;
        mostrar("Huella reconocida\nID: " + String(id_huella_actual));
        delay(1000);
        pedirVoto();
      } else {
        // Huella nueva - registrar automáticamente
        if (proximo_id_huella <= 162) {
          mostrar("Nueva huella\nRegistrando...\nID: " + String(proximo_id_huella));
          
          if (enrollFingerAuto(proximo_id_huella)) {
            id_huella_actual = proximo_id_huella;
            mostrar("Huella ID " + String(proximo_id_huella) + "\nregistrada OK");
            publicarHuella(proximo_id_huella);
            proximo_id_huella++; // Incrementar para la próxima
            esperarConfirmacion();
            pedirVoto();
          } else {
            mostrar("Error al registrar");
          }
        } else {
          mostrar("Memoria llena\n162 huellas max");
        }
      }
    }
    
    delay(2000);
    mostrar("Sistema listo\nPonga huella\npara votar");
  }
  
  delay(100); // Pequeña pausa para evitar lecturas excesivas
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

  if (String(topic) == "dedocracia/resultado") {
    Serial.println("Mensaje de resultado crudo: " + mensaje);
    DynamicJsonDocument doc(1024);
    DeserializationError error = deserializeJson(doc, mensaje);

    if (error) {
      Serial.print("Error al parsear resultado: ");
      Serial.println(error.c_str());
      return;
    }

    if (doc["finalizada"] == true && doc["ganador"]) {
      nombreGanador = doc["ganador"]["nombre"].as<String>();
      votosGanador = doc["ganador"]["votos"];
      votacionFinalizada = true;
      mostrandoGanador = true;

      Serial.println("🏆 VOTACIÓN FINALIZADA!");
      Serial.println("Ganador: " + nombreGanador);
      Serial.println("Votos: " + String(votosGanador));
      
      mostrarGanador();
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
      client.subscribe("dedocracia/resultado");
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

bool enrollFingerAuto(int id) {
  int p;
  mostrar("Mantenga dedo\nen sensor...");
  
  // Primera imagen
  while ((p = finger.getImage()) != FINGERPRINT_OK) {
    delay(50);
  }

  p = finger.image2Tz(1);
  if (p != FINGERPRINT_OK) {
    mostrar("Error imagen 1");
    return false;
  }

  mostrar("Retire dedo...");
  delay(1500);
  
  // Esperar a que retire el dedo
  unsigned long t0 = millis();
  while (finger.getImage() != FINGERPRINT_NOFINGER) {
    if (millis() - t0 > 5000) {
      mostrar("Timeout retiro");
      return false;
    }
    delay(50);
  }

  mostrar("Mismo dedo\notra vez...");
  delay(1000);
  
  // Segunda imagen
  while ((p = finger.getImage()) != FINGERPRINT_OK) {
    delay(50);
  }

  p = finger.image2Tz(2);
  if (p != FINGERPRINT_OK) {
    mostrar("Error imagen 2");
    return false;
  }
  
  if (finger.createModel() != FINGERPRINT_OK) {
    mostrar("Error modelo");
    return false;
  }
  
  if (finger.storeModel(id) != FINGERPRINT_OK) {
    mostrar("Error guardar");
    return false;
  }

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

  // CAMBIADO: Reducido de 15000 a 10000 ms (10 segundos)
  while (!votado && millis() - tiempoInicio < 10000) {
    if (digitalRead(BOTON_1) == LOW) {
      mostrar("Voto: " + nombreCandidato1);
      publicarVoto(id_huella_actual, idCandidato1);
      votado = true;
      delay(1000); // Evitar doble pulsación
    }
    if (digitalRead(BOTON_2) == LOW) {
      mostrar("Voto: " + nombreCandidato2);
      publicarVoto(id_huella_actual, idCandidato2);
      votado = true;
      delay(1000); // Evitar doble pulsación
    }
    client.loop();
    delay(50);
  }

  if (!votado) {
    mostrar("Tiempo agotado\n(10 segundos)\nsin votar");
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

void mostrarGanador() {
  display.clearBuffer();
  
  // Título
  display.setFont(u8g2_font_7x14_tf);
  display.drawStr(15, 15, "GANADOR!");
  
  // Nombre del ganador
  display.setFont(u8g2_font_6x10_tf);
  int nombreX = (128 - (nombreGanador.length() * 6)) / 2; // Centrar texto
  display.drawStr(max(0, nombreX), 35, nombreGanador.c_str());
  
  // Votos
  String votosTexto = "Votos: " + String(votosGanador);
  int votosX = (128 - (votosTexto.length() * 6)) / 2; // Centrar texto
  display.drawStr(max(0, votosX), 50, votosTexto.c_str());
  
  // Mensaje final
  display.setFont(u8g2_font_5x7_tf);
  display.drawStr(20, 63, "Felicitaciones!");
  
  display.sendBuffer();
  
  // Mantener la pantalla durante 5 segundos, luego parpadear
  static unsigned long ultimoCambio = 0;
  static bool visible = true;
  
  if (millis() - ultimoCambio > 1000) { // Cambiar cada segundo
    ultimoCambio = millis();
    visible = !visible;
    
    if (!visible) {
      display.clearBuffer();
      display.sendBuffer();
    }
  }
}
