import nodemailer from 'nodemailer';
import { GoogleAuth } from 'google-auth-library';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { STSClient, AssumeRoleWithWebIdentityCommand } from '@aws-sdk/client-sts';

export type EmailDeliveryProvider = 'zoho' | 'ses';
export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  unsubscribeUrl?: string;
};

export type EmailDeliveryResult = {
  provider: EmailDeliveryProvider;
  providerMessageId?: string;
  status: 'sent' | 'accepted';
};

type AwsCredentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: Date;
};

const AWS_REGION = process.env.SES_AWS_REGION || 'us-east-2';
export const SES_BUSINESS = 'wontstopmoving';
const SES_FROM = process.env.EMAIL_FROM_ADDRESS || 'Wont Stop Moving <noreply@wontstopmoving.com>';
const SES_REPLY_TO = process.env.EMAIL_REPLY_TO || 'support@wontstopmoving.com';
let cachedCredentials: AwsCredentials | null = null;
let cachedSesClient: SESv2Client | null = null;

export function emailDeliveryProvider(category?: string): EmailDeliveryProvider {
  const categories = (process.env.SES_EMAIL_CATEGORIES || '').split(',').map(value => value.trim());
  return process.env.EMAIL_DELIVERY_PROVIDER === 'ses' && category && categories.includes(category) ? 'ses' : 'zoho';
}

function zohoConfigured() {
  return !!process.env.ZOHO_SMTP_USER && !!process.env.ZOHO_SMTP_PASS && !/placeholder|your[_-]|changeme/i.test(process.env.ZOHO_SMTP_PASS);
}

function sesConfigured() {
  return [process.env.SES_ASSUME_ROLE_ARN, process.env.SES_WEB_IDENTITY_AUDIENCE, process.env.SES_CONFIGURATION_SET, process.env.SES_GOOGLE_SERVICE_ACCOUNT]
    .every(value => typeof value === 'string' && value.length > 3);
}

export function emailProviderConfigured(provider: EmailDeliveryProvider = 'zoho') {
  return provider === 'ses' ? sesConfigured() : zohoConfigured();
}

async function googleIdentityToken(audience: string) {
  const worker = process.env.SES_GOOGLE_SERVICE_ACCOUNT;
  if (!worker) throw new Error('SES_FEDERATION_NOT_CONFIGURED');
  const client = await new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] }).getClient();
  const { data: { token } } = await client.request<{ token?: string }>({
    url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${encodeURIComponent(worker)}:generateIdToken`,
    method: 'POST', data: { audience }, timeout: 10_000,
  });
  if (!token) throw new Error('GOOGLE_IDENTITY_TOKEN_UNAVAILABLE');
  return token;
}

async function temporaryAwsCredentials(): Promise<AwsCredentials> {
  if (cachedCredentials && cachedCredentials.expiration.getTime() > Date.now() + 5 * 60_000) return cachedCredentials;
  const roleArn = process.env.SES_ASSUME_ROLE_ARN;
  const audience = process.env.SES_WEB_IDENTITY_AUDIENCE;
  if (!roleArn || !audience) throw new Error('SES_FEDERATION_NOT_CONFIGURED');
  const response = await new STSClient({ region: AWS_REGION }).send(new AssumeRoleWithWebIdentityCommand({
    RoleArn: roleArn,
    RoleSessionName: `wsm-email-${Date.now()}`,
    WebIdentityToken: await googleIdentityToken(audience),
    DurationSeconds: 900,
  }), { abortSignal: AbortSignal.timeout(10_000) });
  const credentials = response.Credentials;
  if (!credentials?.AccessKeyId || !credentials.SecretAccessKey || !credentials.SessionToken || !credentials.Expiration) {
    throw new Error('SES_FEDERATION_CREDENTIALS_MISSING');
  }
  cachedCredentials = {
    accessKeyId: credentials.AccessKeyId,
    secretAccessKey: credentials.SecretAccessKey,
    sessionToken: credentials.SessionToken,
    expiration: credentials.Expiration,
  };
  return cachedCredentials;
}

function sesClient() {
  return cachedSesClient ??= new SESv2Client({ region: AWS_REGION, credentials: temporaryAwsCredentials, maxAttempts: 1 });
}

async function sendZoho(message: OutboundEmail): Promise<EmailDeliveryResult> {
  const port = Number(process.env.ZOHO_SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.ZOHO_SMTP_HOST || 'smtppro.zoho.com',
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.ZOHO_SMTP_USER, pass: process.env.ZOHO_SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  try {
    const result = await transport.sendMail({
      from: SES_FROM,
      replyTo: SES_REPLY_TO,
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(message.unsubscribeUrl ? { headers: { 'List-Unsubscribe': `<${message.unsubscribeUrl}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } } : {}),
    });
    if (!result.accepted?.length) throw new Error('SMTP_REJECTED');
    return { provider: 'zoho', providerMessageId: result.messageId, status: 'sent' };
  } finally {
    transport.close();
  }
}

async function sendSes(id: string, attemptId: string, message: OutboundEmail, pilot: boolean): Promise<EmailDeliveryResult> {
  const configurationSet = process.env.SES_CONFIGURATION_SET;
  if (!configurationSet) throw new Error('SES_CONFIGURATION_SET_MISSING');
  const result = await sesClient().send(new SendEmailCommand({
    FromEmailAddress: SES_FROM,
    Destination: { ToAddresses: [message.to] },
    ReplyToAddresses: [SES_REPLY_TO],
    ConfigurationSetName: configurationSet,
    Content: {
      Simple: {
        Subject: { Data: message.subject, Charset: 'UTF-8' },
        Body: { Text: { Data: message.text, Charset: 'UTF-8' } },
        ...(message.unsubscribeUrl ? { Headers: [
          { Name: 'List-Unsubscribe', Value: `<${message.unsubscribeUrl}>` },
          { Name: 'List-Unsubscribe-Post', Value: 'List-Unsubscribe=One-Click' },
        ] } : {}),
      },
    },
    EmailTags: [
      { Name: 'outboxId', Value: id },
      { Name: 'business', Value: SES_BUSINESS },
      { Name: 'attemptId', Value: attemptId },
      ...(pilot ? [{ Name: 'test', Value: 'pilot' }] : []),
    ],
  }), { abortSignal: AbortSignal.timeout(30_000) });
  if (!result.MessageId) throw new Error('SES_MESSAGE_ID_MISSING');
  return { provider: 'ses', providerMessageId: result.MessageId, status: 'accepted' };
}

export async function sendOutboxEmail(provider: EmailDeliveryProvider, id: string, attemptId: string, message: OutboundEmail, pilot: boolean) {
  return provider === 'ses' ? sendSes(id, attemptId, message, pilot) : sendZoho(message);
}

export function safeTransientEmailError(error: unknown) {
  const value = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  const status = value?.$metadata?.httpStatusCode;
  return status === 429 || (status === 400 && value?.name === 'ThrottlingException');
}
