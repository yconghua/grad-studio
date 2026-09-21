-- 毕业里程碑表（科研管理 → 毕业进度）
-- 每个学生的毕业关键节点：开题 / 中期 / 预答辩 / 盲审 / 答辩。
CREATE TABLE IF NOT EXISTS `graduation_milestone` (
  `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`      INT UNSIGNED NOT NULL                COMMENT '学生用户 id',
  `type`         VARCHAR(30)  NOT NULL                COMMENT '类型：opening 开题 / midterm 中期 / pre_defense 预答辩 / blind_review 盲审 / defense 答辩',
  `deadline`     DATE         NULL DEFAULT NULL       COMMENT '截止日期',
  `materials`    TEXT         NULL                    COMMENT '材料清单（JSON 或文本）',
  `status`       VARCHAR(20)  NOT NULL DEFAULT 'pending' COMMENT '状态：pending 未开始 / in_progress 进行中 / done 已完成 / delayed 延期',
  `completed_at`  DATE         NULL DEFAULT NULL       COMMENT '实际完成日期',
  `remark`       VARCHAR(500) NULL DEFAULT NULL       COMMENT '备注',
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='毕业里程碑表';
