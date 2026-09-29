-- 聊天消息表：文本 / 图片 / 文件消息（聊天模块主数据源）
-- 幂等：重复执行无副作用。
-- 说明：content_type 区分 text / image / file；附件（图片、文件）本体存本地
--   uploads 目录（沿用 sys:pick-attachment 机制），本表只存路径与元信息；
--   is_recalled 表示发送者撤回（仅发送者、发送后 2 分钟内可撤回）。
CREATE TABLE IF NOT EXISTS `chat_message` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `conversation_id` INT UNSIGNED NOT NULL                COMMENT '会话 chat_conversation.id',
  `sender_id`       INT UNSIGNED NOT NULL                COMMENT '发送者 user.id',
  `content_type`    VARCHAR(20)  NOT NULL DEFAULT 'text' COMMENT '消息类型：text 文本 / image 图片 / file 文件',
  `content`         TEXT                                 COMMENT '文本内容（图片/文件消息可为空或简短描述）',
  `file_name`       VARCHAR(255) DEFAULT NULL     COMMENT '附件原始文件名',
  `file_path`       VARCHAR(500) DEFAULT NULL     COMMENT '附件存储路径（uploads 目录内）',
  `file_size`       BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT '附件大小（字节）',
  `file_mime`       VARCHAR(100) DEFAULT NULL     COMMENT '附件 MIME 类型',
  `is_recalled`     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '撤回标记：0 正常 / 1 已撤回',
  `recalled_at`     DATETIME     DEFAULT NULL     COMMENT '撤回时间',
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '发送时间',
  `is_deleted`      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_conversation` (`conversation_id`, `id`),
  KEY `idx_sender` (`sender_id`),
  KEY `idx_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天消息表';
