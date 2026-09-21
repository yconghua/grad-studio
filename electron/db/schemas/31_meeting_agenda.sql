-- 会议议程表（组会 → 议程管理）
-- 一次组会可有多个议程项：文献分享 / 进展汇报 / 问题讨论。
CREATE TABLE IF NOT EXISTS `meeting_agenda` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `meeting_id`   INT UNSIGNED NOT NULL                COMMENT '关联组会 id',
  `order_no`     INT UNSIGNED NOT NULL DEFAULT 1       COMMENT '议程顺序',
  `content`      VARCHAR(500) NOT NULL                COMMENT '议程内容',
  `speaker_id`   INT UNSIGNED NULL DEFAULT NULL       COMMENT '汇报人用户 id',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_meeting_id` (`meeting_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会议议程表';
