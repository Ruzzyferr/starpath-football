// Client address helpers shared by the HTTP layer and the shop rules.

/** Rate-limit / per-address key: IPv4 as is, IPv6 by its /64 (one subscriber's whole prefix). */
export function ipKey(ip) {
  ip = String(ip ?? '?').split('%')[0]
  if (!ip.includes(':')) return ip
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)
  if (v4) return v4[1]
  let groups
  if (ip.includes('::')) {
    const [head, tail] = ip.split('::')
    const h = head ? head.split(':') : []
    const t = tail ? tail.split(':') : []
    groups = [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t]
  } else groups = ip.split(':')
  return `${groups.slice(0, 4).map((g) => (parseInt(g, 16) || 0).toString(16)).join(':')}::/64`
}
