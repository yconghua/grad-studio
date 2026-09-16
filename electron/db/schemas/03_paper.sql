-- 论文著作表（科研管理 → 论文著作）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `paper` (
  `id`               INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`            VARCHAR(300) NOT NULL                COMMENT '论文标题',
  `authors`          VARCHAR(500) NULL DEFAULT NULL       COMMENT '作者（逗号分隔文本）',
  `first_author_id`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '第一作者用户 id（软关联 user.id）',
  `corresponding_id` INT UNSIGNED NULL DEFAULT NULL       COMMENT '通讯作者用户 id（软关联 user.id）',
  `journal`          VARCHAR(200) NULL DEFAULT NULL       COMMENT '期刊 / 会议名称',
  `volume`           VARCHAR(50)  NULL DEFAULT NULL       COMMENT '卷 / 期',
  `pages`            VARCHAR(50)  NULL DEFAULT NULL       COMMENT '页码',
  `doi`              VARCHAR(100) NULL DEFAULT NULL       COMMENT 'DOI',
  `index_type`       VARCHAR(20)  NULL DEFAULT NULL       COMMENT '收录：sci / ei / core 核心期刊 / general 普通期刊',
  `status`           VARCHAR(20)  NULL DEFAULT NULL       COMMENT '状态：submitted 投稿 / accepted 录用 / published 见刊 / rejected 拒稿',
  `publish_date`     DATE         NULL DEFAULT NULL       COMMENT '发表日期',
  `project_id`       INT UNSIGNED NULL DEFAULT NULL       COMMENT '关联项目 id（软关联 project.id）',
  `attachment`       VARCHAR(255) NULL DEFAULT NULL       COMMENT '附件路径',
  `description`      TEXT         NULL                    COMMENT '备注',
  `created_by`       INT UNSIGNED NULL DEFAULT NULL       COMMENT '创建人用户 id',
  `created_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_index_type` (`index_type`),
  KEY `idx_status` (`status`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_first_author_id` (`first_author_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='论文著作表';
