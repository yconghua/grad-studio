-- 考勤记录表（工作室事务 → 考勤值班）
-- 幂等：CREATE TABLE IF NOT EXISTS；版本升级迁移会重跑本文件并自动补列。
CREATE TABLE IF NOT EXISTS `attendance` (
  `id`              INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`         INT UNSIGNED NOT NULL                COMMENT '成员用户 id（软关联 user.id）',
  `attendance_date` DATE         NOT NULL                COMMENT '考勤日期',
  `status`          VARCHAR(20)  NOT NULL DEFAULT 'present' COMMENT '状态：present 出勤 / late 迟到 / leave 请假 / absent 缺勤',
  `check_in_time`   TIME         NULL DEFAULT NULL       COMMENT '签到时间',
  `check_out_time`  TIME         NULL DEFAULT NULL       COMMENT '签退时间',
  `remark`          VARCHAR(200) NULL DEFAULT NULL       COMMENT '备注',
  `created_by`      INT UNSIGNED NULL DEFAULT NULL       COMMENT '登记人用户 id',
  `created_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_date` (`user_id`, `attendance_date`),
  KEY `idx_attendance_date` (`attendance_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='考勤记录表';
