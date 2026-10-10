/**
 * 在线翻译 · 数据源（DeepL / 百度翻译 / 有道翻译）
 *
 * 三引擎均需用户自备 Key（设置 → API Key 管理配置），未配置的引擎不参与请求；
 * 翻译方向：auto 自动检测 / zh 中文 / en 英文 / ja 日文等。
 * 统一返回 items：{ engine, label, translatedText, detectedLang }
 */
const crypto = require('crypto')
const { fetchJson } = require('./http')

const deepL = {
  name: 'deepl',
  label: 'DeepL',
  requiresKey: true,
  keyName: 'deepl',
  async fetch(params, ctx) {
    const key = ctx && ctx.keys && ctx.keys.deepl
    if (!key) return { items: [], error: '未配置 Key' }
    const body = new URLSearchParams()
    body.set('text', params.text)
    body.set('target_lang', toDeepLLang(params.targetLang))
    if (params.srcLang && params.srcLang !== 'auto') body.set('source_lang', toDeepLLang(params.srcLang))
    const r = await fetchJson('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: { Authorization: `DeepL-Auth-Key ${key}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    })
    if (!r.ok) return { items: [], error: r.error }
    const t = r.data.translations && r.data.translations[0]
    if (!t) return { items: [], error: '无译文返回' }
    return {
      items: [{
        engine: 'deepl',
        label: 'DeepL',
        translatedText: t.text || '',
        detectedLang: t.detected_source_language || ''
      }]
    }
  }
}

function toDeepLLang(lang) {
  if (lang === 'zh') return 'ZH'
  if (lang === 'ja') return 'JA'
  return String(lang || 'EN').toUpperCase()
}

const baidu = {
  name: 'baidu',
  label: '百度翻译',
  requiresKey: true,
  keyName: 'baidu',
  async fetch(params, ctx) {
    const appid = ctx && ctx.keys && ctx.keys.baiduAppid
    const secret = ctx && ctx.keys && ctx.keys.baiduSecret
    if (!appid || !secret) return { items: [], error: '未配置 APPID / 密钥' }
    const q = params.text
    const salt = String(Date.now())
    const sign = crypto.createHash('md5').update(`${appid}${q}${salt}${secret}`).digest('hex')
    const url = `https://fanyi-api.baidu.com/api/trans/vip/translate?q=${encodeURIComponent(q)}&from=${params.srcLang === 'auto' ? 'auto' : params.srcLang}&to=${params.targetLang}&appid=${appid}&salt=${salt}&sign=${sign}`
    const r = await fetchJson(url)
    if (!r.ok) return { items: [], error: r.error }
    if (r.data.error_code && r.data.error_code !== '0') return { items: [], error: r.data.error_msg || `接口错误(${r.data.error_code})` }
    const t = r.data.trans_result && r.data.trans_result[0]
    if (!t) return { items: [], error: '无译文返回' }
    return {
      items: [{
        engine: 'baidu',
        label: '百度翻译',
        translatedText: t.dst || '',
        detectedLang: t.src || ''
      }]
    }
  }
}

const youdao = {
  name: 'youdao',
  label: '有道翻译',
  requiresKey: true,
  keyName: 'youdao',
  async fetch(params, ctx) {
    const appKey = ctx && ctx.keys && ctx.keys.youdaoAppKey
    const secret = ctx && ctx.keys && ctx.keys.youdaoSecret
    if (!appKey || !secret) return { items: [], error: '未配置 APP Key / 密钥' }
    const q = params.text
    const salt = String(Date.now())
    const curtime = String(Math.floor(Date.now() / 1000))
    const input = q.length > 20 ? q.slice(0, 10) + q.length + q.slice(-10) : q
    const sign = crypto.createHash('sha256').update(appKey + input + salt + curtime + secret).digest('hex')
    const body = new URLSearchParams()
    body.set('q', q)
    body.set('from', params.srcLang === 'auto' ? 'auto' : params.srcLang)
    body.set('to', params.targetLang)
    body.set('appKey', appKey)
    body.set('salt', salt)
    body.set('sign', sign)
    body.set('signType', 'v3')
    body.set('curtime', curtime)
    const r = await fetchJson('https://openapi.youdao.com/api', { method: 'POST', body: body.toString() })
    if (!r.ok) return { items: [], error: r.error }
    const t = r.data.translation && r.data.translation[0]
    if (!t) return { items: [], error: r.data.errorCode ? `接口错误(${r.data.errorCode})` : '无译文返回' }
    return {
      items: [{
        engine: 'youdao',
        label: '有道翻译',
        translatedText: t || '',
        detectedLang: (r.data.basic && r.data.basic['phonetic']) ? '' : ''
      }]
    }
  }
}

module.exports = { translateSources: [deepL, baidu, youdao] }
