-- 课题组公告已读表：导师/学生标记已读记录（幂等：同一公告同一用户仅一条）
-- 幂等：重复执行无副作用。
-- 说明：公告或课题组被删除时，由应用层级联删除本表记录，避免孤儿数据。
CREATE TABLE IF NOT EXISTS `group_notice_read` (
  `id`        BIGINT   NOT NULL AUTO_INCREMENT COMMENT '已读记录ID',
  `notice_id` BIGINT   NOT NULL COMMENT '公告ID（公告删除时级联删除）',
  `user_id`   BIGINT   NOT NULL COMMENT '已读用户ID',
  `read_at`   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '已读时间',
  `change_ts` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '行变更时间戳（全局刷新指纹检测用）',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_notice_user` (`notice_id`, `user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='课题组公告已读表';
