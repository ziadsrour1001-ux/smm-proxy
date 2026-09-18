export default async function handler(req, res) {
  // تفعيل الـ CORS الكامل للاتصال المباشر من المتجر
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  // مفتاح الـ API الخاص بك في Grizzly
  const API_KEY = process.env.GRIZZLY_API_KEY || "ضع_مفتاح_GRIZZLY_الخاص_بك_هنا";
  const { action = "getPrices", ...params } = req.query;

  // إعداد مسار الاتصال المباشر بخوادم Grizzly SMS
  const queryParams = new URLSearchParams({
    api_key: API_KEY,
    action: action,
    ...params
  });

  const targetUrl = `https://api.grizzlysms.com/stubs/handler_api.php?${queryParams.toString()}`;

  try {
    const upstreamRes = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });

    const responseText = await upstreamRes.text();

    // إرجاع النتيجة كـ JSON إذا كانت قائمة أسعار أو خدمات، أو كنص عادي لحالات الحجز والأكواد
    try {
      const parsedJson = JSON.parse(responseText);
      return res.status(200).json(parsedJson);
    } catch {
      return res.status(200).send(responseText);
    }
  } catch (error) {
    return res.status(500).json({
      error: "فشل الاتصال بخادم Grizzly الرئيسي",
      details: error.message
    });
  }
}
