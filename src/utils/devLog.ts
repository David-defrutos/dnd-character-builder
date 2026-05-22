export function devLog(tag: string, ...args: unknown[]): void {
  try {
    const msg = args.map(a =>
      a === null ? 'null' : a === undefined ? 'undef'
      : typeof a === 'object' ? JSON.stringify(a) : String(a)
    ).join(' ')
    const line = `${new Date().toLocaleTimeString('es-ES',{hour12:false})} ${tag} ${msg}`
    console.log(line)
    const raw = localStorage.getItem('__devlog') ?? '[]'
    const arr: string[] = JSON.parse(raw)
    arr.push(line)
    if (arr.length > 500) arr.splice(0, arr.length - 500)
    localStorage.setItem('__devlog', JSON.stringify(arr))
  } catch(e) {
    console.error('devLog failed:', e)
  }
}
