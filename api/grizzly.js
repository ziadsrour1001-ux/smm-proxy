export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.GRIZZLY_API_KEY || "205837984918fa408d1ee6ce337bf04e";
  const { action, service, country, id } = req.query;

  let targetUrl = `https://api.grizzlysms.com/stubs/handler_api.php?api_key=${API_KEY}&action=${action}`;
  if (service) targetUrl += `&service=${service}`;
  if (country) targetUrl += `&country=${country}`;
  if (id) targetUrl += `&id=${id}`;

  try {
    const response = await fetch(targetUrl);
    const data = await response.text();
    return res.status(200).send(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
