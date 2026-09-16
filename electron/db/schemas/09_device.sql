-- 设备表（工作室事务 → 设备管理）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `device` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`          VARCHAR(100) NOT NULL                COMMENT '设备名称',
  `code`          VARCHAR(50)  NULL DEFAULT NULL       COMMENT '设备编号 / 资产号',
  `category`      VARCHAR(50)  NULL DEFAULT NULL       COMMENT '分类',
  `model`         VARCHAR(100) NULL DEFAULT NULL       COMMENT '型号',
  `location`      VARCHAR(100) NULL DEFAULT NULL       COMMENT '存放位置',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'normal' COMMENT '状态：normal 正常 / fault 故障 / scrapped 报废',
  `purchase_date` DATE         NULL DEFAULT NULL       COMMENT '购置日期',
  `keeper_id`     INT UNSIGNED NULL DEFAULT NULL       COMMENT '保管人用户 id（软关联 user.id）',
  `remark`        VARCHAR(500) NULL DEFAULT NULL       COMMENT '备注',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_keeper_id` (`keeper_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备表';
