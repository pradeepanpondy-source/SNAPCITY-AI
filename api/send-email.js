import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // CORS setup for Serverless API
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { toEmail, replyTo, subject, text, fromName } = req.body;

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log(`[Email Mock Mode] Would have sent email to: ${toEmail}`);
    console.log(`[Subject]: ${subject}`);
    return res.status(200).json({ success: true, messageId: 'mock-id-12345', notice: 'Email mocked because Gmail was not configured.' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });

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
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Error sending email:', error);
    return res.status(500).json({ error: 'Failed to send email' });
  }
}
