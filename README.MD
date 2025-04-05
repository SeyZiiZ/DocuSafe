**DocumentSafe** is a secure desktop document management application designed to work offline. It enables users to store, organise, consult and search confidential documents locally, without relying on the cloud.

---

## 🛠️ Technical stack

- Frontend**: Angular (integrated into Electron)
- Backend**: Java + Spring Boot
- Database** : SQLite (local)
- Packaging** : Application packaged in `.exe` for Windows (via Electron Builder) (have to do it)

---

## ✨ Features

- 🔒 Secure, local document storage
- 🗃️ Organisation of documents by categories/tags
- 🔍 Integrated search system
- 📝 Rich text editor
- 👤 Local multi-profile management (coming soon)
- 🔄 Real-time synchronisation between profiles via WebSocket (coming soon)
- ✅ Fluid and responsive interface

---

## 📦 Installation

### Prerequisites

- Node.js](https://nodejs.org/)
- Angular CLI](https://angular.io/cli)
- [Java 17+](https://adoptium.net/)
- [Maven](https://maven.apache.org/)
- [Electron](https://www.electronjs.org/)
- [SQLite](https://www.sqlite.org/index.html)

### Launch the backend (dev mode)
``bash
cd backend
mvn spring-boot:run
```

### Run frontend (dev mode)
```bash
cd frontend
npm install
npm run electron:start
```

## 🧪 Tests

- Backend** : Unit tests with JUnit  
- Frontend** : Tests with Jasmine and Karma


## 🔐 Security

- Documents **never** leave the user's machine.
- Each user profile is locally isolated (coming soon).
- Local authentication possible (coming soon).
- File encryption planned in the roadmap.