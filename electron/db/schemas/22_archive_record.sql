-- 科研档案记录表：学生科研时间轴（科研档案页）
-- 幂等：重复执行无副作用。
-- 说明：科研档案为聚合视图，除自动汇总科研日志 / 周报 / 成果 / 任务等数据外，
--   本表记录里程碑式 / 自定义档案条目（如重要节点、获奖、会议报告），支撑完整时间轴与导出。
CREATE TABLE IF NOT EXISTS `archive_record` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '归属人 user.id（学生）',
  `record_type`   VARCHAR(20)  NOT NULL DEFAULT 'custom' COMMENT '类型：log 科研日志 / weekly 周报 / achievement 成果 / task 任务 / meeting 组会 / custom 自定义',
  `title`         VARCHAR(300) NOT NULL DEFAULT ''     COMMENT '条目标题',
  `content`       TEXT                                 COMMENT '条目内容',
  `record_date`   DATE                                 COMMENT '发生日期',
  `attachment`    VARCHAR(255) NOT NULL DEFAULT ''     COMMENT '附件路径',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_user_date` (`user_id`, `record_date`),
  KEY `idx_record_type` (`record_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研档案记录表';
