import os from "os";
import fs from "fs";
import http from "http"
import path from 'path';
import https from "https";
import 'reflect-metadata';
import dotenv from "dotenv";
import cluster from 'cluster';
import configureApp from "./src/config/routes"
import { connectDatabase } from "./src/config/mysqldb";
import { connect_redis_database } from "./src/config/redisdb";
import express, { Application, Request, Response } from "express";
import { getLanguages } from "./src/utils/function";
import { upload_file_with_cloudinary } from "./src/utils/cloudinary";

const numCPUs = os.cpus().length;

dotenv.config()
const app: Application = express();

(async () => {
  await connectDatabase();
  // await connect_redis_database();
  // await getLanguages()

  // let photo_url = "https://evo-go.com/assets/logo/logoChar.png";
  // let photo_id = "evogo"
  // await upload_file_with_cloudinary(photo_url, photo_id)
})()

const PORT = process.env.PORT as string;
const APP_URL = process.env.APP_URL as string;
const EXPRESS_SESSION_SECRET = process.env.EXPRESS_SESSION_SECRET as string;
const IS_LIVE = process.env.IS_LIVE === "true";

app.use('/', express.static(path.join(__dirname, 'src/uploads')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

configureApp(app);

app.get("/", (req: Request, res: Response) => {
  return res.send("Initial project setup done")
});

let server;
if (IS_LIVE) {
  const sslOptions = {
    ca: fs.readFileSync("/var/www/html/ssl/ca_bundle.crt"),
    key: fs.readFileSync("/var/www/html/ssl/private.key"),
    cert: fs.readFileSync("/var/www/html/ssl/certificate.crt"),
  };
  server = https.createServer(sslOptions, app);
  server.listen(PORT, () => {
    console.log(`Server is working on ${APP_URL}`);
  })
} else {
  server = http.createServer(app);
  server.listen(PORT, (): void => {
    console.log(`Server is working on ${APP_URL}`);
  });
}