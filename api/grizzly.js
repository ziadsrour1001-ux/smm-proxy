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

  // 1. مسار جلب الصور والشعارات الحقيقية لكل المنصات
  if (req.query.action === 'getImage') {
    const code = (req.query.code || '').toLowerCase();
    const name = (req.query.name || code).toLowerCase().replace(/[^a-z0-9]/g, '');

    // محاولة جلب الشعار من مستودع الأيقونات المباشر عبر الاسم
    const sources = [
      `https://cdn.simpleicons.org/${name}`,
      `https://img.sms-activate.org/assets/ico/${code}0.png`,
      `https://t2.gstatic.com/faviconV2?client=SOCIAL&type=FAVICON&fallback_opts=TYPE,SIZE,URL&url=http://${name}.com&size=64`
    ];

    for (const url of sources) {
      try {
        const imgRes = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        if (imgRes.ok && imgRes.headers.get('content-type')?.includes('image')) {
          const buffer = await imgRes.arrayBuffer();
          res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/png');
          res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
          return res.send(Buffer.from(buffer));
        }
      } catch (e) {}
    }

    // شعار بديل نظيف باسم الخدمة إذا لم تكن مسجلة
    return res.redirect(`https://ui-avatars.com/api/?name=${encodeURIComponent(req.query.name || code)}&background=0284c7&color=fff&size=64&bold=true&length=2`);
  }

  // 2. توجيه طلبات Grizzly API
  const GRIZZLY_API_KEY = process.env.GRIZZLY_API_KEY || '205837984918fa408d1ee6ce337bf04e';
  const queryParams = new URLSearchParams(req.query);
  queryParams.set('api_key', GRIZZLY_API_KEY);

  const targetUrl = `https://api.grizzlysms.com/stubs/handler_api.php?${queryParams.toString()}`;

  try {
    const apiRes = await fetch(targetUrl);
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

