import nodemailer from 'nodemailer';
import 'dotenv/config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function sendOtpMail(to, otp) {
  const minutes = process.env.OTP_EXPIRE_MINUTES || 5;
  await transporter.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: 'ログイン用ワンタイムパスワード',
    text: `ワンタイムパスワード: ${otp}\n\nこのコードは ${minutes} 分間有効です。\n心当たりがない場合は、このメールを無視してください。`,
    html: `
      <p>ログイン用のワンタイムパスワードです。</p>
      <p style="font-size:28px;font-weight:bold;letter-spacing:6px">${otp}</p>
      <p>このコードは ${minutes} 分間有効です。<br>心当たりがない場合は、このメールを無視してください。</p>
    `,
  });
}
