-- 资源中心统一资源表（资源中心 → 文档库 / 数据集 / 代码库 / 软件工具 / 模板中心 / 共享网盘）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
--
-- 说明：文档 / 数据集 / 代码 / 工具 / 模板 / 网盘六类资源字段高度一致，用一张表 + category 字段区分，
-- 前端各页面按 category 过滤即可，避免为六类资源各建一张结构雷同的表。
CREATE TABLE IF NOT EXISTS `resource` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`          VARCHAR(200) NOT NULL                COMMENT '资源名称',
  `category`       VARCHAR(20)  NOT NULL                COMMENT '分类：doc 文档 / dataset 数据集 / code 代码 / tool 工具 / template 模板 / drive 网盘',
  `description`    TEXT         NULL                    COMMENT '简介',
  `file_path`      VARCHAR(255) NULL DEFAULT NULL       COMMENT '文件路径（本地 / 网盘）',
  `url`            VARCHAR(255) NULL DEFAULT NULL       COMMENT '外部链接（可选）',
  `tags`           VARCHAR(200) NULL DEFAULT NULL       COMMENT '标签（逗号分隔）',
  `project_id`     INT UNSIGNED NULL DEFAULT NULL       COMMENT '关联项目 id（软关联 project.id）',
  `uploader_id`    INT UNSIGNED NULL DEFAULT NULL       COMMENT '上传人用户 id（软关联 user.id）',
  `download_count` INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '下载次数',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_category` (`category`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_uploader_id` (`uploader_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='资源中心统一资源表';
