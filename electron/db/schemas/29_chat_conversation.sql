-- 聊天会话表：1 对 1 私聊会话（聊天模块独立，与 message 通知表互不相干）
-- 幂等：重复执行无副作用；主初始化按文件名顺序自动执行，新增表无需改初始化代码。
-- 说明：1 对 1 会话以有序用户对 (user_a, user_b) 唯一（小 id 在前），
--   uk_pair 唯一键保证同一对用户永远只有一个会话；并发 get-or-create 时
--   靠捕获唯一键冲突后重查复用既有会话，防止同时互发建出两个会话。
CREATE TABLE IF NOT EXISTS `chat_conversation` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_a`        INT UNSIGNED NOT NULL                COMMENT '会话成员 A（小 id，与 user_b 构成有序对）',
  `user_b`        INT UNSIGNED NOT NULL                COMMENT '会话成员 B（大 id）',
  `type`          VARCHAR(20)  NOT NULL DEFAULT 'single' COMMENT '类型：single 单聊（预留 group 群聊）',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '最后活动时间（会话列表排序依据）',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_pair` (`user_a`, `user_b`),
  KEY `idx_a` (`user_a`),
  KEY `idx_b` (`user_b`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='聊天会话表';
