import { Router, Request, Response } from 'express';
import pool from '../db/client';

const router = Router();

/**
 * GET /api/dispatches/scheduled
 * Get all scheduled (pending) dispatches
 */
router.get('/scheduled', async (req: Request, res: Response) => {
  try {
    const { userId, page = '1', limit = '50' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Use query instead of execute for LIMIT/OFFSET to avoid prepared statement issues
    const [dispatches] = await pool.query<Array<{
      id: string;
      campaignId: string;
      recipientEmail: string;
      subject: string;
      body: string;
      scheduledTime: Date;
      sentTime: Date | null;
      status: string;
      errorMessage: string | null;
      senderEmail: string | null;
      createdAt: Date;
      updatedAt: Date;
      campaign_id: string;
      campaign_subject: string;
    }>>(
      `SELECT d.*, c.id as campaign_id, c.subject as campaign_subject
       FROM MailDispatch d
       INNER JOIN MailCampaign c ON d.campaignId = c.id
       WHERE c.userId = ? AND d.status IN ('PENDING', 'SCHEDULED', 'RATE_LIMITED')
       ORDER BY d.scheduledTime ASC
       LIMIT ? OFFSET ?`,
      [userId, limitNum, offset]
    );

    // Format response to match expected structure
    const formattedDispatches = dispatches.map((d) => ({
      id: d.id,
      campaignId: d.campaignId,
      recipientEmail: d.recipientEmail,
      subject: d.subject,
      body: d.body,
      scheduledTime: d.scheduledTime,
      sentTime: d.sentTime,
      status: d.status,
      errorMessage: d.errorMessage,
      senderEmail: d.senderEmail,
      previewUrl: d.previewUrl,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      campaign: {
        id: d.campaign_id,
        subject: d.campaign_subject,
      },
    }));

    res.json({
      success: true,
      data: formattedDispatches,
    });
  } catch (error: any) {
    console.error('Error fetching scheduled dispatches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scheduled dispatches',
    });
  }
});

/**
 * GET /api/dispatches/sent
 * Get all sent dispatches
 */
router.get('/sent', async (req: Request, res: Response) => {
  try {
    const { userId, page = '1', limit = '50' } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required',
      });
    }

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const offset = (pageNum - 1) * limitNum;

    // Use query instead of execute for LIMIT/OFFSET to avoid prepared statement issues
    const [dispatches] = await pool.query<Array<{
      id: string;
      campaignId: string;
      recipientEmail: string;
      subject: string;
      body: string;
      scheduledTime: Date;
      sentTime: Date | null;
      status: string;
      errorMessage: string | null;
      senderEmail: string | null;      previewUrl: string | null;      createdAt: Date;
      updatedAt: Date;
      campaign_id: string;
      campaign_subject: string;
    }>>(
      `SELECT d.*, c.id as campaign_id, c.subject as campaign_subject
       FROM MailDispatch d
       INNER JOIN MailCampaign c ON d.campaignId = c.id
       WHERE c.userId = ? AND d.status IN ('SENT', 'FAILED')
       ORDER BY d.sentTime DESC
       LIMIT ? OFFSET ?`,
      [userId, limitNum, offset]
    );

    // Format response to match expected structure
    const formattedDispatches = dispatches.map((d) => ({
      id: d.id,
      campaignId: d.campaignId,
      recipientEmail: d.recipientEmail,
      subject: d.subject,
      body: d.body,
      scheduledTime: d.scheduledTime,
      sentTime: d.sentTime,
      status: d.status,
      errorMessage: d.errorMessage,
      senderEmail: d.senderEmail,
      previewUrl: d.previewUrl,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      campaign: {
        id: d.campaign_id,
        subject: d.campaign_subject,
      },
    }));

    res.json({
      success: true,
      data: formattedDispatches,
    });
  } catch (error: any) {
    console.error('Error fetching sent dispatches:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch sent dispatches',
    });
  }
});

export default router;
