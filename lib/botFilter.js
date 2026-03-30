// ボットフィルタリング
const BOT_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /slurp/i, /mediapartners/i,
  /Googlebot/i, /bingbot/i, /Baiduspider/i, /YandexBot/i,
  /DuckDuckBot/i, /Sogou/i, /ia_archiver/i, /facebookexternalhit/i,
  /Twitterbot/i, /LinkedInBot/i, /WhatsApp/i, /Slackbot/i,
  /TelegramBot/i, /Discordbot/i, /Pinterest/i, /Applebot/i,
  /AhrefsBot/i, /SemrushBot/i, /MJ12bot/i, /DotBot/i,
  /Screaming Frog/i, /GTmetrix/i, /Lighthouse/i, /Chrome-Lighthouse/i,
  /HeadlessChrome/i, /PhantomJS/i, /Selenium/i, /puppeteer/i,
  /prerender/i, /Prerender/i, /Netlify/i,
  /curl/i, /wget/i, /httpie/i, /python-requests/i, /axios/i,
  /node-fetch/i, /Go-http-client/i, /Java\//i, /okhttp/i,
  /UptimeRobot/i, /Pingdom/i, /StatusCake/i, /Site24x7/i,
];

export function isBot(userAgent) {
  if (!userAgent) return true;
  return BOT_PATTERNS.some(pattern => pattern.test(userAgent));
}
