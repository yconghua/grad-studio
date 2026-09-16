-- 系统用户表：三角色权限（admin 管理员 / mentor 导师 / student 学生，user 兼容历史数据）
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 字段说明：
--   - 核心登录字段（id / username / password / role）与现有运行时 CRUD 完全兼容；
--   - 其余档案 / 学术 / 状态字段均为可选（NULL），新增不会破坏建库、登录、用户管理流程。
-- 升级提示：版本升级迁移只补齐「缺失的列」，不会补建新增的 KEY 索引——新库会完整建好索引，
--   已存在的库升级后仅补齐列（idx_* 索引需手动或重建库后生效，不影响功能）。
CREATE TABLE IF NOT EXISTS `user` (
  -- ===== 核心字段（登录 / 鉴权） =====
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`      VARCHAR(50)  NOT NULL                COMMENT '登录账号（唯一）',
  `password`      VARCHAR(100) NOT NULL                COMMENT 'bcrypt 哈希后的密码',
  `role`          VARCHAR(20)  NOT NULL DEFAULT 'student' COMMENT '角色：admin 管理员 / mentor 导师 / student 学生 / user 普通用户(兼容历史)',

  -- ===== 基础档案 =====
  `real_name`     VARCHAR(50)  NULL DEFAULT NULL       COMMENT '真实姓名',
  `gender`        ENUM('male','female','other') NULL DEFAULT NULL COMMENT '性别：male 男 / female 女 / other 其他',
  `student_no`    VARCHAR(30)  NULL DEFAULT NULL       COMMENT '学号 / 工号',
  `email`         VARCHAR(100) NULL DEFAULT NULL       COMMENT '邮箱',
  `phone`         VARCHAR(20)  NULL DEFAULT NULL       COMMENT '手机号',
  `avatar`        VARCHAR(255) NULL DEFAULT NULL       COMMENT '头像（URL 或存储路径）',
  `bio`           VARCHAR(500) NULL DEFAULT NULL       COMMENT '个人简介',

  -- ===== 学术 / 组织信息 =====
  `college`       VARCHAR(100) NULL DEFAULT NULL       COMMENT '所属学院',
  `department`    VARCHAR(100) NULL DEFAULT NULL       COMMENT '院系 / 教研室',
  `major`         VARCHAR(100) NULL DEFAULT NULL       COMMENT '专业 / 研究方向',
  `grade`         VARCHAR(20)  NULL DEFAULT NULL       COMMENT '年级（如 2024级）',
  `degree_type`   ENUM('master','doctor') NULL DEFAULT NULL COMMENT '学位类型：master 硕士 / doctor 博士',
  `position`      VARCHAR(50)  NULL DEFAULT NULL       COMMENT '职务 / 职称（导师或管理员，如 教授、副教授）',
  `advisor_id`    INT UNSIGNED NULL DEFAULT NULL       COMMENT '导师用户 id（学生指向导师，自关联，不加外键约束）',

  -- ===== 状态与管理 =====
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '账号状态：active 正常 / disabled 禁用 / leave 离组',
  `join_date`     DATE         NULL DEFAULT NULL       COMMENT '入组日期',
  `last_login_at` DATETIME     NULL DEFAULT NULL       COMMENT '最后登录时间',
  `updated_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',

  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_status` (`status`),
  KEY `idx_student_no` (`student_no`),
  KEY `idx_advisor_id` (`advisor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- 默认管理员（admin / admin123）：仅在账号不存在时插入，避免重复初始化冲突
INSERT INTO `user` (`username`, `password`, `role`)
SELECT 'admin', '$2b$10$cPHMkHMubQkZDVOi75fpte.kilWcn/2vFqX7muTMvyOlYCDfqx1/C', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM `user` WHERE `username` = 'admin');

-- 如需初始化导师 / 学生账号，仿照上面的写法：password 传 bcrypt 哈希（新增用户时默认密码
-- 为 6 位随机数字，由 authService 生成），role 传 mentor / student。示例（勿直接执行，
-- 密码需替换为真实哈希后再取消注释）：
-- INSERT INTO `user` (`username`, `password`, `role`, `real_name`, `position`)
-- SELECT 'mentor01', '<bcrypt_hash>', 'mentor', '张导师', '副教授'
-- WHERE NOT EXISTS (SELECT 1 FROM `user` WHERE `username` = 'mentor01')
