-- 经费流水表（科研管理 → 经费管理）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `fund_record` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `project_id`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '关联项目 id（软关联 project.id）',
  `type`        VARCHAR(20)  NOT NULL                COMMENT '类型：income 收入 / expense 支出',
  `amount`      DECIMAL(14,2) NOT NULL               COMMENT '金额（元）',
  `category`    VARCHAR(50)  NULL DEFAULT NULL       COMMENT '经费科目（设备费 / 差旅费 / 材料费等）',
  `title`       VARCHAR(200) NULL DEFAULT NULL       COMMENT '摘要',
  `record_date` DATE         NULL DEFAULT NULL       COMMENT '发生日期',
  `handler_id`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '经办人用户 id（软关联 user.id）',
  `remark`      VARCHAR(500) NULL DEFAULT NULL       COMMENT '备注',
  `created_by`  INT UNSIGNED NULL DEFAULT NULL       COMMENT '创建人用户 id',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_project_id` (`project_id`),
  KEY `idx_type` (`type`),
  KEY `idx_record_date` (`record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='经费流水表';
