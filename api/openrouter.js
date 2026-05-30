export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { prompt, maxTokens = 800, model = 'nvidia/nemotron-3-super-120b-a12b:free' } = req.body;

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'HTTP-Referer': req.headers.referer || req.headers.origin || '',
      'X-Title': 'Wordbook',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return res.status(response.status).json({ error: err.error?.message || `HTTP ${response.status}` });
  }

  const data = await response.json();
  res.json(data);
}
