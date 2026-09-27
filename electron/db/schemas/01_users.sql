-- 系统用户表：登录认证所需的核心字段
-- 幂等：重复执行无副作用；新增表只需在 schemas/ 下加一个「NN_表名.sql」文件，主初始化代码零改动。
--
-- 字段范围：登录认证必需字段（id / username / password / role / status / must_change_password）
--   + 统一软删除标记 is_deleted；档案、组织归属、导师关联等字段由各业务模块表承接。
CREATE TABLE IF NOT EXISTS `user` (
  -- ===== 核心登录字段 =====
  `id`            INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键',
  `username`      VARCHAR(50)  NOT NULL                COMMENT '登录账号（唯一）',
  `password`      VARCHAR(100) NOT NULL                COMMENT 'bcrypt 哈希后的密码',
  `role`          VARCHAR(20)  NOT NULL DEFAULT 'student' COMMENT '角色：super_admin 超级管理员 / group_admin 课题组管理员 / mentor 导师 / student 学生',
  `status`        VARCHAR(20)  NOT NULL DEFAULT 'active' COMMENT '账号状态：active 正常 / disabled 禁用 / leave 离组',
  `must_change_password` TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否必须修改初始密码：1 首次登录强制改密 / 0 已修改',
  `is_deleted`    TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '软删除标记：0 正常 / 1 已删除',

  PRIMARY KEY (`id`),
  KEY `idx_is_deleted` (`is_deleted`),
  UNIQUE KEY `uk_username` (`username`),
  KEY `idx_role` (`role`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='系统用户表';

-- 默认管理员（admin / admin123456）：仅在账号不存在时插入，避免重复初始化冲突。
-- 已软删除的 admin 视为不存在，允许重建；must_change_password 默认 1 → 首次登录强制修改密码。
INSERT INTO `user` (`username`, `password`, `role`)
SELECT 'admin', '$2a$10$aREFAUZgCs49pDhdl2Soc.QOHhKYmSs9diBUE4f4OWkvH83b9QB4K', 'super_admin'
WHERE NOT EXISTS (SELECT 1 FROM `user` WHERE `username` = 'admin' AND `is_deleted` = 0);
