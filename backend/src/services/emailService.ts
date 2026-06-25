import nodemailer from 'nodemailer';
import { config } from '../config';
import pool from '../db/client';
import { randomUUID } from 'crypto';



let transporter: nodemailer.Transporter | null = null;
let senderEmail: string = '';


export async function initializeEmailService(): Promise<void> {
  try {
    const account = await getSenderAccount();

    transporter = nodemailer.createTransport({
      host: account.smtpHost,
      port: account.smtpPort,
      secure: false,
      auth: {
        user: account.email,
        pass: account.password,
      },
    });

    senderEmail = account.email;

    console.log('Email service initialized with sender:', account.email);
    console.log('Note: Use Ethereal inbox to view sent emails: https://ethereal.email/login');

    await transporter.verify();
    console.log('Email service initialized successfully');
  } catch (error) {
    console.error('Failed to initialize email service:', error);
    throw error;
  }
}

/**
 * Retrieves or creates a sender SMTP account from the database
 * 
 * We store sender accounts in the DB to support multiple senders.
 * For this demo, we use Ethereal (test SMTP), but in production
 * this would manage real SMTP credentials for different clients.
 * 
 * First active sender is used; if none exist, we create an Ethereal account.
 */
async function getSenderAccount(): Promise<{
  email: string;
  password: string;
  smtpHost: string;
  smtpPort: number;
}> {
  const [senders] = await pool.execute<Array<{
    id: string;
    email: string;
    password: string;
    smtpHost: string;
    smtpPort: number;
    isActive: boolean;
  }>>(
    'SELECT * FROM SenderAccount WHERE isActive = ? LIMIT 1',
    [true]
  );

  if (senders.length > 0) {
    return {
      email: senders[0].email,
      password: senders[0].password,
      smtpHost: senders[0].smtpHost,
      smtpPort: senders[0].smtpPort,
    };
  }

  const testAccount = await nodemailer.createTestAccount();
  const id = randomUUID();

  await pool.execute(
    'INSERT INTO SenderAccount (id, email, password, smtpHost, smtpPort, isActive) VALUES (?, ?, ?, ?, ?, ?)',
    [id, testAccount.user, testAccount.pass, 'smtp.ethereal.email', 587, true]
  );

  console.log('Created new Ethereal test account:', testAccount.user);
  console.log('Pass:', testAccount.pass);
  console.log('Note: Save these credentials to view emails in Ethereal inbox');

  return {
    email: testAccount.user,
    password: testAccount.pass,
    smtpHost: 'smtp.ethereal.email',
    smtpPort: 587,
  };
}


export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<{ messageId: string; previewUrl?: string }> {
  if (!transporter) {
    throw new Error('Email service not initialized');
  }

  const info = await transporter.sendMail({
    from: `"ReachInbox Demo" <${senderEmail}>`,
    to,
    subject,
    html: body,
    text: body.replace(/<[^>]*>/g, ''),
  });

  const previewUrl = nodemailer.getTestMessageUrl(info);

  console.log('Message ID:', info.messageId);
  console.log('Preview URL:', previewUrl);

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || undefined,
  };
}