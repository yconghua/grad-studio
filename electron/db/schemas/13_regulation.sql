-- 规章制度表（工作室事务 → 规章制度）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `regulation` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(200) NOT NULL                COMMENT '制度标题',
  `content`      TEXT         NULL                    COMMENT '制度内容',
  `category`     VARCHAR(50)  NULL DEFAULT NULL       COMMENT '分类',
  `status`       VARCHAR(20)  NOT NULL DEFAULT 'published' COMMENT '状态：draft 草稿 / published 已发布',
  `publish_date` DATE         NULL DEFAULT NULL       COMMENT '发布日期',
  `publisher_id` INT UNSIGNED NULL DEFAULT NULL       COMMENT '发布人用户 id（软关联 user.id）',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='规章制度表';
