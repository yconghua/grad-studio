-- 入组 / 离组 / 毕业申请表（模块2 工作室与成员管理 - 入组离组流程）
-- 审批状态与审批意见不存本表，统一由 05_approval.sql 的审批单承载，本表只存 approval_id 关联。
-- student_no 不加唯一约束：同一人可能被驳回后再次申请。
-- 幂等：CREATE TABLE IF NOT EXISTS，无种子数据。

CREATE TABLE IF NOT EXISTS `member_application` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `apply_type`    VARCHAR(20)  NOT NULL DEFAULT '入组'  COMMENT '申请类型：入组 / 离组 / 毕业',
  `name`          VARCHAR(50)  NOT NULL                COMMENT '姓名，入组时可能尚未开通账号',
  `student_no`    VARCHAR(30)  DEFAULT NULL            COMMENT '学号或工号',
  `member_type`   VARCHAR(20)  DEFAULT NULL            COMMENT '拟加入身份：导师 / 博士 / 硕士 / 本科 / 访客',
  `grade`         VARCHAR(20)  DEFAULT NULL            COMMENT '年级',
  `major`         VARCHAR(50)  DEFAULT NULL            COMMENT '专业',
  `phone`         VARCHAR(20)  DEFAULT NULL            COMMENT '联系电话',
  `email`         VARCHAR(80)  DEFAULT NULL            COMMENT '邮箱',
  `supervisor_id` INT UNSIGNED DEFAULT NULL            COMMENT '意向或现任导师 member.id',
  `apply_desc`    TEXT         DEFAULT NULL            COMMENT '申请说明',
  `applicant_id`  INT UNSIGNED DEFAULT NULL            COMMENT '申请人 member.id，离组与毕业申请时有值',
  `approval_id`   INT UNSIGNED DEFAULT NULL            COMMENT '关联审批单 approval_order.id',
  `status`        VARCHAR(20)  NOT NULL DEFAULT '待审批' COMMENT '状态：待审批 / 已通过 / 已驳回 / 已撤销',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '申请时间',
  `updated_at`    DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  KEY `idx_student_no` (`student_no`),
  KEY `idx_applicant` (`applicant_id`),
  KEY `idx_approval` (`approval_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='入组离组申请表';
