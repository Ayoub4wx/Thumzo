import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components';
import * as React from 'react';

interface MarketingEmailProps {
  appUrl?: string;
  unsubscribeUrl?: string | null;
}

export const PowerUserEmail = ({ appUrl = 'https://www.thumoraai.com', unsubscribeUrl }: MarketingEmailProps) => (
  <Html>
    <Head />
    <Preview>Power user tips and pricing</Preview>
    <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Arial, sans-serif', margin: 0 }}>
      <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', maxWidth: 560, padding: 32 }}>
        <Heading style={{ color: '#111111', fontSize: 24, lineHeight: '32px', margin: '0 0 16px' }}>
          Build a faster thumbnail workflow
        </Heading>
        <Text style={{ color: '#333333', fontSize: 16, lineHeight: '24px', margin: '0 0 14px' }}>
          Save the strongest drafts, compare concepts side by side, and reuse the visual direction that earns clicks for your channel.
        </Text>
        <Text style={{ color: '#333333', fontSize: 16, lineHeight: '24px', margin: '0 0 24px' }}>
          When you need more generation room, choose the plan that matches your publishing pace.
        </Text>
        <Button
          href={`${appUrl.replace(/\/$/, '')}/pricing`}
          style={{ backgroundColor: '#111111', borderRadius: 6, color: '#ffffff', fontSize: 15, fontWeight: 700, padding: '12px 18px', textDecoration: 'none' }}
        >
          View Plans
        </Button>
        {unsubscribeUrl ? (
          <>
            <Hr style={{ borderColor: '#eeeeee', margin: '28px 0 16px' }} />
            <Text style={{ color: '#777777', fontSize: 12, lineHeight: '18px' }}>
              No longer want these tips? <Link href={unsubscribeUrl}>Unsubscribe</Link>.
            </Text>
          </>
        ) : null}
      </Container>
    </Body>
  </Html>
);

export default PowerUserEmail;
