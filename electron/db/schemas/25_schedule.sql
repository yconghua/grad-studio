-- 日程安排表（工作台 → 日程安排）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `schedule` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`       VARCHAR(200) NOT NULL                COMMENT '日程标题',
  `type`        VARCHAR(20)  NOT NULL DEFAULT 'other' COMMENT '类型：meeting 会议 / deadline 截止 / reminder 提醒 / other 其他',
  `user_id`     INT UNSIGNED NOT NULL                COMMENT '所属用户 id（软关联 user.id）',
  `start_time`  DATETIME     NULL DEFAULT NULL       COMMENT '开始时间',
  `end_time`    DATETIME     NULL DEFAULT NULL       COMMENT '结束时间',
  `location`    VARCHAR(100) NULL DEFAULT NULL       COMMENT '地点',
  `description` TEXT         NULL                    COMMENT '说明',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_start_time` (`start_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='日程安排表';
