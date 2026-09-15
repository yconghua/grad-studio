-- 考勤记录（模块8 考勤、值班与请假）
-- 唯一键 uk_member_date 是关键：多台电脑共用同一个库时，用它从数据库层面
-- 杜绝「同一人同一天出现两条考勤记录」的并发脏数据，不依赖前端判断。
-- 定位签到与扫码签到本期未开放，sign_type 先预留取值，页面入口提示开发中。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `attendance` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `member_id`     INT UNSIGNED NOT NULL                COMMENT '成员 id',
  `attend_date`   DATE         NOT NULL                COMMENT '考勤日期',
  `sign_in_time`  DATETIME     DEFAULT NULL            COMMENT '签到时间',
  `sign_out_time` DATETIME     DEFAULT NULL            COMMENT '签退时间',
  `work_hours`    DECIMAL(5,2) NOT NULL DEFAULT 0.00   COMMENT '当日工时，单位小时',
  `sign_type`     VARCHAR(20)  NOT NULL DEFAULT '正常'  COMMENT '签到方式：正常 / 手动补签 / 定位签到 / 扫码签到，后两者本期未开放',
  `status`        VARCHAR(20)  NOT NULL DEFAULT '正常'  COMMENT '状态：正常 / 迟到 / 早退 / 缺勤 / 请假 / 补签',
  `remark`        VARCHAR(255) DEFAULT NULL            COMMENT '备注',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_date` (`member_id`, `attend_date`),
  KEY `idx_date` (`attend_date`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考勤记录表';
