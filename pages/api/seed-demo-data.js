import { getServiceSupabase } from '../../lib/supabase';

const SITE_ID = 'default';

// UTM sources for realistic data
const UTM_SOURCES = ['t.co', 'ig', 'facebook.com', 'direct', 'google.com', 'reddit.com', 'linkedin.com'];
const UTM_MEDIUMS = ['social', 'organic', 'referral', 'cpc', 'direct', 'email'];
const UTM_CAMPAIGNS = ['summer_sale', 'launch_v2', 'brand_awareness', 'retargeting', 'influencer'];
const UTM_TERMS = ['product launch', 'discount', 'limited offer', 'exclusive'];
const UTM_CONTENTS = ['ad_001', 'banner_v2', 'story_post', 'email_blast'];

const EVENTS = [
  'scroll_10_percent',
  'scroll_to_bottom',
  'LINE登録',
  'お問い合わせ',
  'purchase',
  'add_to_cart',
  'view_product',
];

const REFERRERS = [
  'https://google.com',
  'https://twitter.com',
  'https://facebook.com',
  'https://instagram.com',
  'https://reddit.com',
];

const LANDING_PAGES = [
  '/products',
  '/pricing',
  '/blog/intro',
  '/features',
  '/',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15',
  'Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36',
];

const DEVICES = ['desktop', 'mobile', 'tablet'];
const BROWSERS = ['Chrome', 'Safari', 'Firefox', 'Edge'];
const OPERATINGSYSTEMS = ['Windows', 'macOS', 'iOS', 'Android'];

function generateVisitorId() {
  return 'visitor_' + Math.random().toString(36).substr(2, 9);
}

function generateSessionId() {
  return 'session_' + Math.random().toString(36).substr(2, 12);
}

function randomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomDate(daysAgo = 30) {
  const now = new Date();
  const days = Math.floor(Math.random() * daysAgo);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  const seconds = Math.floor(Math.random() * 60);

  const date = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  date.setHours(hours, minutes, seconds);
  return date.toISOString();
}

function getRandomIp() {
  return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Security: Only allow from localhost or with a secret token
  const secret = req.headers['x-seed-secret'];
  const isLocalhost = req.headers.host?.startsWith('localhost') || req.headers.host?.startsWith('127.0.0.1');
  if (!isLocalhost && secret !== 'demo-seed-secret-12345') {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    const db = getServiceSupabase();

    console.log('Clearing existing data...');
    await db.from('events').delete().eq('site_id', SITE_ID);
    await db.from('pageviews').delete().eq('site_id', SITE_ID);
    await db.from('sessions').delete().eq('site_id', SITE_ID);

    const sessions = [];
    const pageviews = [];
    const events = [];

    // Generate 300 sessions over the last 30 days
    for (let i = 0; i < 300; i++) {
      const visitorId = generateVisitorId();
      const sessionId = generateSessionId();
      const startedAt = getRandomDate(30);
      const startDate = new Date(startedAt);

      // Random session properties
      const source = Math.random() > 0.15 ? randomElement(UTM_SOURCES) : null;
      const medium = source ? randomElement(UTM_MEDIUMS) : null;
      const campaign = Math.random() > 0.4 ? randomElement(UTM_CAMPAIGNS) : null;
      const term = Math.random() > 0.6 ? randomElement(UTM_TERMS) : null;
      const content = Math.random() > 0.5 ? randomElement(UTM_CONTENTS) : null;

      const isBounce = Math.random() > 0.7;
      const pageCount = isBounce ? 1 : Math.floor(Math.random() * 5) + 1;
      const durationSeconds = isBounce ? Math.floor(Math.random() * 30) : Math.floor(Math.random() * 600) + 30;

      const lastActivityAt = new Date(startDate.getTime() + durationSeconds * 1000).toISOString();

      sessions.push({
        session_id: sessionId,
        visitor_id: visitorId,
        site_id: SITE_ID,
        utm_source: source,
        utm_medium: medium,
        utm_campaign: campaign,
        utm_term: term,
        utm_content: content,
        referrer: Math.random() > 0.5 ? randomElement(REFERRERS) : null,
        landing_page: randomElement(LANDING_PAGES),
        user_agent: randomElement(USER_AGENTS),
        ip_address: getRandomIp(),
        device_type: randomElement(DEVICES),
        browser: randomElement(BROWSERS),
        os: randomElement(OPERATINGSYSTEMS),
        is_bounce: isBounce,
        page_count: pageCount,
        duration_seconds: durationSeconds,
        started_at: startedAt,
        last_activity_at: lastActivityAt,
      });

      // Generate pageviews
      for (let j = 0; j < pageCount; j++) {
        const viewedAt = new Date(startDate.getTime() + j * Math.floor(durationSeconds / pageCount) * 1000).toISOString();
        pageviews.push({
          session_id: sessionId,
          visitor_id: visitorId,
          site_id: SITE_ID,
          page_url: randomElement(LANDING_PAGES),
          page_title: 'Page Title ' + Math.floor(Math.random() * 10),
          referrer: j === 0 ? randomElement(REFERRERS) : randomElement(LANDING_PAGES),
          viewed_at: viewedAt,
        });
      }

      // Generate events (CV) - about 30% of sessions have events
      if (Math.random() > 0.7) {
        const eventCount = Math.floor(Math.random() * 3) + 1;
        for (let j = 0; j < eventCount; j++) {
          const eventName = randomElement(EVENTS);
          const eventTime = new Date(startDate.getTime() + Math.random() * durationSeconds * 1000).toISOString();

          events.push({
            session_id: sessionId,
            visitor_id: visitorId,
            site_id: SITE_ID,
            event_name: eventName,
            event_category: 'engagement',
            event_label: 'label_' + Math.floor(Math.random() * 5),
            event_value: Math.floor(Math.random() * 100),
            page_url: randomElement(LANDING_PAGES),
            metadata: JSON.stringify({ source: 'demo', version: '1.0' }),
            occurred_at: eventTime,
          });
        }
      }
    }

    // Insert in batches to avoid hitting limits
    const BATCH_SIZE = 100;

    console.log(`Inserting ${sessions.length} sessions...`);
    for (let i = 0; i < sessions.length; i += BATCH_SIZE) {
      const batch = sessions.slice(i, i + BATCH_SIZE);
      const { error } = await db.from('sessions').insert(batch);
      if (error) throw error;
    }

    console.log(`Inserting ${pageviews.length} pageviews...`);
    for (let i = 0; i < pageviews.length; i += BATCH_SIZE) {
      const batch = pageviews.slice(i, i + BATCH_SIZE);
      const { error } = await db.from('pageviews').insert(batch);
      if (error) throw error;
    }

    console.log(`Inserting ${events.length} events...`);
    for (let i = 0; i < events.length; i += BATCH_SIZE) {
      const batch = events.slice(i, i + BATCH_SIZE);
      const { error } = await db.from('events').insert(batch);
      if (error) throw error;
    }

    return res.json({
      success: true,
      message: 'Demo data seeded successfully',
      summary: {
        sessions: sessions.length,
        pageviews: pageviews.length,
        events: events.length,
      },
    });
  } catch (error) {
    console.error('Error seeding data:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
