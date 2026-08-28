import { Body, Button, Container, Head, Heading, Html, Preview, Text } from '@react-email/components';
import * as React from 'react';

interface WelcomeEmailProps {
  name: string;
  appUrl?: string;
}

export const WelcomeEmail = ({ name, appUrl = 'https://www.thumoraai.com' }: WelcomeEmailProps) => (
  <Html>
    <Head />
    <Preview>Welcome to Thumora AI</Preview>
    <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Arial, sans-serif', margin: 0 }}>
      <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', maxWidth: 560, padding: 32 }}>
        <Heading style={{ color: '#111111', fontSize: 24, lineHeight: '32px', margin: '0 0 16px' }}>
          Welcome, {name}!
        </Heading>
        <Text style={{ color: '#333333', fontSize: 16, lineHeight: '24px', margin: '0 0 16px' }}>
          Your Thumora AI workspace is ready. Start with one thumbnail idea, upload a reference, or open the studio and build from a blank canvas.
        </Text>
        <Button
          href={`${appUrl.replace(/\/$/, '')}/studio`}
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
          Open Studio
        </Button>
        <Text style={{ color: '#666666', fontSize: 13, lineHeight: '20px', margin: '24px 0 0' }}>
          This email confirms your Thumora AI account was created.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default WelcomeEmail;
