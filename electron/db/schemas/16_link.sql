-- 常用链接表（资源中心 → 常用链接）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `link` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`       VARCHAR(200) NOT NULL                COMMENT '链接名称',
  `url`         VARCHAR(500) NOT NULL                COMMENT '链接地址',
  `category`    VARCHAR(50)  NULL DEFAULT NULL       COMMENT '分类',
  `description` VARCHAR(500) NULL DEFAULT NULL       COMMENT '说明',
  `creator_id`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '创建人用户 id（软关联 user.id）',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='常用链接表';
