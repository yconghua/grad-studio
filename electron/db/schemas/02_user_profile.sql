-- 用户档案表：存放登录账号之外的个人资料（与 user 表一对一，逻辑关联）
-- 幂等：重复执行无副作用。
-- 设计说明：user 表保持登录认证职责纯净，档案信息独立成表，
--   成员管理 / 个人资料页 / 成果署名等按需联表读取。
CREATE TABLE IF NOT EXISTS `user_profile` (
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `user_id`       INT UNSIGNED NOT NULL                COMMENT '关联 user.id',
  `real_name`     VARCHAR(50)  NOT NULL DEFAULT ''     COMMENT '真实姓名',
  `gender`        VARCHAR(10)  NOT NULL DEFAULT ''     COMMENT '性别：male 男 / female 女 / 空 未填写',
  `student_no`    VARCHAR(30)  NOT NULL DEFAULT ''     COMMENT '学号 / 工号',
  `email`         VARCHAR(100) NOT NULL DEFAULT ''     COMMENT '邮箱',
  `phone`         VARCHAR(30)  NOT NULL DEFAULT ''     COMMENT '手机号',
  `avatar`        VARCHAR(255) NOT NULL DEFAULT ''     COMMENT '头像文件路径',
  `college`       VARCHAR(100) NOT NULL DEFAULT ''     COMMENT '所属学院',
  `department`    VARCHAR(100) NOT NULL DEFAULT ''     COMMENT '所属系 / 研究所',
  `major`         VARCHAR(100) NOT NULL DEFAULT ''     COMMENT '专业 / 研究方向',
  `grade`         VARCHAR(20)  NOT NULL DEFAULT ''     COMMENT '年级（如 2024 级）',
  `degree_type`   VARCHAR(20)  NOT NULL DEFAULT ''     COMMENT '学位类型：master 硕士 / doctor 博士',
  `position`      VARCHAR(50)  NOT NULL DEFAULT ''     COMMENT '组内职位 / 角色说明',
  `bio`           TEXT                                 COMMENT '个人简介',
  `join_date`     DATE                                 COMMENT '入组日期',
  `created_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  KEY `idx_real_name` (`real_name`),
  KEY `idx_student_no` (`student_no`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户档案表';
