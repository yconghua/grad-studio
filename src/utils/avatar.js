// 头像地址转换
// 存库的头像是本地绝对路径（C:\...\grad-studio\uploads\xxx.png），渲染层页面无法直接
// 以 file:// 加载该资源（dev 模式 http 页面会被 Electron 拦截），统一转为自定义协议
// gradapp://uploads/<文件名> 加载；http(s)/data URL 原样返回，空值返回空串。
export function avatarUrl(p) {
  if (!p) return ''
  if (/^(https?:|data:)/i.test(p)) return p
  const name = String(p).split(/[\\/]/).pop()
  if (!name) return ''
  return `gradapp://uploads/${encodeURIComponent(name)}`
}
