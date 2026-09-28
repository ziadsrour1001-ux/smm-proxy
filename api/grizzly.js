// api/grizzly.js

const GRIZZLY_API =
  "https://api.grizzlysms.com/stubs/handler_api.php";

// المفتاح الخاص بك
const DEFAULT_KEY = "205837984918fa408d1ee6ce337bf04e";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const API_KEY =
    process.env.GRIZZLY_API_KEY || DEFAULT_KEY;

  if (!API_KEY || API_KEY === "YOUR_EXISTING_GRIZZLY_KEY") {
    return res.status(500).json({
      ok: false,
      error: "GRIZZLY_API_KEY_NOT_CONFIGURED"
    });
  }

  try {

    /* =====================================================
       1. SERVICE IMAGE
       ===================================================== */

    if (
      req.method === "GET" &&
      req.query.action === "getImage"
    ) {
      const code =
        (req.query.code || "")
          .toLowerCase()
          .split("_")[0];

      if (!code) {
        return res.status(400).send("Missing code");
      }

      const urls = [
        `https://img.sms-activate.org/assets/ico/${code}0.png`,
        `https://img.sms-activate.org/assets/ico/${code}.png`
      ];

      for (const url of urls) {
        try {
          const response = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0"
            }
          });

          if (response.ok) {
            const buffer =
              await response.arrayBuffer();

            res.setHeader(
              "Content-Type",
              "image/png"
            );

            res.setHeader(
              "Cache-Control",
              "public, max-age=604800, immutable"
            );

            return res.send(
              Buffer.from(buffer)
            );
          }
        } catch (_) {}
      }

      return res.status(404).end();
    }


    /* =====================================================
       2. BUY NUMBER
       ===================================================== */

    if (req.method === "POST") {

      const body = req.body || {};

      const {
        action,
        countryId,
        service,
        providerIds
      } = body;

      if (action === "buy") {

        if (!countryId || !service) {
          return res.status(400).json({
            success: false,
            error: "بيانات الطلب ناقصة"
          });
        }

        const buyParams =
          new URLSearchParams();

        buyParams.set(
          "api_key",
          API_KEY
        );

        buyParams.set(
          "action",
          "getNumberV2"
        );

        buyParams.set(
          "service",
          String(service)
        );

        buyParams.set(
          "country",
          String(countryId)
        );

        if (
          Array.isArray(providerIds) &&
          providerIds.length > 0
        ) {
          buyParams.set(
            "providerIds",
            providerIds
              .map(String)
              .join(",")
          );
        }

        const apiRes =
          await fetch(
            `${GRIZZLY_API}?${buyParams.toString()}`,
            {
              headers: {
                "User-Agent":
                  "Techno-Pro-OTP/1.0",
                "Accept":
                  "application/json,text/plain,*/*"
              }
            }
          );

        const text =
          (await apiRes.text()).trim();


        /* =================================================
           JSON RESPONSE
           ================================================= */

        let jsonResp = null;

        try {
          jsonResp =
            JSON.parse(text);
        } catch (_) {
          jsonResp = null;
        }


        if (jsonResp) {

          /*
           * ندعم جميع الأسماء المحتملة
           */

          const activationId =
            jsonResp.activationId ??
            jsonResp.activationID ??
            jsonResp.activation_id ??
            jsonResp.id ??
            jsonResp.activation ??
            "";

          const phoneNumber =
            jsonResp.phoneNumber ??
            jsonResp.phone ??
            jsonResp.number ??
            jsonResp.phone_number ??
            jsonResp.msisdn ??
            "";


          /*
           * حالة وجود الرقم فعليًا
           */

          if (
            activationId &&
            phoneNumber
          ) {

            return res.status(200).json({
              success: true,

              activationId:
                String(activationId),

              phoneNumber:
                String(phoneNumber),

              canGetAnotherSms:
                jsonResp.canGetAnotherSms === true ||
                jsonResp.canGetAnotherSms === 1 ||
                jsonResp.canGetAnotherSms === "1",

              activationCost:
                jsonResp.activationCost ??
                jsonResp.activation_cost ??
                null,

              countryCode:
                jsonResp.countryCode ??
                jsonResp.country_code ??
                null,

              activationTime:
                jsonResp.activationTime ??
                jsonResp.activation_time ??
                null
            });
          }


          /*
           * بعض الردود قد تكون nested
           */

          const nested =
            jsonResp.data ||
            jsonResp.result ||
            jsonResp.activation ||
            null;

          if (
            nested &&
            typeof nested === "object"
          ) {

            const nestedActivationId =
              nested.activationId ??
              nested.activationID ??
              nested.activation_id ??
              nested.id ??
              activationId ??
              "";

            const nestedPhone =
              nested.phoneNumber ??
              nested.phone ??
              nested.number ??
              nested.phone_number ??
              nested.msisdn ??
              "";

            if (
              nestedActivationId &&
              nestedPhone
            ) {

              return res.status(200).json({
                success: true,

                activationId:
                  String(nestedActivationId),

                phoneNumber:
                  String(nestedPhone),

                canGetAnotherSms:
                  nested.canGetAnotherSms === true ||
                  nested.canGetAnotherSms === 1 ||
                  nested.canGetAnotherSms === "1"
              });
            }
          }


          /*
           * activationId بدون رقم
           *
           * لا نعتبره عملية شراء مكتملة.
           */

          if (activationId) {

            return res.status(200).json({
              success: false,

              queue: false,

              activationId:
                String(activationId),

              phoneNumber: "",

              error:
                "GRIZZLY_RETURNED_ACTIVATION_WITHOUT_PHONE",

              raw: jsonResp
            });
          }
        }


        /* =================================================
           ACCESS_NUMBER
           ================================================= */

        if (
          text.startsWith("ACCESS_NUMBER:")
        ) {

          const parts =
            text.split(":");

          const activationId =
            parts[1] || "";

          const phoneNumber =
            parts[2] || "";

          if (
            activationId &&
            phoneNumber
          ) {

            return res.status(200).json({
              success: true,

              activationId:
                String(activationId),

              phoneNumber:
                String(phoneNumber),

              canGetAnotherSms: true
            });
          }

          return res.status(200).json({
            success: false,
            queue: false,
            error:
              "GRIZZLY_ACCESS_NUMBER_MISSING_PHONE",
            raw: text
          });
        }


        /* =================================================
           KNOWN ERRORS
           ================================================= */

        if (
          text.includes("NO_NUMBERS")
        ) {

          return res.status(200).json({
            success: false,
            queue: true,
            error:
              "في انتظار توفر خط..."
          });
        }


        if (
          text.includes("NO_BALANCE")
        ) {

          return res.status(200).json({
            success: false,
            queue: false,
            error:
              "الرصيد غير كافٍ"
          });
        }


        if (
          text.includes("WRONG_SERVICE")
        ) {

          return res.status(200).json({
            success: false,
            queue: false,
            error:
              "الخدمة غير متاحة"
          });
        }


        /* =================================================
           UNKNOWN RESPONSE
           ================================================= */

        return res.status(200).json({
          success: false,
          queue: false,
          error:
            text ||
            "UNKNOWN_GRIZZLY_RESPONSE",
          raw: text
        });
      }
    }


    /* =====================================================
       QUERY PARAMETERS
       ===================================================== */

    const {
      action,
      id,
      status,
      service,
      country
    } = req.query;


    /* =====================================================
       3. GET STATUS
       ===================================================== */

    if (action === "getStatus") {

      if (
        !id ||
        !/^\d+$/.test(String(id))
      ) {

        return res.status(400).json({
          ok: false,
          error:
            "INVALID_ACTIVATION_ID"
        });
      }

      const url =
        new URL(GRIZZLY_API);

      url.searchParams.set(
        "api_key",
        API_KEY
      );

      url.searchParams.set(
        "action",
        "getStatus"
      );

      url.searchParams.set(
        "id",
        String(id)
      );

      const response =
        await fetch(
          url.toString(),
          {
            headers: {
              "User-Agent":
                "Techno-Pro-OTP/1.0"
            }
          }
        );

      const raw =
        (await response.text()).trim();

      if (!response.ok) {

        return res.status(502).json({
          ok: false,
          error:
            "GRIZZLY_HTTP_ERROR",
          raw
        });
      }


      if (
        raw.startsWith("STATUS_OK:")
      ) {

        const code =
          raw
            .substring(
              "STATUS_OK:".length
            )
            .trim();

        return res.status(200).json({
          ok: true,
          status: "STATUS_OK",
          code,
          raw
        });
      }


      if (
        raw === "STATUS_WAIT_CODE" ||
        raw === "STATUS_WAIT_RETRY" ||
        raw === "STATUS_CANCEL"
      ) {

        return res.status(200).json({
          ok: true,
          status: raw,
          raw
        });
      }


      return res.status(200).json({
        ok: false,
        status: "ERROR",
        error: raw,
        raw
      });
    }


    /* =====================================================
       4. SET STATUS
       ===================================================== */

    if (action === "setStatus") {

      if (
        !id ||
        !/^\d+$/.test(String(id))
      ) {

        return res.status(400).json({
          ok: false,
          error:
            "INVALID_ACTIVATION_ID"
        });
      }

      const allowedStatuses =
        new Set([
          "3",
          "6",
          "8"
        ]);

      if (
        !allowedStatuses.has(
          String(status)
        )
      ) {

        return res.status(400).json({
          ok: false,
          error:
            "INVALID_STATUS",
          allowed: [
            3,
            6,
            8
          ]
        });
      }

      const url =
        new URL(GRIZZLY_API);

      url.searchParams.set(
        "api_key",
        API_KEY
      );

      url.searchParams.set(
        "action",
        "setStatus"
      );

      url.searchParams.set(
        "id",
        String(id)
      );

      url.searchParams.set(
        "status",
        String(status)
      );

      const response =
        await fetch(
          url.toString(),
          {
            headers: {
              "User-Agent":
                "Techno-Pro-OTP/1.0"
            }
          }
        );

      const raw =
        (await response.text()).trim();

      if (!response.ok) {

        return res.status(502).json({
          ok: false,
          error:
            "GRIZZLY_HTTP_ERROR",
          raw
        });
      }


      if (
        raw === "ACCESS_CANCEL" ||
        raw === "ACCESS_ACTIVATION" ||
        raw === "ACCESS_RETRY_GET"
      ) {

        return res.status(200).json({
          ok: true,
          status: raw,
          raw
        });
      }


      if (
        raw === "EARLY_CANCEL_DENIED"
      ) {

        return res.status(409).json({
          ok: false,
          status:
            "EARLY_CANCEL_DENIED",
          error: raw,
          raw
        });
      }


      if (
        raw === "NO_ACTIVATION" ||
        raw === "BAD_STATUS"
      ) {

        return res.status(400).json({
          ok: false,
          status: raw,
          error: raw,
          raw
        });
      }


      return res.status(200).json({
        ok: false,
        status: "ERROR",
        error: raw,
        raw
      });
    }


    /* =====================================================
       5. COUNTRIES
       ===================================================== */

    if (
      action === "getCountries" ||
      action === "countries"
    ) {

      const url =
        new URL(GRIZZLY_API);

      url.searchParams.set(
        "api_key",
        API_KEY
      );

      url.searchParams.set(
        "action",
        "getCountries"
      );

      const response =
        await fetch(
          url.toString()
        );

      const data =
        await response.json();

      return res.status(200).json(
        data
      );
    }


    /* =====================================================
       6. PRICES / PROVIDERS
       ===================================================== */

    if (
      action === "getPrices" ||
      action === "prices"
    ) {

      const url =
        new URL(GRIZZLY_API);

      url.searchParams.set(
        "api_key",
        API_KEY
      );

      url.searchParams.set(
        "action",
        "getPricesV3"
      );

      if (service) {
        url.searchParams.set(
          "service",
          service
        );
      }

      if (country) {
        url.searchParams.set(
          "country",
          country
        );
      }

      const response =
        await fetch(
          url.toString()
        );

      if (!response.ok) {

        const raw =
          await response.text();

        return res.status(502).json({
          ok: false,
          error:
            "GRIZZLY_PRICES_HTTP_ERROR",
          raw
        });
      }

      const data =
        await response.json();

      return res.status(200).json(
        data
      );
    }


    /* =====================================================
       UNKNOWN ACTION
       ===================================================== */

    return res.status(400).json({
      ok: false,
      error:
        "UNKNOWN_ACTION"
    });

  } catch (error) {

    return res.status(500).json({
      ok: false,
      error:
        "PROXY_ERROR",
      message:
        error.message
    });
  }
}
