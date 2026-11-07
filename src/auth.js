import { Router } from 'express';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import rateLimit from 'express-rate-limit';
import { pool } from './db.js';
import { sendOtpMail } from './mailer.js';

const router = Router();

const EXPIRE_MIN = Number(process.env.OTP_EXPIRE_MINUTES || 5);
const MAX_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS || 5);
const COOLDOWN_SEC = Number(process.env.OTP_RESEND_COOLDOWN_SEC || 60);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const normalizeEmail = (v) => String(v || '').trim().toLowerCase();

// IP ごとのレート制限 (15分に20回まで)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'リクエストが多すぎます。しばらくしてからお試しください。' },
});

// 6桁の OTP を暗号論的乱数で生成
const generateOtp = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

/* ---------- 1) OTP 送信 ---------- */
router.post('/request-otp', limiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'メールアドレスの形式が正しくありません。' });
  }

  try {
    // 再送クールダウン
    const { rows } = await pool.query(
      `SELECT created_at FROM email_otps
       WHERE email = $1 ORDER BY created_at DESC LIMIT 1`,
      [email]
    );
    if (rows[0]) {
      const elapsed = (Date.now() - new Date(rows[0].created_at).getTime()) / 1000;
      if (elapsed < COOLDOWN_SEC) {
        return res.status(429).json({
          error: `再送は ${Math.ceil(COOLDOWN_SEC - elapsed)} 秒後に可能です。`,
        });
      }
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);

    // 古い未使用 OTP を無効化して新規登録
    await pool.query(`UPDATE email_otps SET used = TRUE WHERE email = $1 AND used = FALSE`, [email]);
    await pool.query(
      `INSERT INTO email_otps (email, otp_hash, expires_at)
       VALUES ($1, $2, now() + ($3 || ' minutes')::interval)`,
      [email, otpHash, String(EXPIRE_MIN)]
    );

    await sendOtpMail(email, otp);

    // 登録済みかどうかは漏らさない
    res.json({ message: 'ワンタイムパスワードをメールで送信しました。' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  }
});

/* ---------- 2) OTP 検証 → ログイン ---------- */
router.post('/verify-otp', limiter, async (req, res) => {
  const email = normalizeEmail(req.body.email);
  const otp = String(req.body.otp || '').trim();

  if (!EMAIL_RE.test(email) || !/^\d{6}$/.test(otp)) {
    return res.status(400).json({ error: '入力内容が正しくありません。' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 最新の未使用 OTP をロックして取得
    const { rows } = await client.query(
      `SELECT * FROM email_otps
       WHERE email = $1 AND used = FALSE
       ORDER BY created_at DESC LIMIT 1
       FOR UPDATE`,
      [email]
    );
    const record = rows[0];

    if (!record || new Date(record.expires_at) < new Date()) {
      await client.query('COMMIT');
      return res.status(400).json({ error: 'コードが無効または期限切れです。再送してください。' });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      await client.query(`UPDATE email_otps SET used = TRUE WHERE id = $1`, [record.id]);
      await client.query('COMMIT');
      return res.status(429).json({ error: '試行回数の上限に達しました。再送してください。' });
    }

    const ok = await bcrypt.compare(otp, record.otp_hash);
    if (!ok) {
      await client.query(`UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1`, [record.id]);
      await client.query('COMMIT');
      return res.status(400).json({ error: 'コードが正しくありません。' });
    }

    // 成功: OTP を使用済みに + ユーザーを作成/取得
    await client.query(`UPDATE email_otps SET used = TRUE WHERE id = $1`, [record.id]);
    const userRes = await client.query(
      `INSERT INTO users (email) VALUES ($1)
       ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
       RETURNING id, email`,
      [email]
    );
    await client.query('COMMIT');

    const user = userRes.rows[0];

    // セッション固定攻撃対策で ID を再生成
    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'セッションエラーが発生しました。' });
      req.session.userId = user.id;
      req.session.email = user.email;
      res.json({ message: 'ログインしました。', user });
    });
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'サーバーエラーが発生しました。' });
  } finally {
    client.release();
  }
});

/* ---------- 3) ログアウト ---------- */
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('sid');
    res.json({ message: 'ログアウトしました。' });
  });
});

/* ---------- 認証ミドルウェア ---------- */
export function requireAuth(req, res, next) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: 'ログインが必要です。' });
  }
  next();
}

export default router;
