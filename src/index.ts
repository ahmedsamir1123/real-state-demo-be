import express, {
  NextFunction,
  Request,
  Response
} from "express";

import { config } from "dotenv";

import { bootstrap } from "./app.controller";

/*
 * Vercel بيقرأ Environment Variables من Dashboard.
 * ملف production.env هنستخدمه خارج Vercel فقط.
 */
if (!process.env.VERCEL) {
  config({
    path: "./config/production.env"
  });
}

const app = express();

const port = Number(process.env.PORT || 3000);

/*
 * أول Request على Vercel ينتظر انتهاء bootstrap
 * واتصال MongoDB وتسجيل الـRoutes.
 */
let appReady: Promise<void>;

app.use(
  async (
    _request: Request,
    _response: Response,
    next: NextFunction
  ) => {
    try {
      await appReady;
      next();
    } catch (error) {
      next(error);
    }
  }
);

appReady = bootstrap(app, express);

/*
 * app.listen يعمل محليًا فقط.
 * Vercel هو المسؤول عن تشغيل السيرفر.
 */
if (!process.env.VERCEL) {
  appReady
    .then(() => {
      app.listen(port, () => {
        console.log(`Server running on port ${port}`);
      });
    })
    .catch((error) => {
      console.error("Failed to start server", error);
      process.exit(1);
    });
}

/*
 * Vercel هيستخدم الـExpress Application من هنا.
 */
export default app;