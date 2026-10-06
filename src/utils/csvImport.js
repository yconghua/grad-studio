// 批量新增用户：CSV 解析 + 预览预校验工具
import Papa from 'papaparse'

// 模板固定表头（与主进程下载的模板严格一致）
// 学号/工号 与 学历/学位/日制/年级/专业/研究方向/入学年份/毕业年份/备注 均为选填列
export const BATCH_HEADERS = [
  '用户名', '真实姓名', '角色', '手机号', '邮箱', '性别',
  '学号/工号', '学历', '学位', '日制', '年级', '专业', '研究方向', '入学年份', '毕业年份', '备注',
  '所属课题组', '导师', '启用状态'
]

const ROLE_VALUES = ['导师', '学生', '课题组管理员']
const GENDER_VALUES = ['', '男', '女', '其他']
const STATUS_VALUES = ['', '启用', '禁用']
const EDUCATION_VALUES = ['', '专科', '本科', '研究生']
const DEGREE_VALUES = ['', '无', '学士', '硕士', '博士']
const STUDY_TYPE_VALUES = ['', '全日制', '非全日制']

/**
 * 解析上传的 CSV 文件：
 * 解码顺序固定为先 UTF-8 严格模式、失败再 GBK（Excel 另存为 CSV 常见 GBK），
 * 顺序不可颠倒（GBK 解码器遇到 UTF-8 字节不会报错，只会解出乱码）。
 * @param {File} file
 * @returns {Promise<{ rows: Array, headerError: string }>}
 */
export async function parseCsvFile(file) {
  const buf = await file.arrayBuffer()
  let text
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch {
    text = new TextDecoder('gbk').decode(buf)
  }
  return parseCsvText(text)
}

/**
 * 解析 CSV 文本（粘贴场景）：剥 BOM → papaparse → 表头严格校验 → 行对象
 * @param {string} text
 * @returns {{ rows: Array, headerError: string }}
 */
export function parseCsvText(text) {
  // 剥掉 UTF-8 BOM，否则会粘在第一个表头上导致「用户名」匹配失败
  const clean = String(text || '').replace(/^\uFEFF/, '')
  const result = Papa.parse(clean, { skipEmptyLines: true })
  const data = result.data || []
  if (!data.length || data[0].length < BATCH_HEADERS.length) {
    return { rows: [], headerError: '表头不匹配，请使用下载的模板' }
  }
  const head = data[0].map((h) => String(h || '').trim())
  for (let i = 0; i < BATCH_HEADERS.length; i++) {
    if (head[i] !== BATCH_HEADERS[i]) {
      return { rows: [], headerError: `表头第 ${i + 1} 列应为「${BATCH_HEADERS[i]}」` }
    }
  }
  const rows = []
  for (let i = 1; i < data.length; i++) {
    const c = data[i]
    rows.push({
      row: i + 1, // Excel 行号（表头占第 1 行）
      username: String(c[0] == null ? '' : c[0]).trim(),
      realName: String(c[1] == null ? '' : c[1]).trim(),
      roleText: String(c[2] == null ? '' : c[2]).trim(),
      phone: String(c[3] == null ? '' : c[3]).trim(),
      email: String(c[4] == null ? '' : c[4]).trim(),
      genderText: String(c[5] == null ? '' : c[5]).trim(),
      userNo: String(c[6] == null ? '' : c[6]).trim(),
      educationText: String(c[7] == null ? '' : c[7]).trim(),
      degreeText: String(c[8] == null ? '' : c[8]).trim(),
      studyTypeText: String(c[9] == null ? '' : c[9]).trim(),
      gradeYear: String(c[10] == null ? '' : c[10]).trim(),
      major: String(c[11] == null ? '' : c[11]).trim(),
      researchField: String(c[12] == null ? '' : c[12]).trim(),
      enrollYear: String(c[13] == null ? '' : c[13]).trim(),
      graduateYear: String(c[14] == null ? '' : c[14]).trim(),
      remark: String(c[15] == null ? '' : c[15]).trim(),
      groupName: String(c[16] == null ? '' : c[16]).trim(),
      mentorUsername: String(c[17] == null ? '' : c[17]).trim(),
      statusText: String(c[18] == null ? '' : c[18]).trim(),
      errors: [],
      warnings: []
    })
  }
  return { rows, headerError: '' }
}

