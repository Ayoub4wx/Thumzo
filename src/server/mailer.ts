import { Resend } from 'resend';
import type { ReactElement } from 'react';
import { serverEnv } from './env.js';

const resend = new Resend(serverEnv.resendApiKey || '');

export const sendEmail = async ({
  to,
  subject,
  react,
  idempotencyKey,
}: {
  to: string;
  subject: string;
  react: ReactElement;
  idempotencyKey?: string;
}) => {
  return await resend.emails.send(
    {
      from: serverEnv.resendFromEmail || 'onboarding@thumoraai.com',
      to,
      subject,
      react,
    },
    idempotencyKey ? { idempotencyKey } : undefined
  );
};
