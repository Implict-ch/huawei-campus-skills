export function writePlainSse(res, text, extra = {}) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.status(200);
  res.write(`data: ${JSON.stringify({ chunk: text, done: false })}\n\n`);
  res.write(`data: ${JSON.stringify({ done: true, retrieved: [], ...extra })}\n\n`);
  res.end();
}

export function writeOffTopicSse(res, text) {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.status(200);
  res.write(`data: ${JSON.stringify({ chunk: text, done: false })}\n\n`);
  res.write(`data: ${JSON.stringify({ done: true, retrieved: [], offTopic: true })}\n\n`);
  res.end();
}
