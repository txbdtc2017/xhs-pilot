export interface ParsedSseEvent {
  event: string;
  data: unknown;
}

export function formatSseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createSseParser(onEvent: (event: ParsedSseEvent) => void): {
  push: (chunk: string) => void;
  flush: () => void;
} {
  let buffer = '';

  const consumeBuffer = () => {
    let boundaryIndex = buffer.indexOf('\n\n');

    while (boundaryIndex >= 0) {
      const rawEvent = buffer.slice(0, boundaryIndex);
      buffer = buffer.slice(boundaryIndex + 2);

      const lines = rawEvent.split('\n');
      const eventName = lines.find((line) => line.startsWith('event: '))?.slice(7).trim();
      const dataLine = lines.find((line) => line.startsWith('data: '))?.slice(6);

      if (eventName && dataLine) {
        onEvent({
          event: eventName,
          data: JSON.parse(dataLine),
        });
      }

      boundaryIndex = buffer.indexOf('\n\n');
    }
  };

  return {
    push(chunk) {
      buffer += chunk;
      consumeBuffer();
    },
    flush() {
      consumeBuffer();
    },
  };
}
