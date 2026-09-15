-- 成员档案表（模块2 工作室与成员管理）
-- 与 user 账号表一一对应：user_id 为空表示「已建档未开通账号」（如刚通过入组审核的新生）。
-- member_type 仅用于展示与筛选，不参与权限判断（权限只看 user.role）。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `member` (
  `id`                 INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`            INT UNSIGNED DEFAULT NULL            COMMENT '关联 user.id，唯一，空表示未开账号',
  `name`               VARCHAR(50)  NOT NULL                COMMENT '姓名',
  `student_no`         VARCHAR(30)  NOT NULL                COMMENT '学号或工号，唯一',
  `member_type`        VARCHAR(20)  NOT NULL DEFAULT '硕士'  COMMENT '身份：导师 / 博士 / 硕士 / 本科 / 访客',
  `grade`              VARCHAR(20)  DEFAULT NULL            COMMENT '年级，如 2024级',
  `major`              VARCHAR(50)  DEFAULT NULL            COMMENT '专业',
  `supervisor_id`      INT UNSIGNED DEFAULT NULL            COMMENT '导师的 member.id，导师本人为空',
  `research_direction` VARCHAR(100) DEFAULT NULL            COMMENT '研究方向',
  `phone`              VARCHAR(20)  DEFAULT NULL            COMMENT '联系电话',
  `email`              VARCHAR(80)  DEFAULT NULL            COMMENT '邮箱',
  `enroll_date`        DATE         DEFAULT NULL            COMMENT '入组日期',
  `leave_date`         DATE         DEFAULT NULL            COMMENT '离组或毕业日期',
  `status`             VARCHAR(20)  NOT NULL DEFAULT '在组'  COMMENT '状态：在组 / 已离组 / 已毕业 / 暂停',
  `avatar`             VARCHAR(200) DEFAULT NULL            COMMENT '头像地址，本期不做上传，预留',
  `remark`             VARCHAR(255) DEFAULT NULL            COMMENT '备注',
  `is_deleted`         TINYINT      NOT NULL DEFAULT 0      COMMENT '逻辑删除：0 正常 / 1 已删除',
  `created_at`         DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`         DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_student_no` (`student_no`),
  KEY `idx_supervisor` (`supervisor_id`),
  KEY `idx_status` (`status`),
  KEY `idx_member_type` (`member_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='成员档案表';
