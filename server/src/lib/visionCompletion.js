/** Partial OCR must never become a complete laboratory result. */
export function assertVisionCompletion(response, provider) {
  const reason = provider === 'anthropic' ? response?.stop_reason : response?.choices?.[0]?.finish_reason;
  const refusal = provider === 'anthropic' ? response?.content?.some(block => block.type === 'refusal') : response?.choices?.[0]?.message?.refusal;
  if (refusal || ['length', 'max_tokens', 'content_filter', 'refusal', 'tool_calls', 'tool_use', 'pause_turn'].includes(reason)) {
    throw new Error('Vision response was incomplete or declined.');
  }
}
