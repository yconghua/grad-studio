/**
 * 登录日志服务（Service Layer）—— 记录 / 查询 / 导出 / 保留天数 / 定期清理
 *
 * 设计约定：
 *   - 纯本地采集，不联网：IP 取局域网地址，address 为「主机名 · 网卡类型 · IP」；
 *   - 记录为旁路写（record 内部 try/catch 静默），任何异常都不影响登录主流程；
 *   - 保留天数存 system_configs（键 login_log.retain_days，默认 90），由调度器每日清理。
 */
const os = require('node:os')
const loginLogRepository = require('../db/repositories/loginLogRepository')
const systemConfigRepository = require('../db/repositories/systemConfigRepository')

// 保留天数配置键
const RETAIN_DAYS_KEY = 'login_log.retain_days'
const DEFAULT_RETAIN_DAYS = 90

// 虚拟网卡特征（排最后），物理网卡优先常见命名（覆盖中英文）
const VIRTUAL_RE = /vmware|virtualbox|hyper-?v|vethernet|tap-|zerotier|tailscale|nordvpn|wireguard|蓝牙|bluetooth/i
const PHYSICAL_RE = /ethernet|wlan|wi-?fi|无线|本地连接|以太网/i

/**
 * 采集本机登录环境：局域网 IP + 网卡类型 + 主机名（与扫码服务同一探测思路）
 * 跳过回环、虚拟网卡、链路本地 169.254.x.x；物理网卡优先。
 * @returns {{ ip: string, address: string }}
 */
function collectLocalInfo() {
  const host = os.hostname() || 'unknown'
  const all = []
  const nets = os.networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const info of nets[name] || []) {
      if (info.family !== 'IPv4' || info.internal) continue
      if (info.address.startsWith('169.254.')) continue
      all.push({ name, ip: info.address })
    }
  }
  const real = []
  const virtual = []
  for (const c of all) {
    ;(VIRTUAL_RE.test(c.name) ? virtual : real).push(c)
  }
  const preferred = real.find((c) => PHYSICAL_RE.test(c.name)) || real[0] || virtual[0] || null
  if (!preferred) return { ip: '', address: `${host} · 无网卡` }
  return { ip: preferred.ip, address: `${host} · ${preferred.name} · ${preferred.ip}` }
}

// 行转 DTO：字段名转驼峰（login_time → loginTime）
function toDto(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id == null ? null : Number(row.user_id),
    username: row.username,
    role: row.role || '',
    loginType: row.login_type,
    ip: row.ip || '',
    address: row.address || '',
    status: Number(row.status),
    failReason: row.fail_reason || '',
    loginTime: row.login_time
  }
}

/**
 * 记录一条登录日志（旁路写：内部吞掉所有异常，绝不影响登录主流程）
 * @param {{ userId?:number, username:string, role?:string, loginType:string, status:number, failReason?:string }} param
 */
async function record({ userId, username, role, loginType, status, failReason } = {}) {
  if (!username) return
  const { ip, address } = collectLocalInfo()
  try {
    await loginLogRepository.create({
      user_id: userId == null ? null : Number(userId),
      username: String(username).slice(0, 64),
      role: role ? String(role).slice(0, 32) : null,
      login_type: loginType || 'password',
      ip: ip || null,
      address: address || null,
      status: status ? 1 : 0,
      fail_reason: failReason ? String(failReason).slice(0, 255) : null
    })
  } catch (e) {
    // 日志写入失败仅打印，不阻断登录
    console.error('[loginLog] 记录登录日志失败:', e && e.message)
  }
}

/**
 * 分页查询登录日志（超管）
 * @param {Object} filters 筛选与分页排序参数
 */
async function pagedList(filters = {}) {
  const res = await loginLogRepository.pagedList(filters)
  return { ...res, list: (res.list || []).map(toDto) }
}

/**
 * 导出 CSV 文本（UTF-8 带 BOM，由 IPC 层保存到用户选择的位置）
 * @param {Object} filters 与分页查询相同的筛选（不含分页）
 */
async function buildCsv(filters = {}) {
  const rows = (await loginLogRepository.listForExport(filters)).map(toDto)
  const header = ['登录时间', '用户名', '角色', '登录方式', 'IP', '地址', '状态', '失败原因']
  const typeLabel = { password: '账号密码', scan: '扫码', restore: '免密恢复' }
  const lines = [header.join(',')]
  for (const r of rows) {
    const cells = [
      r.loginTime || '',
      r.username || '',
      r.role || '',
      typeLabel[r.loginType] || r.loginType || '',
      r.ip || '',
      r.address || '',
      r.status === 1 ? '成功' : '失败',
      r.failReason || ''
    ].map((v) => {
      const s = String(v == null ? '' : v)
      // 字段含逗号/引号/换行时按 CSV 规则转义
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    })
    lines.push(cells.join(','))
  }
  return '\uFEFF' + lines.join('\r\n')
}

/**
 * 读取保留天数配置（默认 90）
 * @returns {Promise<number>}
 */
async function getRetainDays() {
  try {
    const row = await systemConfigRepository.findByKey(RETAIN_DAYS_KEY)
    const n = Number(row && row.config_value)
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_RETAIN_DAYS
  } catch (e) {
    return DEFAULT_RETAIN_DAYS
  }
}

/**
 * 设置保留天数（超管）：参数存在则更新，不存在则新增
 * @param {number} days 1~3650
 */
async function setRetainDays(days) {
  const d = Math.max(1, Math.min(3650, Number(days) || DEFAULT_RETAIN_DAYS))
  const row = await systemConfigRepository.findByKey(RETAIN_DAYS_KEY)
  if (row) {
    await systemConfigRepository.updateById(row.id, { config_value: String(d) })
  } else {
    await systemConfigRepository.create({
      config_key: RETAIN_DAYS_KEY,
      config_value: String(d),
      config_type: 'number',
      description: '登录日志保留天数（每日自动清理更早记录）'
    })
  }
  return d
}

/**
 * 清理过期登录日志（调度器每日调用；无过期数据时删除 0 条，幂等）
 * @returns {Promise<number>} 删除条数
 */
async function purgeExpired() {
  const days = await getRetainDays()
  return loginLogRepository.purgeOlderThan(days)
}

module.exports = { record, pagedList, buildCsv, getRetainDays, setRetainDays, purgeExpired }
