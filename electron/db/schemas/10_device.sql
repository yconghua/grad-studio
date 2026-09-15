-- 设备台账 / 借用 / 预约 / 报修（模块7 设备与资产管理）
-- 借用与预约审批走统一审批单，本文件的业务表只存 approval_id 关联。
-- 扫码借用与二维码标签本期未开放，qr_code 字段先预留。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `device` (
  `id`            INT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '主键',
  `name`          VARCHAR(100)  NOT NULL                COMMENT '设备名称',
  `code`          VARCHAR(50)   NOT NULL                COMMENT '设备编号，唯一',
  `model`         VARCHAR(100)  DEFAULT NULL            COMMENT '型号',
  `purchase_date` DATE          DEFAULT NULL            COMMENT '购买日期',
  `price`         DECIMAL(12,2) DEFAULT NULL            COMMENT '购置金额',
  `owner_id`      INT UNSIGNED  DEFAULT NULL            COMMENT '负责人 member.id',
  `location`      VARCHAR(150)  DEFAULT NULL            COMMENT '存放位置',
  `status`        VARCHAR(20)   NOT NULL DEFAULT '正常'  COMMENT '状态：正常 / 借用中 / 维修中 / 报废',
  `qr_code`       VARCHAR(100)  DEFAULT NULL            COMMENT '二维码标签内容，扫码功能本期未开放',
  `is_deleted`    TINYINT       NOT NULL DEFAULT 0      COMMENT '逻辑删除：0 正常 / 1 已删除',
  `created_at`    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code` (`code`),
  KEY `idx_status` (`status`),
  KEY `idx_owner` (`owner_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备台账表';

CREATE TABLE IF NOT EXISTS `device_borrow` (
  `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `device_id`          INT UNSIGNED NOT NULL                COMMENT '设备 id',
  `member_id`          INT UNSIGNED NOT NULL                COMMENT '借用人 member.id',
  `purpose`            VARCHAR(255) DEFAULT NULL            COMMENT '借用用途',
  `plan_borrow_time`   DATETIME     DEFAULT NULL            COMMENT '计划借用时间',
  `plan_return_time`   DATETIME     DEFAULT NULL            COMMENT '计划归还时间',
  `borrow_time`        DATETIME     DEFAULT NULL            COMMENT '实际借出时间',
  `return_time`        DATETIME     DEFAULT NULL            COMMENT '实际归还时间',
  `approval_id`        INT UNSIGNED DEFAULT NULL            COMMENT '关联审批单 approval_order.id',
  `status`             VARCHAR(20)  NOT NULL DEFAULT '待审批' COMMENT '状态：待审批 / 已批准 / 已借出 / 已归还 / 已驳回 / 已超期',
  `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  `updated_at`         DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_device` (`device_id`),
  KEY `idx_member` (`member_id`),
  KEY `idx_status` (`status`),
  KEY `idx_plan_return` (`plan_return_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备借用表';

CREATE TABLE IF NOT EXISTS `device_reserve` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `device_id`  INT UNSIGNED NOT NULL                COMMENT '设备 id',
  `member_id`  INT UNSIGNED NOT NULL                COMMENT '预约人 member.id',
  `start_time` DATETIME     NOT NULL                COMMENT '使用开始时间',
  `end_time`   DATETIME     NOT NULL                COMMENT '使用结束时间',
  `purpose`    VARCHAR(255) DEFAULT NULL            COMMENT '用途',
  `status`     VARCHAR(20)  NOT NULL DEFAULT '已预约' COMMENT '状态：已预约 / 已使用 / 已取消',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_device_time` (`device_id`, `start_time`),
  KEY `idx_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备预约表';

CREATE TABLE IF NOT EXISTS `device_repair` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `device_id`     INT UNSIGNED NOT NULL                COMMENT '设备 id',
  `member_id`     INT UNSIGNED DEFAULT NULL            COMMENT '报修人 member.id',
  `fault_desc`    TEXT         DEFAULT NULL            COMMENT '故障描述',
  `apply_time`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '报修时间',
  `handler_id`    INT UNSIGNED DEFAULT NULL            COMMENT '处理人 member.id',
  `handle_result` VARCHAR(500) DEFAULT NULL            COMMENT '处理结果',
  `finish_time`   DATETIME     DEFAULT NULL            COMMENT '完成时间',
  `status`        VARCHAR(20)  NOT NULL DEFAULT '待处理' COMMENT '状态：待处理 / 维修中 / 已完成 / 转报废',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_device` (`device_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='设备报修表';
