-- 周报 / 月报（模块3 项目与任务协作 - 周报月报）
-- 设计为「留存快照」而非实时统计：生成时把当时的任务完成情况冻结进本表，
-- 这样一个月后再看，仍能看到当时写下的总结，而不是被后续任务变更覆盖。
-- 唯一键 uk_member_period 保证同一人同一周期只有一份，重复生成走更新。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `report_weekly` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `member_id`     INT UNSIGNED NOT NULL                COMMENT '成员 member.id',
  `period_type`   VARCHAR(10)  NOT NULL DEFAULT '周报'  COMMENT '周期类型：周报 / 月报',
  `period_start`  DATE         NOT NULL                COMMENT '周期开始日期',
  `period_end`    DATE         NOT NULL                COMMENT '周期结束日期',
  `done_count`    INT          NOT NULL DEFAULT 0      COMMENT '本周期已完成任务数，生成时的快照',
  `doing_count`   INT          NOT NULL DEFAULT 0      COMMENT '本周期进行中任务数，生成时的快照',
  `overdue_count` INT          NOT NULL DEFAULT 0      COMMENT '本周期已超期任务数，生成时的快照',
  `content`       TEXT         DEFAULT NULL            COMMENT '工作总结正文',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_member_period` (`member_id`, `period_type`, `period_start`),
  KEY `idx_period_start` (`period_start`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='周报月报表';
