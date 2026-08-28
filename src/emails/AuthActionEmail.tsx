import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import * as React from 'react';

interface AuthActionEmailProps {
  preview: string;
  heading: string;
  body: string;
  buttonLabel: string;
  actionUrl: string;
}

export const AuthActionEmail = ({
  preview,
  heading,
  body,
  buttonLabel,
  actionUrl,
}: AuthActionEmailProps) => (
  <Html>
    <Head />
    <Preview>{preview}</Preview>
    <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Arial, sans-serif', margin: 0 }}>
      <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', maxWidth: 560, padding: 32 }}>
        <Heading style={{ color: '#111111', fontSize: 24, lineHeight: '32px', margin: '0 0 16px' }}>
          {heading}
        </Heading>
        <Text style={{ color: '#333333', fontSize: 16, lineHeight: '24px', margin: '0 0 24px' }}>
          {body}
        </Text>
        <Button
          href={actionUrl}
          style={{
            backgroundColor: '#111111',
            borderRadius: 6,
            color: '#ffffff',
            display: 'inline-block',
            fontSize: 15,
            fontWeight: 700,
            padding: '12px 18px',
            textDecoration: 'none',
          }}
        >
          {buttonLabel}
        </Button>
        <Text style={{ color: '#666666', fontSize: 13, lineHeight: '20px', margin: '24px 0 0' }}>
          If the button does not work, paste this link into your browser:
        </Text>
        <Text style={{ color: '#333333', fontSize: 13, lineHeight: '20px', overflowWrap: 'break-word' }}>
          {actionUrl}
        </Text>
      </Container>
    </Body>
  </Html>
);

export const ConfirmAccountEmail = ({ actionUrl }: { actionUrl: string }) => (
  <AuthActionEmail
    preview="Confirm your Thumora AI account"
    heading="Confirm your account"
    body="Click the button below to confirm your Thumora AI account. After that, you can sign in with your email and password."
    buttonLabel="Confirm account"
    actionUrl={actionUrl}
  />
);

export const ContinueAccountEmail = ({ actionUrl }: { actionUrl: string }) => (
  <AuthActionEmail
    preview="Continue to Thumora AI"
    heading="Continue to Thumora AI"
    body="This email address already has an account or pending signup. Use this secure link to continue."
    buttonLabel="Continue"
    actionUrl={actionUrl}
  />
);

export const MagicLinkEmail = ({ actionUrl, mode }: { actionUrl: string; mode: "login" | "signup" }) => (
  <AuthActionEmail
    preview="Sign in to Thumora AI"
    heading={mode === "signup" ? "Finish creating your account" : "Sign in to Thumora AI"}
    body="Click the button below to securely sign in. This link can only be used from this email address."
    buttonLabel="Sign in"
    actionUrl={actionUrl}
  />
);

export const ResetPasswordEmail = ({ actionUrl }: { actionUrl: string }) => (
  <AuthActionEmail
    preview="Reset your Thumora AI password"
    heading="Reset your password"
    body="Click the button below to set a new password for your Thumora AI account."
    buttonLabel="Reset password"
    actionUrl={actionUrl}
  />
);

export default AuthActionEmail;
