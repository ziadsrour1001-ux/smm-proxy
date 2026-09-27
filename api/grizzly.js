// api/grizzly.js

const GRIZZLY_API = "https://api.grizzlysms.com/stubs/handler_api.php";
const DEFAULT_KEY = "205837984918fa408d1ee6ce337bf04e";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const API_KEY = process.env.GRIZZLY_API_KEY || DEFAULT_KEY;

  try {
    // 1. مسار جلب الصور وتخطي الحظر
    if (req.method === "GET" && req.query.action === "getImage") {
      const code = (req.query.code || "").toLowerCase().split("_")[0];
      if (!code) return res.status(400).send("Missing code");

      const urls = [
        `https://img.sms-activate.org/assets/ico/${code}0.png`,
        `https://img.sms-activate.org/assets/ico/${code}.png`
      ];

      for (const url of urls) {
        try {
          const response = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            res.setHeader("Content-Type", "image/png");
            res.setHeader("Cache-Control", "public, max-age=604800, immutable");
            return res.send(Buffer.from(buffer));
          }
        } catch (e) {}
      }
      return res.status(404).end();
    }

    // 2. مسار الشراء المباشر والآمن عبر getNumberV2
    if (req.method === "POST") {
      const { action, countryId, service, providerIds } = req.body || {};

      if (action === "buy") {
        if (!countryId || !service) {
          return res.status(400).json({ success: false, error: "بيانات الطلب ناقصة" });
        }

        const buyParams = new URLSearchParams({
          api_key: API_KEY,
          action: "getNumberV2",
          service: service,
          country: String(countryId)
        });

        if (Array.isArray(providerIds) && providerIds.length > 0) {
          buyParams.set("providerIds", providerIds.join(","));
        }

        const apiRes = await fetch(`${GRIZZLY_API}?${buyParams.toString()}`);
        const text = (await apiRes.text()).trim();

        if (text.includes("ACCESS_NUMBER")) {
          const parts = text.split(":");
          return res.status(200).json({
            success: true,
            activationId: parts[1],
            phoneNumber: parts[2],
            canGetAnotherSms: true
          });
        }

        if (text.includes("NO_NUMBERS") || text.includes("NO_BALANCE") || text.includes("WRONG_SERVICE")) {
          return res.status(200).json({
            success: false,
            queue: true,
            error: "في انتظار توفر خط..."
          });
        }

        try {
          const jsonResp = JSON.parse(text);
          if (jsonResp.phone || jsonResp.activationId) {
            return res.status(200).json({
              success: true,
              activationId: jsonResp.activationId || jsonResp.id,
              phoneNumber: jsonResp.phone,
              canGetAnotherSms: Boolean(jsonResp.canGetAnotherSms)
            });
          }
        } catch (e) {}

        return res.status(200).json({ success: false, queue: true, error: text });
      }
    }

    const { action, id, status, service, country } = req.query;

    // 3. مسار الاستعلام عن وصول كود SMS (getStatus)
    if (action === "getStatus") {
      if (!id || !/^\d+$/.test(String(id))) {
        return res.status(400).json({ ok: false, error: "INVALID_ACTIVATION_ID" });
      }

      const url = new URL(GRIZZLY_API);
      url.searchParams.set("api_key", API_KEY);
      url.searchParams.set("action", "getStatus");
      url.searchParams.set("id", String(id));

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": "Techno-Pro-OTP/1.0" }
      });
      const raw = (await response.text()).trim();

      if (!response.ok) {
        return res.status(502).json({ ok: false, error: "GRIZZLY_HTTP_ERROR", raw });
      }

      if (raw.startsWith("STATUS_OK:")) {
        const code = raw.substring("STATUS_OK:".length).trim();
        return res.status(200).json({ ok: true, status: "STATUS_OK", code, raw });
      }

      if (raw === "STATUS_WAIT_CODE" || raw === "STATUS_WAIT_RETRY" || raw === "STATUS_CANCEL") {
        return res.status(200).json({ ok: true, status: raw, raw });
      }

      return res.status(200).json({ ok: false, status: "ERROR", error: raw, raw });
    }

    // 4. مسار تعديل حالة الرقم (setStatus: 3=كود ثانٍ، 6=إنهاء، 8=إلغاء واسترداد)
    if (action === "setStatus") {
      if (!id || !/^\d+$/.test(String(id))) {
        return res.status(400).json({ ok: false, error: "INVALID_ACTIVATION_ID" });
      }

      const allowedStatuses = new Set(["3", "6", "8"]);
      if (!allowedStatuses.has(String(status))) {
        return res.status(400).json({ ok: false, error: "INVALID_STATUS", allowed: [3, 6, 8] });
      }

      const url = new URL(GRIZZLY_API);
      url.searchParams.set("api_key", API_KEY);
      url.searchParams.set("action", "setStatus");
      url.searchParams.set("id", String(id));
      url.searchParams.set("status", String(status));

      const response = await fetch(url.toString(), {
        headers: { "User-Agent": "Techno-Pro-OTP/1.0" }
      });
      const raw = (await response.text()).trim();

      if (!response.ok) {
        return res.status(502).json({ ok: false, error: "GRIZZLY_HTTP_ERROR", raw });
      }

      if (raw === "ACCESS_CANCEL" || raw === "ACCESS_ACTIVATION" || raw === "ACCESS_RETRY_GET") {
        return res.status(200).json({ ok: true, status: raw, raw });
      }

      if (raw === "EARLY_CANCEL_DENIED") {
        return res.status(409).json({ ok: false, status: "EARLY_CANCEL_DENIED", error: raw, raw });
      }

      if (raw === "NO_ACTIVATION" || raw === "BAD_STATUS") {
        return res.status(400).json({ ok: false, status: raw, error: raw, raw });
      }

      return res.status(200).json({ ok: false, status: "ERROR", error: raw, raw });
    }

    // 5. مسار قائمة الدول (getCountries)
    if (action === "getCountries" || action === "countries") {
      const url = new URL(GRIZZLY_API);
      url.searchParams.set("api_key", API_KEY);
      url.searchParams.set("action", "getCountries");

      const response = await fetch(url.toString());
      const data = await response.json();
      return res.status(200).json(data);
    }

    // 6. مسار الأسعار والمشغلين الشامل (getPricesV3)
    if (action === "getPrices" || action === "prices") {
      const url = new URL(GRIZZLY_API);
      url.searchParams.set("api_key", API_KEY);
      url.searchParams.set("action", "getPricesV3");
      if (service) url.searchParams.set("service", service);
      if (country) url.searchParams.set("country", country);

      const response = await fetch(url.toString());
      const data = await response.json();
      return res.status(200).json(data);
    }

    return res.status(400).json({ ok: false, error: "UNKNOWN_ACTION" });
  } catch (error) {
    return res.status(500).json({ ok: false, error: "PROXY_ERROR", message: error.message });
  }
}
