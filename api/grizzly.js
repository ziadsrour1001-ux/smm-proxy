export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const GRIZZLY_API_KEY = '205837984918fa408d1ee6ce337bf04e';
  const action = req.query.action;

  // 1. مسار الصور
  if (action === 'getImage') {
    const code = (req.query.code || '').toLowerCase().split('_')[0];
    if (!code) return res.status(400).send('Missing code');
    const urls = [
      `https://img.sms-activate.org/assets/ico/${code}0.png`,
      `https://img.sms-activate.org/assets/ico/${code}.png`
    ];
    for (const url of urls) {
      try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          return res.send(Buffer.from(buffer));
        }
      } catch (e) {}
    }
    return res.status(404).end();
  }

  // 2. جلب مصفوفة المزودين والأسعار الحقيقية من واجهة جريزلي v2
  if (action === 'getPrices') {
    const service = req.query.service || 'wa';
    try {
      const v2Res = await fetch(`https://grizzlysms.com/api/v2/prices?service=${service}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://grizzlysms.com/'
        }
      });
      if (v2Res.ok) {
        const v2Data = await v2Res.json();
        return res.status(200).json(v2Data);
      }
    } catch (e) {}

    // بديل احتياطي مع معلمة freePrice الرسمية
    try {
      const fallbackRes = await fetch(`https://api.grizzlysms.com/stubs/handler_api.php?api_key=${GRIZZLY_API_KEY}&action=getPrices&service=${service}&freePrice=true`);
      const fallbackData = await fallbackRes.json();
      return res.status(200).json(fallbackData);
    } catch (err) {
      return res.status(500).json({ error: 'Failed to fetch prices', details: err.message });
    }
  }

  // 3. طلبات شراء الأرقام وفحص الحالة
  const queryParams = new URLSearchParams(req.query);
  queryParams.set('api_key', GRIZZLY_API_KEY);

  try {
    const apiRes = await fetch(`https://api.grizzlysms.com/stubs/handler_api.php?${queryParams.toString()}`);
    const contentType = apiRes.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await apiRes.json();
      return res.status(200).json(data);
    } else {
      const text = await apiRes.text();
      return res.status(200).send(text);
    }
  } catch (error) {
    return res.status(500).json({ error: 'Proxy request failed', details: error.message });
  }
}
