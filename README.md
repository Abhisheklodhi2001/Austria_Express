# Project Name

---

## Prerequisites

Make sure you have the following installed on your system:

- [Node.js](https://nodejs.org/)
- [npm](https://www.npmjs.com/)
- [MySQL](https://www.mysql.com/)
- [Git](https://git-scm.com/)

---

## Project Setup

1. **Download the Project Zip File**:

   - this is the file for the backend zip downalod - https://drive.google.com/drive/folders/1IVx0z08X6vy16hydmtjGiMqVNWCdJNeN

2. **Install dependencies**:

   ```bash
   npm install
   # or
   yarn install
   ```

---

## Database Setup

1. **Start MySQL Server**:
   Make sure your MySQL server is running.

2. **Create Database**:

   ```sql
   CREATE DATABASE evo_go;
   ```

---

## Running the Project

1. **Start the development server**:

   ```bash
   npm run dev
   ```

   This will start the server in development mode with live reload.

2. **Testing the API**:
   Use tools like [Postman](https://www.postman.com/) or [cURL](https://curl.se/) to test the endpoints.

---

## Compile TypeScript:

If you are running the project for the first time:

```bash
tsc
```

- after the compile this you will see the build folder.
- this is your final code for the production
- open the build and drag and drop this code on the server using the winscp
- this is step for the uplaod the code on the server. - https://docs.google.com/document/d/1rHq6eyneb2gqEtYWub8CxTbkg29jJGBaSF1nh9BR7D0/edit?tab=t.0

---

## Scripts

Here are some useful scripts:

- **Build**: `tsc` – Compile the TypeScript code.
- **Start Dev Server**: `npm run dev` – Start the development server.

---
