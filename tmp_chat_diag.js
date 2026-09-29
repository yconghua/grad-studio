// 临时诊断脚本：查 message 表 chat 记录与铃铛未读数口径（跑完即删）
const fs = require('fs')
const mysql = require('mysql2/promise')

const raw = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
const c = raw.list.find((x) => x.id === raw.active) || raw.list[0]
const cfg = { host: c.host, port: Number(c.port) || 3306, user: c.user, password: c.password, database: c.database, dateStrings: true }

;(async () => {
  const conn = await mysql.createConnection(cfg)

  // 1) message 表 chat 类型记录全貌
  const [chats] = await conn.query(
    `SELECT id, sender_id, receiver_id, msg_type, status, ref_type, ref_id, chat_message_id, title, read_at, is_deleted, created_at
     FROM \`message\` WHERE msg_type = 'chat' ORDER BY id DESC LIMIT 20`)
  console.log('CHAT_ROWS:', JSON.stringify(chats, null, 1))

  // 2) 未读统计口径：全部 status=unread（不分类型）
  const [unreadAll] = await conn.query(
    `SELECT status, COUNT(*) AS n FROM \`message\` WHERE receiver_id = 4 AND is_deleted = 0 GROUP BY status`)
  console.log('MSG_STATUS_4:', JSON.stringify(unreadAll))

  // 3) 模拟 markReadByChatConversation(4, 1) 命中检查
  const [hit] = await conn.query(
    `SELECT COUNT(*) AS n FROM \`message\`
     WHERE receiver_id = 4 AND msg_type = 'chat' AND ref_type = 'chat' AND ref_id = 1 AND status = 'unread' AND is_deleted = 0`)
  console.log('markReadByChatConversation(4,1) would affect:', JSON.stringify(hit))

  // 4) 存在哪些会话 id / receiver 组合
  const [pairs] = await conn.query(
    `SELECT receiver_id, ref_id, status, COUNT(*) AS n FROM \`message\`
     WHERE msg_type = 'chat' AND is_deleted = 0 GROUP BY receiver_id, ref_id, status`)
  console.log('CHAT_GROUPS:', JSON.stringify(pairs))

  await conn.end()
  process.exit(0)
})()
