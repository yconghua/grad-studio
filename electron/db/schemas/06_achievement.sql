-- 成果登记表（科研管理 → 成果登记）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
--
-- 说明：成果登记用于统一登记各类成果（论文 / 专利 / 软著 / 获奖 / 竞赛 / 其他），
-- 与 paper / patent 两张明细表并存；type 字段区分成果类别。
CREATE TABLE IF NOT EXISTS `achievement` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`        VARCHAR(300) NOT NULL                COMMENT '成果名称',
  `type`         VARCHAR(20)  NOT NULL                COMMENT '类型：paper 论文 / patent 专利 / software 软著 / award 获奖 / competition 竞赛 / other 其他',
  `level`        VARCHAR(30)  NULL DEFAULT NULL       COMMENT '级别（国家级 / 省部级 / 校级等）',
  `authors`      VARCHAR(500) NULL DEFAULT NULL       COMMENT '完成人（逗号分隔文本）',
  `owner_id`     INT UNSIGNED NULL DEFAULT NULL       COMMENT '第一完成人用户 id（软关联 user.id）',
  `project_id`   INT UNSIGNED NULL DEFAULT NULL       COMMENT '关联项目 id（软关联 project.id）',
  `achieve_date` DATE         NULL DEFAULT NULL       COMMENT '取得日期',
  `source`       VARCHAR(200) NULL DEFAULT NULL       COMMENT '来源 / 颁发单位',
  `attachment`   VARCHAR(255) NULL DEFAULT NULL       COMMENT '附件路径',
  `description`  TEXT         NULL                    COMMENT '成果简介',
  `created_by`   INT UNSIGNED NULL DEFAULT NULL       COMMENT '创建人用户 id',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成果登记表';
