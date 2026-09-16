-- 专利软著表（科研管理 → 专利软著）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `patent` (
  `id`             INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `title`          VARCHAR(300) NOT NULL                COMMENT '专利 / 软著名称',
  `type`           VARCHAR(20)  NOT NULL                COMMENT '类型：invention 发明专利 / utility 实用新型 / design 外观设计 / software 软件著作权',
  `patent_no`      VARCHAR(100) NULL DEFAULT NULL       COMMENT '专利号 / 登记号',
  `application_no` VARCHAR(100) NULL DEFAULT NULL       COMMENT '申请号',
  `inventors`      VARCHAR(500) NULL DEFAULT NULL       COMMENT '发明人（逗号分隔文本）',
  `owner_id`       INT UNSIGNED NULL DEFAULT NULL       COMMENT '第一发明人用户 id（软关联 user.id）',
  `applicant`      VARCHAR(200) NULL DEFAULT NULL       COMMENT '申请人 / 权利人',
  `status`         VARCHAR(20)  NULL DEFAULT NULL       COMMENT '状态：applied 已申请 / granted 已授权 / rejected 未授权',
  `apply_date`     DATE         NULL DEFAULT NULL       COMMENT '申请日',
  `grant_date`     DATE         NULL DEFAULT NULL       COMMENT '授权日',
  `project_id`     INT UNSIGNED NULL DEFAULT NULL       COMMENT '关联项目 id（软关联 project.id）',
  `attachment`     VARCHAR(255) NULL DEFAULT NULL       COMMENT '附件路径',
  `description`    TEXT         NULL                    COMMENT '备注',
  `created_by`     INT UNSIGNED NULL DEFAULT NULL       COMMENT '创建人用户 id',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_type` (`type`),
  KEY `idx_status` (`status`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='专利软著表';
