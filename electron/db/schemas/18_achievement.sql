-- 科研成果表：学生录入成果，导师 / 组管审核（科研成果页）
-- 幂等：重复执行无副作用。
-- 说明：成果类型区分 paper 论文 / patent 专利 / software 软著 / award 获奖 / project 项目 / other 其他；
--   论文的投稿跟踪明细独立存 paper 表；审核状态：pending → approved / rejected。
CREATE TABLE IF NOT EXISTS `achievement` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '成果归属人 user.id（学生）',
  `group_id`      INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '所属课题组 group.id（0 未分组）',
  `ach_type`      VARCHAR(20)  NOT NULL DEFAULT 'other' COMMENT '类型：paper 论文 / patent 专利 / software 软著 / award 获奖 / project 项目 / other 其他',
  `title`         VARCHAR(300) NOT NULL                COMMENT '成果名称',
  `description`   TEXT                                 COMMENT '成果说明 / 简介',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '审核状态：pending 待审核 / approved 已通过 / rejected 已打回',
  `file_path`     VARCHAR(255) DEFAULT NULL     COMMENT '证明材料附件路径',
  `submit_date`   DATE                                 COMMENT '提交日期',
  `audit_by`      INT UNSIGNED NOT NULL DEFAULT 0      COMMENT '审核人 user.id（导师 / 组管）',
  `audit_comment` VARCHAR(500) DEFAULT NULL     COMMENT '审核意见',
  `audit_at`      DATETIME                             COMMENT '审核时间',
  `remark`        VARCHAR(500) DEFAULT NULL     COMMENT '备注',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  KEY `idx_user_status` (`user_id`, `status`),
  KEY `idx_group_type` (`group_id`, `ach_type`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='科研成果表';