/**
 * 预览预校验（友好提示层，非权威）：
 * 格式 / 枚举 / 批次内重复 / 库内已存在用户名 / 非学生行填导师黄色提示；
 * 权威校验与库内查重在服务端，提交后以服务端返回明细为准。
 * @param {Array} rows
 * @param {Array<string>} existingUsernames 现有全部用户名
 * @param {Array<string>} [existingUserNos] 现有全部学号/工号
 */
export function validatePreviewRows(rows, existingUsernames = [], existingUserNos = []) {
  const seen = new Set()
  const exists = new Set(existingUsernames)
  const seenNos = new Set()
  const existsNos = new Set(existingUserNos)
  for (const r of rows) {
    r.errors = []
    r.warnings = []
    if (!r.username) {
      r.errors.push('用户名不能为空')
    } else {
      if (r.username.length > 50) r.errors.push('用户名不能超过 50 个字符')
      if (seen.has(r.username)) r.errors.push('用户名在本批次内重复')
      if (exists.has(r.username)) r.errors.push('用户名已存在')
      seen.add(r.username)
    }
    if (r.realName && r.realName.length > 50) r.errors.push('真实姓名不能超过 50 个字符')
    if (r.phone && r.phone.length > 20) r.errors.push('手机号不能超过 20 个字符')
    if (r.email && r.email.length > 100) r.errors.push('邮箱不能超过 100 个字符')
    if (!ROLE_VALUES.includes(r.roleText)) r.errors.push('角色只能填 导师 / 学生 / 课题组管理员')
    if (r.genderText && !GENDER_VALUES.includes(r.genderText)) r.errors.push('性别只能填 男 / 女 / 其他')
    if (r.statusText && !STATUS_VALUES.includes(r.statusText)) r.errors.push('启用状态只能填 启用 / 禁用')
    // 资料扩展列（选填）预校验
    if (r.userNo) {
      if (r.userNo.length > 50) r.errors.push('学号/工号不能超过 50 个字符')
      if (seenNos.has(r.userNo)) r.errors.push('学号/工号在本批次内重复')
      if (existsNos.has(r.userNo)) r.errors.push('学号/工号已存在')
      seenNos.add(r.userNo)
    }
    if (r.educationText && !EDUCATION_VALUES.includes(r.educationText)) r.errors.push('学历只能填 专科 / 本科 / 研究生')
    if (r.degreeText && !DEGREE_VALUES.includes(r.degreeText)) r.errors.push('学位只能填 无 / 学士 / 硕士 / 博士')
    if (r.studyTypeText && !STUDY_TYPE_VALUES.includes(r.studyTypeText)) r.errors.push('日制只能填 全日制 / 非全日制')
    if (r.gradeYear && !/^\d{4}$/.test(r.gradeYear)) r.errors.push('年级须为 4 位年份（如 2025）')
    if (r.major && r.major.length > 100) r.errors.push('专业不能超过 100 个字符')
    if (r.researchField && r.researchField.length > 200) r.errors.push('研究方向不能超过 200 个字符')
    if (r.enrollYear && !/^\d{4}$/.test(r.enrollYear)) r.errors.push('入学年份须为 4 位数字')
    if (r.graduateYear && !/^\d{4}$/.test(r.graduateYear)) r.errors.push('毕业年份须为 4 位数字')
    if (r.remark && r.remark.length > 500) r.errors.push('备注不能超过 500 个字符')
    // 非学生行填了导师：不报错，黄色提示已忽略
    if (r.mentorUsername && r.roleText !== '学生') r.warnings.push('非学生角色，导师列已忽略')
    // 学生指定导师但未填所属课题组：该行失败
    if (r.mentorUsername && r.roleText === '学生' && !r.groupName) {
      r.errors.push('学生指定导师时必须填写所属课题组')
    }
  }
  return rows
}
