export function sanitizeText(text: string, maxLength: number): string {
  return text.trim().slice(0, maxLength);
}

export function sanitizeMessageInput(input: {
  from: string;
  to: string;
  content: string;
  email?: string;
}) {
  return {
    from: sanitizeText(input.from, 25),
    to: sanitizeText(input.to, 25),
    content: sanitizeText(input.content, 500),
    email: input.email ? sanitizeText(input.email, 30) : undefined,
  };
}
