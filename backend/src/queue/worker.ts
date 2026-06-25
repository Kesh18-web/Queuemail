import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { OutgoingMailTask } from './reachinboxScheduler';
import { sendEmail } from '../services/emailService';
import { checkRateLimit } from '../services/rateLimiter';
import pool from '../db/client';



let emailWorker: Worker | null = null;


async function processEmailDelivery(job: Job<OutgoingMailTask>): Promise<void> {
  const { dispatchId, recipientEmail, subject, body, scheduledTime, senderId } =
    job.data;

  console.log(`Processing email delivery task ${dispatchId} for ${recipientEmail}`);

  
  const [existingDispatch] = await pool.query<Array<{ status: string }>>(
    'SELECT status FROM MailDispatch WHERE id = ?',
    [dispatchId]
  );

  if (existingDispatch.length > 0 && existingDispatch[0].status === 'SENT') {
    console.log(`Dispatch ${dispatchId} already sent, skipping duplicate execution`);
    return; 
  }

  
  await pool.execute(
    'UPDATE MailDispatch SET status = ? WHERE id = ?',
    ['SENDING', dispatchId]
  );

  try {
    
    const rateLimitResult = await checkRateLimit(senderId);

    if (!rateLimitResult.allowed) {
      console.log(
        `Rate limit exceeded for dispatch ${dispatchId}. Rescheduling for next hour window...`
      );

      
      await pool.execute(
        'UPDATE MailDispatch SET status = ?, scheduledTime = ? WHERE id = ?',
        ['RATE_LIMITED', new Date(rateLimitResult.resetTime), dispatchId]
      );

     
      const delayUntilNextHour = rateLimitResult.resetTime - Date.now();
      if (delayUntilNextHour > 0) {
        await job.moveToDelayed(delayUntilNextHour);
       
        return;
      } else {
        
        throw new Error('Rate limit exceeded, retrying...');
      }
    }


    if (config.rateLimiting.minDelayBetweenEmailsMs > 0) {
      await new Promise((resolve) =>
        setTimeout(resolve, config.rateLimiting.minDelayBetweenEmailsMs)
      );
    }

 
    const sendResult = await sendEmail(recipientEmail, subject, body);

    
    await pool.execute(
      'UPDATE MailDispatch SET status = ?, sentTime = ?, senderEmail = ?, previewUrl = ? WHERE id = ?',
      ['SENT', new Date(), sendResult.messageId, sendResult.previewUrl || null, dispatchId]
    );

    console.log(
      `Email delivery completed: ${recipientEmail} (Preview: ${sendResult.previewUrl || 'N/A'})`
    );
  } catch (error: any) {
    console.error(`Failed to deliver email for dispatch ${dispatchId}:`, error);

    await pool.execute(
      'UPDATE MailDispatch SET status = ?, errorMessage = ? WHERE id = ?',
      ['FAILED', error.message || 'Unknown error', dispatchId]
    );

   
    if (error.message?.includes('Rate limit exceeded')) {
      throw error;
    }

    throw error;
  }
}


export function startWorker(): void {
  if (emailWorker) {
    console.log('Email worker already started');
    return;
  }

  emailWorker = new Worker(
    'reachinboxScheduler',
    async (job: Job<OutgoingMailTask>) => {
      return processEmailDelivery(job);
    },
    {
      connection: {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
      },
      concurrency: config.rateLimiting.workerConcurrency,
     
    }
  );

  emailWorker.on('completed', (job) => {
    console.log(`Email delivery task ${job.id} completed`);
  });

  emailWorker.on('failed', (job, err) => {
    console.error(`Email delivery task ${job?.id} failed:`, err.message);
  });

  emailWorker.on('error', (err) => {
    console.error('Email worker error:', err);
  });

  console.log(
    `Email delivery worker started with concurrency: ${config.rateLimiting.workerConcurrency}`
  );
}

/
export async function stopWorker(): Promise<void> {
  if (emailWorker) {
    await emailWorker.close();
    emailWorker = null;
    console.log('Email worker stopped');
  }
}
