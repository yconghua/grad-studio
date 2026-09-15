-- 值班排班 / 值班日志（模块8 考勤、值班与请假 - 值班管理）
-- 唯一键 uk_date_shift 保证同一天同一班次只能安排一个人（多机并发下的兜底约束）。
-- 注意：班次字段命名为 duty_shift 而非 shift，避免与数据库关键字重名带来的转义风险。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `duty_schedule` (
  `id`         INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `member_id`  INT UNSIGNED NOT NULL                COMMENT '值班人 member.id',
  `duty_date`  DATE         NOT NULL                COMMENT '值班日期',
  `duty_shift` VARCHAR(20)  NOT NULL DEFAULT '全天'  COMMENT '班次：上午 / 下午 / 全天',
  `duty_type`  VARCHAR(20)  NOT NULL DEFAULT '常规'  COMMENT '类型：常规 / 节假日',
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_date_shift` (`duty_date`, `duty_shift`),
  KEY `idx_member` (`member_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='值班排班表';

CREATE TABLE IF NOT EXISTS `duty_log` (
  `id`          INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `schedule_id` INT UNSIGNED NOT NULL                COMMENT '排班记录 id',
  `member_id`   INT UNSIGNED DEFAULT NULL            COMMENT '记录人 member.id',
  `content`     TEXT         DEFAULT NULL            COMMENT '值班日志内容',
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_schedule` (`schedule_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='值班日志表';
