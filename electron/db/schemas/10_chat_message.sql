-- 消息表：会话内每条消息（纯文本）
-- 幂等：重复执行无副作用。
-- 说明：消息一旦写入永不删除（撤回置 status=2 并清空内容）；用户删除时标记 sender_deleted_mark；
--   双方用户都被删除时由应用层在同一事务内硬删会话、成员、消息。
CREATE TABLE IF NOT EXISTS `chat_message` (
  `id`                  BIGINT        NOT NULL AUTO_INCREMENT COMMENT '消息ID',
  `session_id`          BIGINT        NOT NULL COMMENT '会话ID',
  `sender_id`           BIGINT        NOT NULL COMMENT '发送人用户ID（用户删除后保留原值，不做外键级联）',
  `client_message_id`   VARCHAR(64)   NOT NULL COMMENT '客户端消息ID（前端生成，幂等防重）',
  `content`             VARCHAR(2000) NOT NULL COMMENT '消息内容（纯文本）',
  `status`              TINYINT       NOT NULL DEFAULT 1 COMMENT '状态：1正常，2已撤回',
  `created_at`          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `recalled_at`         DATETIME      DEFAULT NULL COMMENT '撤回时间',
  `sender_deleted_mark` TINYINT       NOT NULL DEFAULT 0 COMMENT '发送人已删除标记：1已删除',
  `change_ts`           DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_sender_client` (`sender_id`, `client_message_id`),
  KEY `idx_session_id` (`session_id`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='消息表';
