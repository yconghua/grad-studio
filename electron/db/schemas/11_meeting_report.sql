-- 组会汇报表：学生在组会上的汇报（组管 / 导师审阅）
-- 幂等：重复执行无副作用。
-- 说明：每个学生可在一次组会上提交一条汇报；审阅状态由组管 / 导师维护，
--   pending 待审阅 → approved 通过 / rejected 打回（可填写审阅意见）。
CREATE TABLE IF NOT EXISTS `meeting_report` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `meeting_id`    INT UNSIGNED NOT NULL                COMMENT '组会 meeting.id',
  `student_id`    INT UNSIGNED NOT NULL                COMMENT '汇报学生 user.id',
  `topic`         VARCHAR(200) NOT NULL DEFAULT ''     COMMENT '汇报主题',
  `content`       TEXT                                 COMMENT '汇报内容',
  `file_path`     VARCHAR(255) NOT NULL DEFAULT ''     COMMENT '汇报附件（PPT / 文档路径）',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '审阅状态：pending 待审阅 / approved 已通过 / rejected 已打回',
  `review_comment` VARCHAR(500) NOT NULL DEFAULT ''    COMMENT '审阅意见',
  `reviewed_by`   INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '审阅人 user.id',
  `reviewed_at`   DATETIME                             COMMENT '审阅时间',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_meeting` (`meeting_id`),
  KEY `idx_student` (`student_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='组会汇报表';
