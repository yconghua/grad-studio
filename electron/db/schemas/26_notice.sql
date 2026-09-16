-- 通知公告表（工作台 → 通知公告）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `notice` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(200) NOT NULL                COMMENT '公告标题',
  `content`      TEXT         NULL                    COMMENT '公告内容',
  `type`         VARCHAR(20)  NOT NULL DEFAULT 'notice' COMMENT '类型：notice 通知 / news 动态 / urgent 紧急',
  `status`       VARCHAR(20)  NOT NULL DEFAULT 'published' COMMENT '状态：draft 草稿 / published 已发布',
  `publisher_id` INT UNSIGNED NULL DEFAULT NULL       COMMENT '发布人用户 id（软关联 user.id）',
  `published_at` DATETIME     NULL DEFAULT NULL       COMMENT '发布时间',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='通知公告表';
