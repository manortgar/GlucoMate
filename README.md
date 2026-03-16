# GlucoMate 🩺

> Aplicación de monitorización continua de glucosa (MCG) para pacientes con dispositivos Freestyle Libre 2 Plus.
> Trabajo de Fin de Grado (TFG) — Ingeniería Informática.

---

## 📁 Estructura del Repositorio

```
GlucoMate/
├── frontend/   # Aplicación móvil Android (React Native + Expo)
└── backend/    # API REST del servidor (Node.js + Express + PostgreSQL)
```

---

## 🏗️ Arquitectura del Sistema

```
[Sensor Freestyle Libre 2 Plus]
        ↓ (BLE Cifrado)
    [Juggluco App]           ← Puente local de descifrado
        ↓ HTTP (localhost)
  [GlucoMate Frontend]       ← React Native
        ↓ HTTP POST (LAN)
  [GlucoMate Backend]        ← Node.js + Express
        ↓ SQL
   [PostgreSQL DB]            ← Almacenamiento
```

---

## 🚀 Puesta en Marcha

### Backend
```bash
cd backend
npm install
# Crea un fichero .env con tus credenciales (ver .env.example)
node server.js
```

### Frontend
```bash
cd frontend
npm install
npx expo start
```

---

## 🛠️ Tecnologías

| Capa | Tecnología |
|------|-----------|
| Mobile App | React Native, Expo, D3.js, react-native-svg |
| Lectura Sensor | Juggluco (bridge NFC/BLE) |
| Backend API | Node.js, Express.js |
| Base de Datos | PostgreSQL |
| Build Nativo | EAS Build (Expo Application Services) |

---

## 📊 Funcionalidades

- ✅ Lectura de glucosa en tiempo real desde sensor Freestyle Libre 2 Plus
- ✅ Gráfica histórica de las últimas 12 horas (curva SVG/D3.js)
- ✅ Almacenamiento persistente en PostgreSQL
- ✅ Indicadores de tendencia (subida, bajada, plano)
- ✅ Alertas de color para hipoglucemia (<70) e hiperglucemia (>180)
- 🔜 Cálculo de HbA1c estimada
- 🔜 Tiempo en Rango (TiR)
