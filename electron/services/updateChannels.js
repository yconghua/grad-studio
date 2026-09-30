/**
 * 更新通道配置与可达性探测 —— 纯 Node 实现(不依赖 electron),便于独立测试与复用。
 *
 * 通道优先级即数组顺序:先官方源(GitHub),后镜像源(generic provider)。
 * 镜像源为 generic provider:electron-updater 以镜像 URL 为基址拼接 latest.yml / 安装包 / blockmap 下载,
 * 镜像只需与 GitHub Release 资产同名平铺(latest.yml、Setup 安装包、.blockmap),无需改动 yml 内容。
 * 公共加速镜像只是传输通道:electron-updater 会用 latest.yml 中的 sha512 校验安装包完整性,包被篡改会直接失败。
 *
 * 以后换自建服务器 / OSS 等正式镜像:只需替换 MIRROR_BASES 里的地址(保持以 / 结尾),
 * 其余逻辑零改动。通道可增可减,数量不限。
 */
const http = require('node:http')
const https = require('node:https')

// 发布信息来自 package.json build.publish(GitHub 仓库),与打包时生成的 app-update.yml 同源
const appPkg = require('../../package.json')
const PUBLISH = (appPkg.build && appPkg.build.publish) || {}
const OWNER = PUBLISH.owner
const REPO = PUBLISH.repo

// ===== 镜像地址唯一配置点:公共加速镜像(过渡期),按优先级排列 =====
// 实测可用:gh-proxy.com(主)、ghproxy.net(备);ghproxy.cc / mirror.ghproxy.com 当前不可用。
// 后续换自建/OSS 镜像:把这里替换为如 'https://update.example.com/grad-studio/win/' 即可。
const MIRROR_BASES = [
  'https://gh-proxy.com/https://github.com/{OWNER}/{REPO}/releases/latest/download/',
  'https://ghproxy.net/https://github.com/{OWNER}/{REPO}/releases/latest/download/'
].map((tpl) => tpl.replace('{OWNER}', OWNER).replace('{REPO}', REPO))

// 通道清单。probeUrl 走 releases/latest/download 静态重定向地址(不经过 GitHub API,绕开未认证 60 次/时/IP 限流)
const CHANNELS = [
  {
    key: 'github',
    label: '官方源(GitHub)',
    feed: { provider: 'github', owner: OWNER, repo: REPO },
    probeUrl: `https://github.com/${OWNER}/${REPO}/releases/latest/download/latest.yml`
  },
  ...MIRROR_BASES.map((base, i) => ({
    key: `mirror-${i + 1}`,
    label: MIRROR_BASES.length > 1 ? `国内镜像源${i + 1}` : '国内镜像源',
    feed: { provider: 'generic', url: base },
    probeUrl: `${base}latest.yml`
  }))
]

// 探测超时(毫秒):不可达的源不能拖慢整体检查
const PROBE_TIMEOUT_MS = 5000

// 探测单个 URL:只要在超时内拿到 HTTP 响应即算通道可达(4xx 也算可达——服务器在、只是暂无版本,
// 版本缺失交给 electron-updater 报错并由 classifyError 分类提示)
function probeUrl(url, timeoutMs = PROBE_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch (err) {
      resolve({ ok: false, code: 'BAD_URL', message: err.message })
      return
    }
    const lib = parsed.protocol === 'https:' ? https : http
    const req = lib.get(
      parsed,
      { timeout: timeoutMs, headers: { 'user-agent': 'grad-studio-updater-probe', accept: '*/*' } },
      (res) => {
        res.resume() // 丢弃响应体,只关心可达性
        resolve({ ok: res.statusCode < 500, statusCode: res.statusCode })
      }
    )
    req.on('timeout', () => {
      req.destroy(new Error('probe timeout'))
    })
    req.on('error', (err) => {
      resolve({ ok: false, code: (err && err.code) || 'ERROR', message: (err && err.message) || String(err) })
    })
  })
}

// 并行探测全部通道(整体耗时≈单通道超时),按配置优先级返回可达通道列表
async function probeChannels(timeoutMs = PROBE_TIMEOUT_MS) {
  const results = await Promise.all(
    CHANNELS.map(async (channel) => ({
      channel,
      probe: await probeUrl(channel.probeUrl, timeoutMs)
    }))
  )
  return {
    reachable: results.filter((r) => r.probe.ok).map((r) => r.channel),
    report: results
  }
}

// 外部链接白名单:GitHub 域名 + 全部已配置镜像域名(供 sys:open-external 使用,仍拒绝任意其他链接)
function isAllowedExternalUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch (err) {
    return false
  }
  if (parsed.protocol !== 'https:') return false
  const allowedHosts = ['github.com']
  for (const channel of CHANNELS) {
    if (channel.feed && channel.feed.url) {
      try {
        allowedHosts.push(new URL(channel.feed.url).hostname)
      } catch (err) {
        // 配置错误时忽略该通道
      }
    }
  }
  return allowedHosts.includes(parsed.hostname)
}

// 把 electron-updater 的原始英文错误分类为中文提示(错误文案随版本变化,采用关键词匹配)
function classifyError(err) {
  const raw = String((err && err.message) || err || '未知错误')
  if (/ERR_NAME_NOT_RESOLVED|ERR_CONNECTION_REFUSED|ERR_CONNECTION_RESET|ERR_CONNECTION_TIMED_OUT|ERR_NETWORK|ERR_INTERNET_DISCONNECTED|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|socket hang up|connect ETIMEDOUT/i.test(raw)) {
    return { code: 'network', message: '网络连接失败,无法访问更新服务器,请检查网络后重试' }
  }
  if (/certificate|UNABLE_TO_VERIFY_LEAF|self-signed|ERR_TLS_CERT|CERT_/i.test(raw)) {
    return { code: 'tls', message: '更新服务器证书校验失败,已中止(可能存在网络劫持),请检查系统时间或网络环境' }
  }
  if (/sha512|checksum|hash.*mismatch|integrity/i.test(raw)) {
    return { code: 'checksum', message: '更新包完整性校验未通过,已中止安装,请重试或到下载页手动更新' }
  }
  if (/cannot find latest|latest\.yml|not found|no published|404/i.test(raw)) {
    return { code: 'no-release', message: '更新服务器上暂无可用版本(可能尚未发布或发布不完整)' }
  }
  if (/cancel/i.test(raw)) {
    return { code: 'cancelled', message: '已取消本次更新' }
  }
  return { code: 'unknown', message: `更新失败:${raw}` }
}

module.exports = { CHANNELS, probeChannels, probeUrl, classifyError, isAllowedExternalUrl, PROBE_TIMEOUT_MS }
