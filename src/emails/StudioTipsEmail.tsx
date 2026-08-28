import { Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Text } from '@react-email/components';
import * as React from 'react';

interface MarketingEmailProps {
  appUrl?: string;
  unsubscribeUrl?: string | null;
}

export const StudioTipsEmail = ({ appUrl = 'https://www.thumoraai.com', unsubscribeUrl }: MarketingEmailProps) => (
  <Html>
    <Head />
    <Preview>Master the Studio</Preview>
    <Body style={{ backgroundColor: '#f6f7f9', fontFamily: 'Arial, sans-serif', margin: 0 }}>
      <Container style={{ backgroundColor: '#ffffff', margin: '32px auto', maxWidth: 560, padding: 32 }}>
        <Heading style={{ color: '#111111', fontSize: 24, lineHeight: '32px', margin: '0 0 16px' }}>
          Polish one winning concept
        </Heading>
        <Text style={{ color: '#333333', fontSize: 16, lineHeight: '24px', margin: '0 0 14px' }}>
          Once you have a strong direction, use the studio to tighten the subject crop, improve contrast, and test alternate layouts.
        </Text>
        <Text style={{ color: '#333333', fontSize: 16, lineHeight: '24px', margin: '0 0 24px' }}>
          Keep the thumbnail readable at small sizes. If the idea only works when zoomed in, simplify it.
        </Text>
        <Button
          href={`${appUrl.replace(/\/$/, '')}/projects`}
          style={{ backgroundColor: '#111111', borderRadius: 6, color: '#ffffff', fontSize: 15, fontWeight: 700, padding: '12px 18px', textDecoration: 'none' }}
        >
          Open My Projects
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

export default StudioTipsEmail;
