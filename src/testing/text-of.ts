export function textOf(element: Element): string {
  const text = element.textContent;
  if (text === null) {
    throw new Error(`<${element.tagName.toLowerCase()}> has no text content to read`);
  }
  return text;
}
