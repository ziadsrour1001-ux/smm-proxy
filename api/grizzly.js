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

  // 1. مسار جلب الصور النظيف
  if (req.query.action === 'getImage') {
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

    return res.redirect('https://api.iconify.design/solar:smartphone-bold-duotone.svg?color=%2338bdf8');
  }

  const GRIZZLY_API_KEY = '205837984918fa408d1ee6ce337bf04e';
  const action = req.query.action;

  // 2. معالجة طلب الأسعار والمشغلين الحقيقيين لكل خدمة
  if (action === 'getPrices') {
    const service = req.query.service;
    const country = req.query.country;

    // محاولة جلب الخطوط والمشغلين المفصلين من الـ v2 API أولاً
    try {
      let v2Url = `https://api.grizzlysms.com/api/v2/prices?api_key=${GRIZZLY_API_KEY}`;
      if (service) v2Url += `&service=${service}`;
      if (country) v2Url += `&country=${country}`;

      const v2Res = await fetch(v2Url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json'
        }
      });

      if (v2Res.ok) {
        const v2Data = await v2Res.json();
        if (v2Data && Object.keys(v2Data).length > 0) {
          return res.status(200).json(v2Data);
        }
      }
    } catch (e) {}

    // في حال عدم توفر v2، طلب الأسعار مع تفعيل تفاصيل الخطوط الحرة freePrice
    try {
      let handlerUrl = `https://api.grizzlysms.com/stubs/handler_api.php?api_key=${GRIZZLY_API_KEY}&action=getPrices&freePrice=true`;
      if (service) handlerUrl += `&service=${service}`;
      if (country) handlerUrl += `&country=${country}`;

      const apiRes = await fetch(handlerUrl);
      const data = await apiRes.json();
      return res.status(200).json(data);
    } catch (error) {
      return res.status(500).json({ error: 'Failed to fetch prices', details: error.message });
    }
  }

  // 3. توجيه باقي العمليات العادية (getNumber, getStatus, إلخ)
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
