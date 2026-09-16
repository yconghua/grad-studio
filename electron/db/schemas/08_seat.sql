-- 工位表（工作室事务 → 工位管理）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `seat` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`       VARCHAR(50)  NOT NULL                COMMENT '工位编号 / 名称',
  `location`   VARCHAR(100) NULL DEFAULT NULL       COMMENT '位置（房间 / 区域）',
  `owner_id`   INT UNSIGNED NULL DEFAULT NULL       COMMENT '当前使用人用户 id（软关联 user.id）',
  `status`     VARCHAR(20)  NOT NULL DEFAULT 'vacant' COMMENT '状态：vacant 空闲 / occupied 占用 / reserved 预留',
  `remark`     VARCHAR(200) NULL DEFAULT NULL       COMMENT '备注',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_owner_id` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='工位表';
