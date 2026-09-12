export function consumeSseBuffer(buffer) {
  const events = [];
  let rest = String(buffer ?? '').replace(/\r\n/g, '\n');
  while (true) {
    const idx = rest.indexOf('\n\n');
    if (idx < 0) break;
    const block = rest.slice(0, idx);
    rest = rest.slice(idx + 2);
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).replace(/^\s/, ''))
      .join('\n');
    if (!data) continue;
    try {
      events.push(JSON.parse(data));
    } catch {
      // ignore keep-alives / partial JSON
    }
  }
  return { events, rest };
}
