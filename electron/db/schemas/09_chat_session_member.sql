-- 会话成员表：记录每个会话的参与者、已读游标与用户删除标记
-- 幂等：重复执行无副作用。
-- 说明：成员记录不硬删，用户删除时仅打标记（is_user_deleted=1）；
--   双方用户都被删除时由应用层在同一事务内硬删会话、成员、消息。
CREATE TABLE IF NOT EXISTS `chat_session_member` (
  `id`                   BIGINT   NOT NULL AUTO_INCREMENT COMMENT '成员记录ID',
  `session_id`           BIGINT   NOT NULL COMMENT '会话ID（会话删除时级联删除）',
  `user_id`              BIGINT   NOT NULL COMMENT '用户ID',
  `last_read_message_id` BIGINT   DEFAULT NULL COMMENT '最后已读消息ID（未读游标，单调递增）',
  `last_read_time`       DATETIME DEFAULT NULL COMMENT '最后已读时间',
  `member_status`        TINYINT  NOT NULL DEFAULT 1 COMMENT '成员状态：1正常',
  `is_user_deleted`      TINYINT  NOT NULL DEFAULT 0 COMMENT '用户已删除标记：1已删除',
  `joined_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '加入时间',
  `change_ts`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_session_user` (`session_id`, `user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会话成员表';
