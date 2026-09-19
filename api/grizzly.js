export default async function handler(req, res) {
  // تفعيل إعدادات CORS الشاملة للسماح لمتجرك بالتواصل مع السيرفر
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // التعامل مع طلبات التحقق المسبق من المتصفح (Preflight requests)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // ==========================================
  // 1. مسار جلب الصور وتخطي قيود الحظر (Hotlinking / Referrer)
  // ==========================================
  if (req.query.action === 'getImage') {
    const code = req.query.code;
    
    // التحقق من وجود كود الخدمة في الطلب
    if (!code) {
      return res.status(400).send('Missing code parameter');
    }

    // محاولة أولى: سحب أيقونة SVG الرسمية الأصلية من موقع Grizzly
    try {
      const svgRes = await fetch(`https://grizzlysms.com/img/services/${code}.svg`, {
        headers: {
          'Referer': 'https://grizzlysms.com/',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (svgRes.ok) {
        const svgData = await svgRes.arrayBuffer();
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.send(Buffer.from(svgData));
      }
    } catch (e) {
      // الانتقال للمحاولة التالية في حال فشل الطلب
    }

    // محاولة ثانية: سحب الأيقونة بصيغة PNG من مستودع الرموز العام
    try {
      const pngRes = await fetch(`https://img.sms-activate.org/assets/ico/${code}0.png`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (pngRes.ok) {
        const pngData = await pngRes.arrayBuffer();
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.send(Buffer.from(pngData));
      }
    } catch (e) {
      // الانتقال للحل البديل في حال فشل الطلب
    }

    // بديل أخير: توليد أيقونة SVG أنيقة وافتراضية عند غياب صورة المنصة
    const defaultSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    return res.send(defaultSvg);
  }

  // ==========================================
  // 2. توجيه طلبات API تفعيل الأرقام إلى سيرفر Grizzly الرسمي
  // ==========================================
  const GRIZZLY_API_KEY = process.env.GRIZZLY_API_KEY || '205837984918fa408d1ee6ce337bf04e';

  // بناء معلمات الرابط مع دمج مفتاح الـ API
  const queryParams = new URLSearchParams(req.query);
  
  if (!queryParams.has('api_key')) {
    queryParams.append('api_key', GRIZZLY_API_KEY);
  } else {
    queryParams.set('api_key', GRIZZLY_API_KEY);
  }

  const targetUrl = `https://api.grizzlysms.com/stubs/handler_api.php?${queryParams.toString()}`;

  try {
    const apiRes = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const contentType = apiRes.headers.get('content-type') || '';

    // التحقق من نوع الرد وإرجاعه بالشكل المناسب
    if (contentType.includes('application/json')) {
      const data = await apiRes.json();
      return res.status(200).json(data);
    } else {
      const text = await apiRes.text();
      return res.status(200).send(text);
    }
  } catch (error) {
    return res.status(500).json({
      error: 'Proxy request failed',
      details: error.message
    });
  }
}
