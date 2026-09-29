-- 聊天会话成员表：成员归属 + 已读位置 + 本侧删除（隐藏）
-- 幂等：重复执行无副作用。
-- 说明：每个会话为两个成员各存一行；last_read_at 是「已读位置」，
--   未读数 = 该会话中 created_at > last_read_at 且 sender != 本人 且未撤回的消息数；
--   is_hidden 表示本人删除会话（本侧隐藏，对方不受影响），再次打开会话时恢复。
CREATE TABLE IF NOT EXISTS `chat_conversation_member` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `conversation_id` INT UNSIGNED NOT NULL                COMMENT '会话 chat_conversation.id',
  `user_id`         INT UNSIGNED NOT NULL                COMMENT '成员 user.id',
  `last_read_at`    DATETIME     DEFAULT NULL     COMMENT '已读位置：晚于此时间且 sender 非本人的消息计为未读',
  `is_hidden`       TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '本侧删除会话标记：1 隐藏（对方不受影响）',
  `hidden_at`       DATETIME     DEFAULT NULL     COMMENT '隐藏时间',
  `created_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_conv_user` (`conversation_id`, `user_id`),
  KEY `idx_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天会话成员表';
