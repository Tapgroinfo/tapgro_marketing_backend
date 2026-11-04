import type { TemplateChannel } from '../db/schemas/messageTemplate.schema';

/** Slugs referenced from code. */
export const TEMPLATE_SLUGS = {
  ADMIN_PASSWORD_RESET_OTP: 'admin_password_reset_otp',
  ADMIN_WELCOME: 'admin_welcome',
  SUPPORT_TICKET_RECEIVED: 'support_ticket_received',
  SUPPORT_TICKET_REPLY: 'support_ticket_reply',
} as const;

/** Seeded once with isSystem=true; content stays editable by admins. */
export const DEFAULT_TEMPLATES: Array<{
  channel: TemplateChannel;
  slug: string;
  name: string;
  subject?: string;
  body: string;
  variables: string[];
  isActive: boolean;
}> = [
  {
    channel: 'email',
    slug: TEMPLATE_SLUGS.ADMIN_PASSWORD_RESET_OTP,
    name: 'Admin password reset code',
    subject: 'Your {{appName}} password reset code',
    body: '<p>Hi {{name}},</p><p>Your password reset code is <b>{{otp}}</b>. It expires in {{expiryMinutes}} minutes.</p><p>If you did not request this, you can ignore this email.</p>',
    variables: ['appName', 'name', 'otp', 'expiryMinutes'],
    isActive: true,
  },
  {
    channel: 'email',
    slug: TEMPLATE_SLUGS.ADMIN_WELCOME,
    name: 'New admin account',
    subject: 'Your {{appName}} admin account',
    body: '<p>Hi {{name}},</p><p>An admin account has been created for you with the email <b>{{email}}</b>.</p><p>Ask your administrator for the password, or use "Forgot password" on the login page to set your own.</p>',
    variables: ['appName', 'name', 'email'],
    isActive: true,
  },
  {
    channel: 'email',
    slug: TEMPLATE_SLUGS.SUPPORT_TICKET_RECEIVED,
    name: 'Support request received',
    subject: '[{{ticketNo}}] We received your request',
    body: '<p>Hi {{name}},</p><p>Thanks for contacting {{appName}}. Your request <b>{{ticketNo}}</b> ("{{subject}}") has been received and our team will reply soon.</p>',
    variables: ['appName', 'name', 'ticketNo', 'subject'],
    isActive: true,
  },
  {
    channel: 'email',
    slug: TEMPLATE_SLUGS.SUPPORT_TICKET_REPLY,
    name: 'Support reply',
    subject: 'Re: [{{ticketNo}}] {{subject}}',
    body: '<p>Hi {{name}},</p><p>{{message}}</p><p>— {{appName}} Support</p>',
    variables: ['appName', 'name', 'ticketNo', 'subject', 'message'],
    isActive: true,
  },
  {
    channel: 'sms',
    slug: TEMPLATE_SLUGS.ADMIN_PASSWORD_RESET_OTP,
    name: 'Admin password reset OTP (SMS)',
    body: 'Your {{appName}} password reset OTP is {{otp}}. Valid for {{expiryMinutes}} minutes.',
    variables: ['appName', 'otp', 'expiryMinutes'],
    isActive: false,
  },
];
