
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // سحب الشعار الأصلي الحقيقي للخدمة بناءً على كود المنصة فقط
  if (req.query.action === 'getImage') {
    const code = (req.query.code || '').toLowerCase().split('_')[0];
    if (!code) return res.status(400).send('Missing code');

    const iconUrls = [
      `https://img.sms-activate.org/assets/ico/${code}0.png`,
      `https://img.sms-activate.org/assets/ico/${code}1.png`,
      `https://img.sms-activate.org/assets/ico/${code}.png`
    ];

    for (const url of iconUrls) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          return res.send(Buffer.from(buffer));
        }
      } catch (e) {}
    }

    // إذا لم تكن الخدمة تملك أيقونة مخصصة في المستودع
    return res.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(req.query.name || code)}&background=0284c7&color=fff&size=64&bold=true&length=2`);
  }

  // توجيه طلبات Grizzly API بالمفتاح
  const GRIZZLY_API_KEY = process.env.GRIZZLY_API_KEY || '205837984918fa408d1ee6ce337bf04e';
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
