import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Nodemailer configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

app.post('/api/send-email', async (req, res) => {
  const { toEmail, replyTo, subject, text, fromName } = req.body;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[Email Mock Mode] Would have sent email to: ${toEmail}`);
    console.log(`[Subject]: ${subject}`);
    return res.status(200).json({ success: true, messageId: 'mock-id-12345', notice: 'Email mocked because Gmail was not configured.' });
  }

  try {
    const mailOptions = {
      from: `"${fromName || 'Snap City AI'}" <${process.env.GMAIL_USER}>`,
      to: toEmail,
      replyTo: replyTo,
      subject: subject,
      text: text,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Serve the Vite React app production build
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// Catch-all route to serve index.html for React Router (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Express server running on http://127.0.0.1:${PORT}`);
  console.log(`Serving API on /api and static frontend from /dist`);
});
