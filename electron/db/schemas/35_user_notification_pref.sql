-- 用户通知偏好表（订阅规则：哪些事件收哪种通知）
CREATE TABLE IF NOT EXISTS `user_notification_pref` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`         INT UNSIGNED NOT NULL                COMMENT '用户 id',
  `event_type`      VARCHAR(30)  NOT NULL                COMMENT '事件类型：task_assigned/task_changed/comment/mention/due_reminder',
  `inapp_enabled`   TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '站内通知开关',
  `desktop_enabled` TINYINT(1)   NOT NULL DEFAULT 1      COMMENT '桌面通知开关',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_event` (`user_id`, `event_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户通知偏好表';
