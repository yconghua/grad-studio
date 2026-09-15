-- 耗材库存 / 领用补充记录（模块7 设备与资产管理 - 耗材管理）
-- stock 的增减统一在 Service 层用事务完成，同时写一条 consumable_record 流水，
-- 保证多台电脑并发领用时库存不串数。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `consumable` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`       VARCHAR(100) NOT NULL                COMMENT '耗材名称',
  `spec`       VARCHAR(100) DEFAULT NULL            COMMENT '规格',
  `unit`       VARCHAR(20)  DEFAULT NULL            COMMENT '单位，如 个 / 盒 / 瓶',
  `stock`      INT          NOT NULL DEFAULT 0      COMMENT '当前库存数量',
  `warn_stock` INT          NOT NULL DEFAULT 0      COMMENT '低库存预警阈值，库存小于等于该值时预警',
  `location`   VARCHAR(150) DEFAULT NULL            COMMENT '存放位置',
  `is_deleted` TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除：0 正常 / 1 已删除',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='耗材库存表';

CREATE TABLE IF NOT EXISTS `consumable_record` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `consumable_id` INT UNSIGNED NOT NULL                COMMENT '耗材 id',
  `member_id`     INT UNSIGNED DEFAULT NULL            COMMENT '领用人 member.id，补充时为空',
  `record_type`   VARCHAR(20)  NOT NULL DEFAULT '领用'  COMMENT '类型：领用 / 补充',
  `num`           INT          NOT NULL DEFAULT 0      COMMENT '数量，正数，增减方向由 record_type 决定',
  `operator_id`   INT UNSIGNED DEFAULT NULL            COMMENT '经办人 member.id',
  `remark`        VARCHAR(255) DEFAULT NULL            COMMENT '备注',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_consumable` (`consumable_id`),
  KEY `idx_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='耗材领用补充记录表';
