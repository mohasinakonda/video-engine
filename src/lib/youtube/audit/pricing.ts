import type { AuditSettings } from '../settings';

/** Comparing two videos runs two video audits, so it costs two (the admin sets the video price). */
export const compareCost = (audit: Pick<AuditSettings, 'videoAuditCreditCost'>) => audit.videoAuditCreditCost * 2;
