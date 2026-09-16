-- 科研日志表（科研管理 → 科研日志）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `research_log` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`      VARCHAR(200) NOT NULL                COMMENT '日志标题',
  `content`    TEXT         NULL                    COMMENT '日志内容',
  `project_id` INT UNSIGNED NULL DEFAULT NULL       COMMENT '关联项目 id（软关联 project.id）',
  `author_id`  INT UNSIGNED NOT NULL                COMMENT '作者用户 id（软关联 user.id）',
  `log_date`   DATE         NULL DEFAULT NULL       COMMENT '日志日期',
  `attachment` VARCHAR(255) NULL DEFAULT NULL       COMMENT '附件路径',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_author_id` (`author_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研日志表';
