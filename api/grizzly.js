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
  const queryParams = new URLSearchParams(req.query);
  queryParams.set('api_key', GRIZZLY_API_KEY);

  // إذا كان الطلب getPrices، نضيف freePrice=true لجلب تفاصيل كل مشغل وكميته الفردية
  if (req.query.action === 'getPrices') {
    queryParams.set('freePrice', 'true');
  }

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
