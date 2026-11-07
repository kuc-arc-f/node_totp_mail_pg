# node_totp_mail_pg

 Version: 0.9.1

 Author  : 

 date    : 2026/11/07
 
 update  :

***

node.js , authrize TOTP Mail PostgreSQL

* PostgreSQL DB
* express
* nodemailer , bcrypt
* node22
* Linux

***
* Table: schema.sql

***

* .env
```
PORT=3000
NODE_ENV=development
# PostgreSQL
DATABASE_URL=postgresql://root:admin@localhost:5432/mydb
# セッション用のランダムな長い文字列
SESSION_SECRET=change-me-to-a-long-random-string
# SMTP (例: Gmail の場合はアプリパスワードを使用)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
MAIL_FROM="My App <your@gmail.com>"
# OTP 設定
OTP_EXPIRE_MINUTES=5
OTP_MAX_ATTEMPTS=5
OTP_RESEND_COOLDOWN_SEC=60
```

***
* startf
```
npm install
npm run start      # http://localhost:3000
```

***
### version
* V_0_9_1: new

***
### blog

