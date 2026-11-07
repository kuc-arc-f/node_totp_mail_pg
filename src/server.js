import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from './db.js';
import authRouter, { requireAuth } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';
const PgStore = connectPgSimple(session);

//user: process.env.SMTP_USER,
//    pass: process.env.SMTP_PASS,
console.log("SMTP_USER=", process.env.SMTP_USER)
console.log("SMTP_PASS=", process.env.SMTP_PASS)
const app = express();
if (isProd) app.set('trust proxy', 1); // リバースプロキシ配下の場合

app.use(express.json());
app.use(
  session({
    name: 'sid',
    store: new PgStore({ pool, createTableIfMissing: true }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProd, // 本番は HTTPS 必須
      maxAge: 1000 * 60 * 60 * 24 * 7, // 7日
    },
  })
);

app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/auth', authRouter);

// 認証が必要なAPIの例
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: req.session.userId, email: req.session.email });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running: http://localhost:${port}`));
