const BANNED = ['spam', 'scam', 'hate', 'slur1', 'slur2']

export function filterContent(text) {
  if (!text) return text
  let result = text
  BANNED.forEach(word => {
    const re = new RegExp(`\\b${word}\\b`, 'gi')
    result = result.replace(re, '****')
  })
  return result
}

export function containsBannedWord(text) {
  if (!text) return false
  return BANNED.some(word => new RegExp(`\\b${word}\\b`, 'i').test(text))
}
