-- 物品 / 设备借用表（工作室事务 → 物品借用）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `borrow_record` (
  `id`                INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `item_name`         VARCHAR(200) NOT NULL                COMMENT '借用物品名称',
  `device_id`         INT UNSIGNED NULL DEFAULT NULL       COMMENT '关联设备 id（借设备时，软关联 device.id）',
  `borrower_id`       INT UNSIGNED NOT NULL                COMMENT '借用人用户 id（软关联 user.id）',
  `purpose`           VARCHAR(200) NULL DEFAULT NULL       COMMENT '用途',
  `borrow_date`       DATE         NULL DEFAULT NULL       COMMENT '借用日期',
  `expect_return_date` DATE        NULL DEFAULT NULL       COMMENT '预计归还日期',
  `return_date`       DATE         NULL DEFAULT NULL       COMMENT '实际归还日期',
  `status`            VARCHAR(20)  NOT NULL DEFAULT 'borrowed' COMMENT '状态：borrowed 借用中 / returned 已归还',
  `remark`            VARCHAR(500) NULL DEFAULT NULL       COMMENT '备注',
  `created_by`        INT UNSIGNED NULL DEFAULT NULL       COMMENT '登记人用户 id',
  `created_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_borrower_id` (`borrower_id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='物品/设备借用表';
