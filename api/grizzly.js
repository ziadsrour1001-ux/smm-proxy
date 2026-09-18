export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const API_KEY = process.env.GRIZZLY_API_KEY || "205837984918fa408d1ee6ce337bf04e";
  const params = new URLSearchParams(req.query);
  params.set('api_key', API_KEY);

  const targetUrl = `https://api.grizzlysms.com/stubs/handler_api.php?${params.toString()}`;

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml,text/plain,application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    const data = await response.text();
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.status(200).send(data);
  } catch (error) {
    return res.status(500).json({
      error: 'فشل الاتصال بخادم Grizzly الرئيسي',
      details: error.message
    });
  }
}
