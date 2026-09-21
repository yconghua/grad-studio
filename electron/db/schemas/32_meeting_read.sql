-- 会议已读回执表（组会 → 已读确认）
-- 记录每个参会学生是否已阅读会议纪要。
CREATE TABLE IF NOT EXISTS `meeting_read` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `meeting_id` INT UNSIGNED NOT NULL                COMMENT '关联组会 id',
  `user_id`    INT UNSIGNED NOT NULL                COMMENT '已读用户 id',
  `read_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '已读时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_meeting_user` (`meeting_id`, `user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会议已读回执表';
