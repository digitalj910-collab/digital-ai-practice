/** Short unique id for locally-created records. */
export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 8)
  const time = Date.now().toString(36).slice(-4)
  return `${prefix}${prefix ? '_' : ''}${time}${rand}`
}
