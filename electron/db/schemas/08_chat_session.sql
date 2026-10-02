-- 私聊会话表：任意两个启用用户之间唯一一个会话（A 找 B 与 B 找 A 为同一条）
-- 幂等：重复执行无副作用。
-- 说明：会话永久保留，不主动删除；双方用户都被删除时由应用层在同一事务内硬删本表与成员、消息。
-- user_low / user_high 存小/大用户 ID，配合复合唯一索引避免字符串拼接歧义（如 12+34 与 1+234）。
CREATE TABLE IF NOT EXISTS `chat_session` (
  `id`                BIGINT   NOT NULL AUTO_INCREMENT COMMENT '会话ID',
  `user_low`          BIGINT   NOT NULL COMMENT '会话中小用户ID',
  `user_high`         BIGINT   NOT NULL COMMENT '会话中大用户ID',
  `last_message_id`   BIGINT   DEFAULT NULL COMMENT '最后一条消息ID',
  `last_message_time` DATETIME DEFAULT NULL COMMENT '最后一条消息时间（会话列表排序）',
  `created_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_pair` (`user_low`, `user_high`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='私聊会话表';
